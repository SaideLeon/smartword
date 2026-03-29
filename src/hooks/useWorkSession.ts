'use client';

// hooks/useWorkSession.ts (versão actualizada — nova estrutura de numeração)
//
// REGRA DE PAGEBREAK:
// O conteúdo guardado no Supabase é SEMPRE puro — sem {pagebreak} nem {section}.
// Os {pagebreak} são adicionados APENAS quando o conteúdo é inserido no editor,
// pela função buildSectionMarkdown em WorkPanel.tsx.

import { useState, useCallback, useRef } from 'react';
import type { WorkSection, WorkSessionRecord } from '@/lib/work/types';

export type WorkStep =
  | 'idle'
  | 'topic_input'
  | 'generating_outline'
  | 'review_outline'
  | 'outline_approved'
  | 'developing'
  | 'section_ready';

// ── Normalização de título ────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[ivxlcdm]+\.\s*/i, '')
    .replace(/^\d+(\.\d+)?\.\s*/, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAutomaticIndex(title: string): boolean {
  return normalizeTitle(title) === 'indice';
}

// ── Secções fixas de fallback (nova estrutura com numeração) ─────────────────

const FALLBACK_SECTIONS = [
  'I. Introdução',
  'II. Objectivos',
  'III. Metodologia',
  'Conclusão',
  'Referências Bibliográficas',
];

function buildFallbackSections(): WorkSection[] {
  return FALLBACK_SECTIONS.map((title, index) => ({
    index,
    title,
    content: '',
    status: 'pending' as const,
  }));
}

// ── Verifica se o conteúdo começa com o título ────────────────────────────────

function contentStartsWithTitle(content: string, sectionTitle: string): boolean {
  const firstLine = content.trimStart().split('\n')[0].trim();
  if (!firstLine.startsWith('#')) return false;
  const headingText = firstLine.replace(/^#+\s*/, '');
  const normalizedHeading = normalizeTitle(headingText);
  const normalizedTitle = normalizeTitle(sectionTitle);
  return (
    normalizedHeading === normalizedTitle ||
    normalizedHeading.includes(normalizedTitle) ||
    normalizedTitle.includes(normalizedHeading)
  );
}

// ── Parse do esboço em secções accionáveis ────────────────────────────────────
//
// Regras:
//  - ## com ### filhos → o ## pai não é accionável, apenas as ### filhas
//  - ## sem ### filhos → accionável directamente
//  - Prefixos romanos (I., II., III.) e numéricos (1.1) são mantidos no título

function parseOutlineSections(outline: string): WorkSection[] {
  const lines = outline.split('\n');
  const raw: { title: string; level: 2 | 3 }[] = [];

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);

    if (h2) {
      const title = h2[1].trim();
      if (!isAutomaticIndex(title)) raw.push({ title, level: 2 });
    } else if (h3) {
      const title = h3[1].trim();
      if (!isAutomaticIndex(title)) raw.push({ title, level: 3 });
    }
  }

  if (raw.length === 0) return buildFallbackSections();

  const sections: WorkSection[] = [];
  let index = 0;

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].level === 2) {
      const nextIsH3 = i + 1 < raw.length && raw[i + 1].level === 3;
      if (!nextIsH3) {
        sections.push({ index, title: raw[i].title, content: '', status: 'pending' });
        index++;
      }
      // Se tem subsecções, o ## pai não é accionável
    } else {
      sections.push({ index, title: raw[i].title, content: '', status: 'pending' });
      index++;
    }
  }

  return sections.length > 0 ? sections : buildFallbackSections();
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useWorkSession() {
  const [step, setStep] = useState<WorkStep>('idle');
  const [session, setSession] = useState<WorkSessionRecord | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<
    Pick<WorkSessionRecord, 'id' | 'topic' | 'status' | 'created_at' | 'updated_at'>[]
  >([]);
  const [regeneratedSections, setRegeneratedSections] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStep('idle');
    setSession(null);
    setStreamingText('');
    setActiveSectionIdx(null);
    setError(null);
    setRegeneratedSections(new Set());
  }, []);

  const startNew = useCallback(() => {
    setStep('topic_input');
    setError(null);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/work/session');
      if (res.ok) setRecentSessions(await res.json());
    } catch { /* ignorar */ }
  }, []);

  const resumeSession = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/work/session?id=${id}`);
      if (!res.ok) throw new Error('Sessão não encontrada');
      const data: WorkSessionRecord = await res.json();
      setSession(data);
      setStep(
        data.status === 'outline_approved' ||
        data.status === 'in_progress' ||
        data.status === 'completed'
          ? 'outline_approved'
          : 'review_outline',
      );
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

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
        const sessionRes = await fetch('/api/work/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic }),
        });
        if (!sessionRes.ok) throw new Error('Erro ao criar sessão');
        const newSession: WorkSessionRecord = await sessionRes.json();
        setSession(newSession);
        activeSessionId = newSession.id;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const res = await fetch('/api/work/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          sessionId: activeSessionId,
          suggestions: options?.suggestions?.trim() || undefined,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error('Erro ao gerar esboço');

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

      setSession(prev => prev ? {
        ...prev,
        outline_draft: accumulated,
        sections: parseOutlineSections(accumulated),
      } : prev);
      setStep('review_outline');
    } catch (e: any) {
      if (e.name !== 'AbortError') { setError(e.message); setStep('topic_input'); }
    }
  }, []);

  const submitTopic = useCallback(async (topic: string) => {
    await generateOutline(topic);
  }, [generateOutline]);

  const approveOutline = useCallback(async (outline: string) => {
    if (!session) return;
    try {
      const res = await fetch('/api/work/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, outline }),
      });
      if (!res.ok) throw new Error('Erro ao aprovar esboço');
      const updated: WorkSessionRecord = await res.json();
      setSession(updated);
      setStep('outline_approved');
    } catch (e: any) {
      setError(e.message);
    }
  }, [session]);

  const requestNewOutline = useCallback((suggestions?: string) => {
    if (!session) return;
    generateOutline(session.topic, { sessionId: session.id, suggestions });
  }, [generateOutline, session]);

  const developSection = useCallback(async (index: number) => {
    if (!session) return;
    const previousStatus = session.sections.find(section => section.index === index)?.status;
    const isRegeneration = previousStatus === 'developed' || previousStatus === 'inserted';

    setError(null);
    setActiveSectionIdx(index);
    setStreamingText('');
    setStep('developing');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/work/develop', {
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
        const sections = prev.sections.map(section =>
          section.index === index
            ? { ...section, content: accumulated, status: 'developed' as const }
            : section,
        );
        return {
          ...prev,
          sections,
          status: sections.every(s => s.status !== 'pending') ? 'completed' : 'in_progress',
        };
      });

      setStreamingText(accumulated);

      setRegeneratedSections(prev => {
        const next = new Set(prev);
        if (isRegeneration) next.add(index);
        else next.delete(index);
        return next;
      });

      setStep('section_ready');
    } catch (e: any) {
      if (e.name !== 'AbortError') { setError(e.message); setStep('outline_approved'); }
    }
  }, [session]);

  const insertSection = useCallback(async (
    index: number,
    onInsert: (text: string) => void,
    options?: {
      shouldResetEditor?: boolean;
      onReplace?: (text: string) => void;
    },
  ) => {
    if (!session) return;
    const sec = session.sections[index];
    if (!sec?.content) return;

    const isSubsection = /^\d+\.\d+/.test(sec.title);
    const heading = isSubsection ? '###' : '##';
    const titleAlreadyPresent = contentStartsWithTitle(sec.content, sec.title);
    const baseText = titleAlreadyPresent
      ? sec.content
      : `${heading} ${sec.title}\n\n${sec.content}`;

    let fetchedSession: WorkSessionRecord | null = null;

    try {
      await fetch('/api/work/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'markInserted',
          sessionId: session.id,
          sectionIndex: index,
          sections: session.sections,
        }),
      });

      if (options?.shouldResetEditor && options.onReplace) {
        const refreshRes = await fetch(`/api/work/session?id=${session.id}`);
        if (!refreshRes.ok) throw new Error('Erro ao sincronizar sessão regenerada');

        const refreshedSession: WorkSessionRecord = await refreshRes.json();
        fetchedSession = refreshedSession;

        const organizedContent = [...refreshedSession.sections]
          .filter(section => section.content.trim())
          .sort((a, b) => a.index - b.index)
          .map((section, i) => {
            const sectionHasHeading = contentStartsWithTitle(section.content, section.title);
            const sectionIsSubsection = /^\d+\.\d+/.test(section.title);
            const sectionHeading = sectionIsSubsection ? '###' : '##';
            const text = sectionHasHeading ? section.content : `${sectionHeading} ${section.title}\n\n${section.content}`;
            return i === 0 ? text : `{pagebreak}\n\n${text}`;
          })
          .join('\n\n');

        options.onReplace(organizedContent);
      } else {
        onInsert(baseText);
      }
    } catch {
      if (options?.shouldResetEditor && options.onReplace) {
        options.onReplace(baseText);
      } else {
        onInsert(baseText);
      }
    }

    if (fetchedSession) {
      setSession(fetchedSession);
    } else {
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map(section =>
            section.index === index
              ? { ...section, status: 'inserted' as const }
              : section,
          ),
        };
      });
    }

    setRegeneratedSections(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });

    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, [session]);

  const isSectionRegenerated = useCallback((index: number) => regeneratedSections.has(index), [regeneratedSections]);

  const backToOutline = useCallback(() => {
    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, []);

  const progressPct = session?.sections.length
    ? Math.round(
        session.sections.filter(s => s.status !== 'pending').length /
        session.sections.length * 100,
      )
    : 0;

  return {
    step, session, streamingText, activeSectionIdx, error, progressPct, recentSessions,
    reset, startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession,
    isSectionRegenerated,
  };
}
