'use client';

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

// Secções fixas de fallback (caso o esboço não tenha ## nenhum)
const FIXED_SECTIONS = [
  'Índice',
  'Introdução',
  'Objectivos e Metodologia',
  'Desenvolvimento Teórico',
  'Conclusão',
  'Referências Bibliográficas',
];

function buildInitialSections(): WorkSection[] {
  return FIXED_SECTIONS.map((title, index) => ({
    index,
    title,
    content: '',
    status: 'pending' as const,
  }));
}

/**
 * Analisa o esboço gerado pela IA e cria secções individualizadas.
 */
function parseOutlineSections(outline: string): WorkSection[] {
  const lines = outline.split('\n');
  const raw: { title: string; level: 2 | 3 }[] = [];

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2) raw.push({ title: h2[1].trim(), level: 2 });
    else if (h3) raw.push({ title: h3[1].trim(), level: 3 });
  }

  if (raw.length === 0) return buildInitialSections();

  const sections: WorkSection[] = [];
  let index = 0;

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].level === 2) {
      const nextIsH3 = i + 1 < raw.length && raw[i + 1].level === 3;
      if (!nextIsH3) {
        sections.push({ index, title: raw[i].title, content: '', status: 'pending' });
        index++;
      }
    } else {
      sections.push({ index, title: raw[i].title, content: '', status: 'pending' });
      index++;
    }
  }

  return sections.length > 0 ? sections : buildInitialSections();
}

export function useWorkSession() {
  const [step, setStep] = useState<WorkStep>('idle');
  const [session, setSession] = useState<WorkSessionRecord | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<Pick<WorkSessionRecord, 'id' | 'topic' | 'status' | 'created_at' | 'updated_at'>[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStep('idle');
    setSession(null);
    setStreamingText('');
    setActiveSectionIdx(null);
    setError(null);
  }, []);

  const startNew = useCallback(() => {
    setStep('topic_input');
    setError(null);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/work/session');
      if (res.ok) setRecentSessions(await res.json());
    } catch {
      /* ignorar */
    }
  }, []);

  const resumeSession = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/work/session?id=${id}`);
      if (!res.ok) throw new Error('Sessão não encontrada');
      const data: WorkSessionRecord = await res.json();
      setSession(data);
      setStep(
        data.status === 'outline_approved' || data.status === 'in_progress' || data.status === 'completed'
          ? 'outline_approved'
          : 'review_outline',
      );
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const submitTopic = useCallback(async (topic: string) => {
    setError(null);
    setStreamingText('');
    setStep('generating_outline');

    try {
      const sessionRes = await fetch('/api/work/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      if (!sessionRes.ok) throw new Error('Erro ao criar sessão');
      const newSession: WorkSessionRecord = await sessionRes.json();
      setSession(newSession);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const res = await fetch('/api/work/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, sessionId: newSession.id }),
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
            if (delta) {
              accumulated += delta;
              setStreamingText(accumulated);
            }
          } catch {
            /* ignorar */
          }
        }
      }

      setSession(prev => prev ? {
        ...prev,
        outline_draft: accumulated,
        sections: parseOutlineSections(accumulated),
      } : prev);
      setStep('review_outline');
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
        setStep('topic_input');
      }
    }
  }, []);

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

  const requestNewOutline = useCallback(() => {
    if (!session) return;
    submitTopic(session.topic);
  }, [session, submitTopic]);

  const developSection = useCallback(async (index: number) => {
    if (!session) return;
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
            if (delta) {
              accumulated += delta;
              setStreamingText(accumulated);
            }
          } catch {
            /* ignorar */
          }
        }
      }

      setSession(prev => {
        if (!prev) return prev;
        const sections = prev.sections.map(section =>
          section.index === index ? { ...section, content: accumulated, status: 'developed' as const } : section,
        );
        return {
          ...prev,
          sections,
          status: sections.every(section => section.status !== 'pending') ? 'completed' : 'in_progress',
        };
      });
      setStep('section_ready');
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
        setStep('outline_approved');
      }
    }
  }, [session]);

  const insertSection = useCallback(async (index: number, onInsert: (text: string) => void) => {
    if (!session) return;
    const sec = session.sections[index];
    if (!sec?.content) return;

    const isSubsection = /^\d+\.\d+/.test(sec.title);
    const heading = isSubsection ? '###' : '##';
    onInsert(`${heading} ${sec.title}\n\n${sec.content}`);

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
    } catch {
      /* não crítico */
    }

    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(section =>
          section.index === index ? { ...section, status: 'inserted' as const } : section,
        ),
      };
    });
    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, [session]);

  const backToOutline = useCallback(() => {
    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, []);

  const progressPct = session?.sections.length
    ? Math.round(
        session.sections.filter(section => section.status !== 'pending').length /
        session.sections.length * 100,
      )
    : 0;

  return {
    step, session, streamingText, activeSectionIdx, error, progressPct, recentSessions,
    reset, startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession,
  };
}
