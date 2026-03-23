'use client';

import { useState, useCallback, useRef } from 'react';
import type { TccSession, TccSection } from '@/lib/tcc/types';

type TccStep =
  | 'idle'            // nenhuma sessão activa
  | 'new_or_resume'   // escolher nova ou retomar
  | 'topic_input'     // inserir tópico
  | 'generating_outline' // a gerar esboço (streaming)
  | 'review_outline'  // utilizador revê o esboço
  | 'outline_approved' // esboço aprovado, lista de secções
  | 'developing'      // a desenvolver uma secção
  | 'section_ready';  // secção pronta para inserir

interface UseTccSession {
  step:            TccStep;
  session:         TccSession | null;
  outline:         string;
  streamingText:   string;
  activeSectionIdx: number | null;
  error:           string | null;
  recentSessions:  Pick<TccSession, 'id' | 'topic' | 'status' | 'created_at' | 'updated_at'>[];

  startNew:        () => void;
  submitTopic:     (topic: string) => Promise<void>;
  approveOutline:  () => Promise<void>;
  requestNewOutline: () => void;
  developSection:  (index: number) => Promise<void>;
  insertSection:   (index: number, onInsert: (text: string) => void) => Promise<void>;
  backToOutline:   () => void;
  loadSessions:    () => Promise<void>;
  resumeSession:   (id: string) => Promise<void>;
  reset:           () => void;
}

export function useTccSession(): UseTccSession {
  const [step, setStep]         = useState<TccStep>('idle');
  const [session, setSession]   = useState<TccSession | null>(null);
  const [outline, setOutline]   = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<UseTccSession['recentSessions']>([]);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStep('idle');
    setSession(null);
    setOutline('');
    setStreamingText('');
    setActiveSectionIdx(null);
    setError(null);
  }, []);

  const startNew = useCallback(() => {
    setStep('new_or_resume');
    setError(null);
  }, []);

  // ─── Carregar sessões recentes ──────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/tcc/session');
      if (res.ok) {
        const data = await res.json();
        setRecentSessions(data);
      }
    } catch { /* ignorar */ }
  }, []);

  // ─── Retomar sessão existente ───────────────────────────────────────────────
  const resumeSession = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/tcc/session?id=${id}`);
      if (!res.ok) throw new Error('Sessão não encontrada');
      const data: TccSession = await res.json();
      setSession(data);
      setOutline(data.outline_approved ?? data.outline_draft ?? '');

      if (data.status === 'outline_pending' || data.status === 'outline_approved') {
        setStep(data.status === 'outline_approved' ? 'outline_approved' : 'review_outline');
      } else {
        setStep('outline_approved');
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  // ─── Criar sessão e gerar esboço ────────────────────────────────────────────
  const submitTopic = useCallback(async (topic: string) => {
    setError(null);
    setStreamingText('');
    setStep('generating_outline');

    try {
      // 1. Criar sessão no Supabase
      const sessionRes = await fetch('/api/tcc/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      if (!sessionRes.ok) throw new Error('Erro ao criar sessão');
      const newSession: TccSession = await sessionRes.json();
      setSession(newSession);

      // 2. Gerar esboço em streaming
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const outlineRes = await fetch('/api/tcc/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: newSession.id, topic }),
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
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              accumulated += delta;
              setStreamingText(accumulated);
            }
          } catch { /* ignorar */ }
        }
      }

      setOutline(accumulated);
      setStep('review_outline');
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
        setStep('topic_input');
      }
    }
  }, []);

  // ─── Aprovar esboço ─────────────────────────────────────────────────────────
  const approveOutline = useCallback(async () => {
    if (!session) return;
    setError(null);

    try {
      const res = await fetch('/api/tcc/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, outline }),
      });
      if (!res.ok) throw new Error('Erro ao aprovar esboço');
      const updated: TccSession = await res.json();
      setSession(updated);
      setStep('outline_approved');
    } catch (e: any) {
      setError(e.message);
    }
  }, [session, outline]);

  // ─── Pedir novo esboço ──────────────────────────────────────────────────────
  const requestNewOutline = useCallback(() => {
    if (!session) return;
    setOutline('');
    setStreamingText('');
    submitTopic(session.topic);
  }, [session, submitTopic]);

  // ─── Desenvolver secção ─────────────────────────────────────────────────────
  const developSection = useCallback(async (index: number) => {
    if (!session) return;
    setError(null);
    setActiveSectionIdx(index);
    setStreamingText('');
    setStep('developing');

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

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              accumulated += delta;
              setStreamingText(accumulated);
            }
          } catch { /* ignorar */ }
        }
      }

      // Actualizar sessão local com o conteúdo gerado
      setSession(prev => {
        if (!prev) return prev;
        const updatedSections = prev.sections.map(s =>
          s.index === index ? { ...s, content: accumulated, status: 'developed' as const } : s,
        );
        const allDone = updatedSections.every(s => s.status !== 'pending');
        return { ...prev, sections: updatedSections, status: allDone ? 'completed' : 'in_progress' };
      });

      setStep('section_ready');
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
        setStep('outline_approved');
      }
    }
  }, [session]);

  // ─── Inserir secção no editor e marcar como inserida ────────────────────────
  const backToOutline = useCallback(() => {
    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, []);

  const insertSection = useCallback(async (
    index: number,
    onInsert: (text: string) => void,
  ) => {
    if (!session) return;

    const sec = session.sections.find(s => s.index === index);
    if (!sec?.content) return;

    // Formata com cabeçalho da secção
    const text = `## ${sec.title}\n\n${sec.content}`;
    onInsert(text);

    // Marcar como inserida no Supabase
    try {
      await fetch('/api/tcc/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'markInserted', sessionId: session.id, sectionIndex: index }),
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
    startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession, reset,
  };
}
