'use client';

import { useState, useCallback, useRef } from 'react';

export type WorkStep =
  | 'idle'
  | 'topic_input'
  | 'generating_outline'
  | 'review_outline'
  | 'outline_approved'
  | 'developing'
  | 'section_ready';

export interface WorkSection {
  index: number;
  title: string;
  content: string;
  status: 'pending' | 'developed' | 'inserted';
}

export interface WorkSession {
  topic: string;
  outline: string;
  sections: WorkSection[];
}

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
 *
 * Regra:
 *  - Cabeçalhos ## sem subsecções ### imediatamente a seguir → secção própria
 *  - Cabeçalhos ## com subsecções ### a seguir → ignorados (substituídos pelas subsecções)
 *  - Cabeçalhos ### → sempre secção individual
 *
 * Resultado típico para "Desenvolvimento Teórico":
 *   1. Índice
 *   2. Introdução
 *   3. Objectivos e Metodologia
 *   4.1 Conceito de correio electrónico   ← subsecção individual
 *   4.2 História do correio electrónico   ← subsecção individual
 *   5. Conclusão
 *   6. Referências Bibliográficas
 */
function parseOutlineSections(outline: string): WorkSection[] {
  const lines = outline.split('\n');

  // 1ª passagem: recolher todos os ## e ###
  const raw: { title: string; level: 2 | 3 }[] = [];
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2) raw.push({ title: h2[1].trim(), level: 2 });
    else if (h3) raw.push({ title: h3[1].trim(), level: 3 });
  }

  if (raw.length === 0) return buildInitialSections();

  // 2ª passagem: se um ## é seguido por ###, salta o ##
  const sections: WorkSection[] = [];
  let index = 0;

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].level === 2) {
      const nextIsH3 = i + 1 < raw.length && raw[i + 1].level === 3;
      if (!nextIsH3) {
        // Secção principal sem subsecções — adicionar normalmente
        sections.push({ index, title: raw[i].title, content: '', status: 'pending' });
        index++;
      }
      // Se tem subsecções logo a seguir, o ## é apenas contentor — ignorar
    } else {
      // Subsecção ### → sempre individual
      sections.push({ index, title: raw[i].title, content: '', status: 'pending' });
      index++;
    }
  }

  return sections.length > 0 ? sections : buildInitialSections();
}

export function useWorkSession() {
  const [step, setStep]                     = useState<WorkStep>('idle');
  const [session, setSession]               = useState<WorkSession | null>(null);
  const [streamingText, setStreamingText]   = useState('');
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const [error, setError]                   = useState<string | null>(null);
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

  // Gera o esboço via IA
  const submitTopic = useCallback(async (topic: string) => {
    setError(null);
    setStreamingText('');
    setStep('generating_outline');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/work/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error('Erro ao gerar esboço');

      const reader  = res.body!.getReader();
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
            const json  = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) { accumulated += delta; setStreamingText(accumulated); }
          } catch { /* ignorar */ }
        }
      }

      setSession({
        topic,
        outline: accumulated,
        // Usar o esboço gerado para criar secções individualizadas (incluindo subsecções)
        sections: parseOutlineSections(accumulated),
      });
      setStep('review_outline');
    } catch (e: any) {
      if (e.name !== 'AbortError') { setError(e.message); setStep('topic_input'); }
    }
  }, []);

  const approveOutline = useCallback(() => {
    setStep('outline_approved');
  }, []);

  const requestNewOutline = useCallback(() => {
    if (!session) return;
    submitTopic(session.topic);
  }, [session, submitTopic]);

  // Desenvolve uma secção
  const developSection = useCallback(async (index: number) => {
    if (!session) return;
    setError(null);
    setActiveSectionIdx(index);
    setStreamingText('');
    setStep('developing');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const previousSections = session.sections
        .filter(s => s.index < index && s.content)
        .map(s => ({ title: s.title, content: s.content }));

      const res = await fetch('/api/work/develop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: session.topic,
          outline: session.outline,
          section: session.sections[index],
          previousSections,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error('Erro ao desenvolver secção');

      const reader  = res.body!.getReader();
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
            const json  = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) { accumulated += delta; setStreamingText(accumulated); }
          } catch { /* ignorar */ }
        }
      }

      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map(s =>
            s.index === index ? { ...s, content: accumulated, status: 'developed' as const } : s
          ),
        };
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

    // Subsecções (ex: "4.1 Conceito de...") inseridas com ### em vez de ##
    const isSubsection = /^\d+\.\d+/.test(sec.title);
    const heading = isSubsection ? '###' : '##';
    onInsert(`${heading} ${sec.title}\n\n${sec.content}`);

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

  const backToOutline = useCallback(() => {
    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, []);

  const progressPct = session?.sections.length
    ? Math.round(
        session.sections.filter(s => s.status !== 'pending').length /
        session.sections.length * 100
      )
    : 0;

  return {
    step, session, streamingText, activeSectionIdx, error, progressPct,
    reset, startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline,
  };
}
