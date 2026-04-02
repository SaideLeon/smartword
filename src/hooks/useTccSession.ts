// hooks/useTccSession.ts
//
// ── REGRA DE PAGEBREAK (LEIA ANTES DE MODIFICAR) ────────────────────────────
//
// O conteúdo guardado no Supabase é SEMPRE puro — sem {pagebreak}.
// Os {pagebreak} são adicionados EXCLUSIVAMENTE por buildTccSectionMarkdown()
// em src/lib/tcc/pagebreak.ts, no momento de inserção no editor.
//
// REGRAS:
//   • Primeira secção inserida num editor vazio → SEM {pagebreak}
//   • Secções estruturais (Introdução, Justificativa, Metodologia, etc.) → COM {pagebreak}
//   • Primeira subsecção de um grupo (1.1) → heading pai + {pagebreak} antes do bloco
//   • Subsecções seguintes (1.2, 1.3…) → SEM pagebreak, fluem após o pai
//
// Toda a lógica de classificação está em src/lib/tcc/pagebreak.ts.

'use client';

import { useState, useCallback, useRef } from 'react';
import type { TccSession, TccSection } from '@/lib/tcc/types';
import {
  buildTccSectionMarkdown,
  buildReconstructedTccContent,
} from '@/lib/tcc/pagebreak';

type TccStep =
  | 'idle'
  | 'new_or_resume'
  | 'topic_input'
  | 'generating_outline'
  | 'review_outline'
  | 'outline_approved'
  | 'developing'
  | 'section_ready';

// ── Estado de compressão exposto à UI ────────────────────────────────────────
export interface CompressionStatus {
  active: boolean;
  justCompressed: boolean;
  coveredUpTo: number | null;
  summaryLength: number;
}

interface UseTccSession {
  step:              TccStep;
  session:           TccSession | null;
  outline:           string;
  streamingText:     string;
  activeSectionIdx:  number | null;
  error:             string | null;
  recentSessions:    Pick<TccSession, 'id' | 'topic' | 'status' | 'created_at' | 'updated_at'>[];
  compressionStatus: CompressionStatus;

  startNew:          () => void;
  submitTopic:       (topic: string) => Promise<void>;
  approveOutline:    (outlineOverride?: string) => Promise<void>;
  requestNewOutline: (suggestions?: string) => Promise<void>;
  developSection:    (index: number) => Promise<void>;
  insertSection:     (
    index: number,
    onInsert: (text: string) => void,
    options?: { editorMarkdown?: string; onReplace?: (text: string) => void }
  ) => Promise<void>;
  backToOutline:     () => void;
  loadSessions:      () => Promise<void>;
  resumeSession:     (id: string) => Promise<void>;
  reset:             () => void;
}

export function useTccSession(): UseTccSession {
  const [step, setStep]               = useState<TccStep>('idle');
  const [session, setSession]         = useState<TccSession | null>(null);
  const [outline, setOutline]         = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<UseTccSession['recentSessions']>([]);
  const [compressionStatus, setCompressionStatus] = useState<CompressionStatus>({
    active:         false,
    justCompressed: false,
    coveredUpTo:    null,
    summaryLength:  0,
  });
  const abortRef = useRef<AbortController | null>(null);

  // ── Utilitário: actualizar estado de compressão a partir da sessão ──────────
  const updateCompressionStatus = useCallback((
    sess: TccSession,
    justCompressed = false,
  ) => {
    setCompressionStatus({
      active:         sess.context_summary !== null,
      justCompressed,
      coveredUpTo:    sess.summary_covers_up_to,
      summaryLength:  sess.context_summary?.length ?? 0,
    });
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStep('idle');
    setSession(null);
    setOutline('');
    setStreamingText('');
    setActiveSectionIdx(null);
    setError(null);
    setCompressionStatus({ active: false, justCompressed: false, coveredUpTo: null, summaryLength: 0 });
  }, []);

  const startNew = useCallback(() => {
    setStep('new_or_resume');
    setError(null);
  }, []);

  // ── Carregar sessões recentes ────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/tcc/session');
      if (res.ok) setRecentSessions(await res.json());
    } catch { /* ignorar */ }
  }, []);

  // ── Retomar sessão ───────────────────────────────────────────────────────────
  const resumeSession = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/tcc/session?id=${id}`);
      if (!res.ok) throw new Error('Sessão não encontrada');
      const data: TccSession = await res.json();
      setSession(data);
      setOutline(data.outline_approved ?? data.outline_draft ?? '');
      updateCompressionStatus(data);

      setStep(
        data.status === 'outline_approved' || data.status === 'in_progress' || data.status === 'completed'
          ? 'outline_approved'
          : 'review_outline',
      );
    } catch (e: any) {
      setError(e.message);
    }
  }, [updateCompressionStatus]);

  // ── Criar sessão e gerar esboço ──────────────────────────────────────────────
  const generateOutline = useCallback(async (
    topic: string,
    options?: { sessionId?: string; suggestions?: string },
  ) => {
    setError(null);
    setStreamingText('');
    setStep('generating_outline');

    try {
      let activeSessionId = options?.sessionId;

      if (!activeSessionId) {
        const sessionRes = await fetch('/api/tcc/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic }),
        });
        if (!sessionRes.ok) throw new Error('Erro ao criar sessão');
        const newSession: TccSession = await sessionRes.json();
        setSession(newSession);
        activeSessionId = newSession.id;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const outlineRes = await fetch('/api/tcc/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          topic,
          suggestions: options?.suggestions?.trim() || undefined,
        }),
        signal: ctrl.signal,
      });
      if (!outlineRes.ok) throw new Error('Erro ao gerar esboço');

      const reader = outlineRes.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) { accumulated += delta; setStreamingText(accumulated); }
          } catch { /* ignorar */ }
        }
      }

      setOutline(accumulated);
      setStep('review_outline');
    } catch (e: any) {
      if (e.name !== 'AbortError') { setError(e.message); setStep('topic_input'); }
    }
  }, []);

  const submitTopic = useCallback(async (topic: string) => {
    await generateOutline(topic);
  }, [generateOutline]);

  // ── Aprovar esboço ───────────────────────────────────────────────────────────
  const approveOutline = useCallback(async (outlineOverride?: string) => {
    if (!session) return;
    setError(null);
    const outlineToApprove = outlineOverride?.trim() || outline;
    try {
      const res = await fetch('/api/tcc/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, outline: outlineToApprove }),
      });
      if (!res.ok) throw new Error('Erro ao aprovar esboço');
      const updated: TccSession = await res.json();
      setSession(updated);
      setStep('outline_approved');
    } catch (e: any) {
      setError(e.message);
    }
  }, [session, outline]);

  const requestNewOutline = useCallback(async (suggestions?: string) => {
    if (!session) return;
    setOutline('');
    setStreamingText('');
    await generateOutline(session.topic, { sessionId: session.id, suggestions });
  }, [generateOutline, session]);

  // ── Desenvolver secção (com compressão automática integrada) ─────────────────
  const developSection = useCallback(async (index: number) => {
    if (!session) return;
    setError(null);
    setActiveSectionIdx(index);
    setStreamingText('');
    setStep('developing');
    setCompressionStatus(prev => ({ ...prev, justCompressed: false }));

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const res = await fetch('/api/tcc/develop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, sectionIndex: index }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error('Erro ao desenvolver secção');

      const wasCompressed = res.headers.get('X-Context-Compressed') === 'true';
      const coveredUpTo   = parseInt(res.headers.get('X-Summary-Covers-Up-To') ?? '-1', 10);

      if (wasCompressed) {
        setCompressionStatus(prev => ({
          ...prev,
          active:         true,
          justCompressed: true,
          coveredUpTo:    coveredUpTo >= 0 ? coveredUpTo : prev.coveredUpTo,
        }));
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) { accumulated += delta; setStreamingText(accumulated); }
          } catch { /* ignorar */ }
        }
      }

      setSession(prev => {
        if (!prev) return prev;
        const updatedSections: TccSection[] = prev.sections.map(s =>
          s.index === index ? { ...s, content: accumulated, status: 'developed' as const } : s,
        );
        const allDone = updatedSections.every(s => s.status !== 'pending');
        const updated: TccSession = {
          ...prev,
          sections: updatedSections,
          status: allDone ? 'completed' : 'in_progress',
          summary_covers_up_to: wasCompressed && coveredUpTo >= 0 ? coveredUpTo : prev.summary_covers_up_to,
        };
        if (wasCompressed) updateCompressionStatus(updated, true);
        return updated;
      });

      setStep('section_ready');
    } catch (e: any) {
      if (e.name !== 'AbortError') { setError(e.message); setStep('outline_approved'); }
    }
  }, [session, updateCompressionStatus]);

  // ── Inserir secção no editor ─────────────────────────────────────────────────
  //
  // Usa buildTccSectionMarkdown() para determinar heading, pagebreak e heading pai.
  // O conteúdo do Supabase é sempre puro — sem {pagebreak}.
  //
  // options.editorMarkdown  → conteúdo actual do editor (para detectar se está vazio)
  // options.onReplace       → usado quando se regenera uma secção já inserida

  const backToOutline = useCallback(() => {
    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, []);

  const insertSection = useCallback(async (
    index: number,
    onInsert: (text: string) => void,
    options?: {
      editorMarkdown?: string;
      onReplace?: (text: string) => void;
    },
  ) => {
    if (!session) return;
    const sec = session.sections.find(s => s.index === index);
    if (!sec?.content) return;

    const isFirstInEditor = !options?.editorMarkdown?.trim();
    const currentOutline = session.outline_approved ?? session.outline_draft ?? '';

    // Detecta regeneração: secção que já estava inserida e foi regenerada
    const wasInserted = sec.status === 'inserted';
    const shouldResetEditor = wasInserted && !!options?.onReplace;

    if (shouldResetEditor && options?.onReplace) {
      // Regeneração: reconstrói todo o conteúdo do editor com as secções actuais
      // mais o conteúdo novo (a secção acabou de ser desenvolvida, status 'developed')
      try {
        // Marca no servidor como inserida primeiro
        await fetch('/api/tcc/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _action: 'markInserted',
            sessionId: session.id,
            sectionIndex: index,
            sections: session.sections,
          }),
        });

        // Busca a sessão actualizada
        const refreshRes = await fetch(`/api/tcc/session?id=${session.id}`);
        if (refreshRes.ok) {
          const refreshed: TccSession = await refreshRes.json();
          const outline = refreshed.outline_approved ?? refreshed.outline_draft ?? '';
          const organizedContent = buildReconstructedTccContent(
            refreshed.sections.filter(s => s.content.trim()),
            outline,
          );
          options.onReplace(organizedContent);
          setSession(refreshed);
          setStep('outline_approved');
          setActiveSectionIdx(null);
          return;
        }
      } catch { /* fallback abaixo */ }
    }

    // Inserção normal (primeira vez ou regeneração sem reset)
    const textToInsert = buildTccSectionMarkdown({
      section: sec,
      allSections: session.sections,
      isFirstInEditor,
      outline: currentOutline,
    });

    onInsert(textToInsert);

    // Marca como inserida no servidor
    try {
      await fetch('/api/tcc/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'markInserted',
          sessionId: session.id,
          sectionIndex: index,
          sections: session.sections,
        }),
      });
    } catch { /* não crítico */ }

    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(s =>
          s.index === index ? { ...s, status: 'inserted' as const } : s,
        ),
      };
    });

    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, [session]);

  return {
    step, session, outline, streamingText, activeSectionIdx, error, recentSessions,
    compressionStatus,
    startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession, reset,
  };
}
