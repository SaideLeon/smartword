'use client';

import { useState, useCallback, useRef } from 'react';

export type WorkType =
  | 'grupo'        // Trabalho de Investigação em Grupo
  | 'individual'   // Relatório Individual
  | 'resumo'       // Resumo / Síntese
  | 'campo';       // Trabalho de Campo

export type WorkStep =
  | 'idle'
  | 'config'
  | 'generating_outline'
  | 'review_outline'
  | 'developing'
  | 'section_ready'
  | 'outline_approved';

export interface WorkGroup {
  number: number;
  members: string[];
  topic: string;
}

export interface WorkSection {
  index: number;
  title: string;
  content: string;
  status: 'pending' | 'developed' | 'inserted';
}

export interface WorkConfig {
  type: WorkType;
  school: string;
  course: string;
  subject: string;
  module: string;
  className: string;
  deliveryDate: string;
  numGroups: number;
  membersPerGroup: number;
  customTopics: string;
  formatorName: string;
  formatorContact: string;
}

export interface WorkSession {
  config: WorkConfig;
  groups: WorkGroup[];
  outline: string;
  sections: WorkSection[];
  enunciado: string;
}

const DEFAULT_CONFIG: WorkConfig = {
  type: 'grupo',
  school: '',
  course: '',
  subject: '',
  module: '',
  className: '',
  deliveryDate: '',
  numGroups: 5,
  membersPerGroup: 5,
  customTopics: '',
  formatorName: '',
  formatorContact: '',
};

export function useWorkSession() {
  const [step, setStep] = useState<WorkStep>('idle');
  const [config, setConfig] = useState<WorkConfig>(DEFAULT_CONFIG);
  const [session, setSession] = useState<WorkSession | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStep('idle');
    setConfig(DEFAULT_CONFIG);
    setSession(null);
    setStreamingText('');
    setActiveSectionIdx(null);
    setError(null);
  }, []);

  const startConfig = useCallback((type: WorkType) => {
    setConfig(prev => ({ ...prev, type }));
    setStep('config');
    setError(null);
  }, []);

  const generateWork = useCallback(async (cfg: WorkConfig) => {
    setConfig(cfg);
    setError(null);
    setStreamingText('');
    setStep('generating_outline');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/work/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error('Erro ao gerar trabalho');

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

      // Parse the JSON response
      try {
        const clean = accumulated.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(clean);
        setSession({
          config: cfg,
          groups: parsed.groups ?? [],
          outline: parsed.outline ?? '',
          sections: (parsed.sections ?? []).map((s: any, i: number) => ({
            index: i,
            title: s.title,
            content: '',
            status: 'pending' as const,
          })),
          enunciado: parsed.enunciado ?? '',
        });
        setStep('review_outline');
      } catch {
        // If not JSON, treat as outline text
        setSession({
          config: cfg,
          groups: [],
          outline: accumulated,
          sections: extractSections(accumulated),
          enunciado: accumulated,
        });
        setStep('review_outline');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') { setError(e.message); setStep('config'); }
    }
  }, []);

  const approveOutline = useCallback(() => {
    setStep('outline_approved');
  }, []);

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
        body: JSON.stringify({
          config: session.config,
          section: session.sections[index],
          outline: session.outline,
          groups: session.groups,
          previousSections: session.sections.slice(0, index).filter(s => s.content),
        }),
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
        const updated = prev.sections.map(s =>
          s.index === index ? { ...s, content: accumulated, status: 'developed' as const } : s
        );
        return { ...prev, sections: updated };
      });
      setStep('section_ready');
    } catch (e: any) {
      if (e.name !== 'AbortError') { setError(e.message); setStep('outline_approved'); }
    }
  }, [session]);

  const insertSection = useCallback((index: number, onInsert: (text: string) => void) => {
    if (!session) return;
    const sec = session.sections[index];
    if (!sec?.content) return;
    onInsert(`## ${sec.title}\n\n${sec.content}`);
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map(s =>
          s.index === index ? { ...s, status: 'inserted' as const } : s
        ),
      };
    });
    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, [session]);

  const insertEnunciado = useCallback((onInsert: (text: string) => void) => {
    if (!session?.enunciado) return;
    onInsert(session.enunciado);
  }, [session]);

  const backToOutline = useCallback(() => {
    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, []);

  const progressPct = session?.sections.length
    ? Math.round(session.sections.filter(s => s.status !== 'pending').length / session.sections.length * 100)
    : 0;

  return {
    step, config, session, streamingText, activeSectionIdx, error, progressPct,
    reset, startConfig, generateWork, approveOutline, developSection,
    insertSection, insertEnunciado, backToOutline,
  };
}

function extractSections(text: string): WorkSection[] {
  const lines = text.split('\n');
  const sections: WorkSection[] = [];
  let index = 0;
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)/);
    if (match) {
      sections.push({ index: index++, title: match[1].trim(), content: '', status: 'pending' });
    }
  }
  return sections.length > 0 ? sections : [
    { index: 0, title: 'Introdução', content: '', status: 'pending' },
    { index: 1, title: 'Desenvolvimento', content: '', status: 'pending' },
    { index: 2, title: 'Conclusão', content: '', status: 'pending' },
    { index: 3, title: 'Referências Bibliográficas', content: '', status: 'pending' },
  ];
}
