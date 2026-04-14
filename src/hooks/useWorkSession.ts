'use client';

// hooks/useWorkSession.ts  — versão com agente revisor de 2 passes
//
// NOVIDADES vs versão anterior:
//   - DevelopPhase: 'idle' | 'drafting' | 'reviewing' | 'refining'
//   - reviewMeta: { sourceCount, usedWeb, ragCount } por ciclo de desenvolvimento
//   - sourceEnhancedSections: Set<number> — secções que passaram pelo revisor
//   - Parsing de SSE custom events: {"type":"phase","phase":"reviewing",...}

import { useState, useCallback, useRef } from 'react';
import type { WorkSection, WorkSessionRecord } from '@/lib/work/types';

export type WorkStep =
  | 'idle'
  | 'resource_upload'
  | 'topic_input'
  | 'generating_outline'
  | 'review_outline'
  | 'outline_approved'
  | 'developing'
  | 'section_ready';

// ── Fases do desenvolvimento (2 passes + revisor) ────────────────────────────
export type DevelopPhase = 'idle' | 'drafting' | 'reviewing' | 'refining';

export interface ReviewMeta {
  sourceCount: number;
  usedWeb: boolean;
  ragCount: number;
}

// ── Helpers de normalização ───────────────────────────────────────────────────

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

function getParentTitleFromOutline(outline: string, parentNum: string): string | null {
  for (const line of outline.split('\n')) {
    const match = line.match(/^##\s+(\d+)\.?\s+(.+)/);
    if (match && match[1] === parentNum) return `${match[1]}. ${match[2].trim()}`;
  }
  return null;
}

function buildReconstructedContent(sections: WorkSection[], outline: string | null): string {
  const sorted = [...sections].filter(s => s.content.trim()).sort((a, b) => a.index - b.index);
  const parts: string[] = [];
  const insertedParentNums = new Set<string>();

  for (const section of sorted) {
    const isSubsection = /^\d+\.\d+/.test(section.title);
    const heading = isSubsection ? '###' : '##';
    const hasHeading = contentStartsWithTitle(section.content, section.title);
    const body = hasHeading ? section.content : `${heading} ${section.title}\n\n${section.content}`;

    if (isSubsection && outline) {
      const parentMatch = section.title.match(/^(\d+)\.\d+/);
      if (parentMatch) {
        const parentNum = parentMatch[1];
        if (!insertedParentNums.has(parentNum)) {
          const parentTitle = getParentTitleFromOutline(outline, parentNum);
          if (parentTitle) {
            const parentBlock = `## ${parentTitle}`;
            parts.push(parts.length === 0 ? parentBlock : `{pagebreak}\n\n${parentBlock}`);
            insertedParentNums.add(parentNum);
          }
        }
        parts.push(body);
        continue;
      }
    }
    parts.push(parts.length === 0 ? body : `{pagebreak}\n\n${body}`);
  }

  const body = parts.join('\n\n');
  return body ? `{toc}\n\n${body}` : body;
}

const FALLBACK_SECTIONS = [
  'I. Introdução',
  'II. Objectivos',
  'III. Metodologia',
  'Conclusão',
  'Referências Bibliográficas',
];

function buildFallbackSections(): WorkSection[] {
  return FALLBACK_SECTIONS.map((title, index) => ({ index, title, content: '', status: 'pending' as const }));
}

function parseOutlineSections(outline: string): WorkSection[] {
  const lines = outline.split('\n');
  const raw: { title: string; level: 2 | 3 }[] = [];

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2) { const title = h2[1].trim(); if (!isAutomaticIndex(title)) raw.push({ title, level: 2 }); }
    else if (h3) { const title = h3[1].trim(); if (!isAutomaticIndex(title)) raw.push({ title, level: 3 }); }
  }

  if (raw.length === 0) return buildFallbackSections();

  const sections: WorkSection[] = [];
  let index = 0;

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].level === 2) {
      const nextIsH3 = i + 1 < raw.length && raw[i + 1].level === 3;
      if (!nextIsH3) { sections.push({ index, title: raw[i].title, content: '', status: 'pending' }); index++; }
    } else {
      sections.push({ index, title: raw[i].title, content: '', status: 'pending' }); index++;
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
  const [uploadingRag, setUploadingRag] = useState(false);
  const [ragSources, setRagSources] = useState<Array<{
    id: string; filename: string; chunks: number; sourceType: 'reference' | 'institution_rules';
  }>>([]);

  // ── Novo estado do agente revisor ─────────────────────────────────────────
  const [developPhase, setDevelopPhase] = useState<DevelopPhase>('idle');
  const [reviewMeta, setReviewMeta] = useState<ReviewMeta | null>(null);
  const [sourceEnhancedSections, setSourceEnhancedSections] = useState<Set<number>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStep('idle');
    setSession(null);
    setStreamingText('');
    setActiveSectionIdx(null);
    setError(null);
    setRegeneratedSections(new Set());
    setRagSources([]);
    setUploadingRag(false);
    setDevelopPhase('idle');
    setReviewMeta(null);
    setSourceEnhancedSections(new Set());
  }, []);

  const startNew = useCallback(() => { setStep('topic_input'); setError(null); }, []);

  const loadSessions = useCallback(async () => {
    try { const res = await fetch('/api/work/session'); if (res.ok) setRecentSessions(await res.json()); } catch { /* ignorar */ }
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
    } catch (e: any) { setError(e.message); }
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
        body: JSON.stringify({ topic, sessionId: activeSessionId, suggestions: options?.suggestions?.trim() || undefined }),
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
          try { const json = JSON.parse(data); const delta = json.choices?.[0]?.delta?.content ?? ''; if (delta) { accumulated += delta; setStreamingText(accumulated); } } catch { /* ignorar */ }
        }
      }

      setSession(prev => prev ? { ...prev, outline_draft: accumulated, sections: parseOutlineSections(accumulated) } : prev);
      setStep('review_outline');
    } catch (e: any) {
      if (e.name !== 'AbortError') { setError(e.message); setStep('topic_input'); }
    }
  }, []);

  const submitTopic = useCallback(async (topic: string) => {
    setError(null);
    try {
      const sessionRes = await fetch('/api/work/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      if (!sessionRes.ok) throw new Error('Erro ao criar sessão');
      const newSession: WorkSessionRecord = await sessionRes.json();
      setSession(newSession);
      setStep('resource_upload');
    } catch (e: any) { setError(e.message); }
  }, []);

  const confirmResources = useCallback(async () => {
    if (!session) return;
    await generateOutline(session.topic, { sessionId: session.id });
  }, [generateOutline, session]);

  const skipResources = useCallback(async () => {
    if (!session) { setStep('topic_input'); return; }
    await generateOutline(session.topic, { sessionId: session.id });
  }, [generateOutline, session]);

  const uploadRagFiles = useCallback(async (
    files: File[], sessionId: string, sourceType: 'reference' | 'institution_rules' = 'reference',
  ) => {
    if (files.length === 0) return [];
    const MAX_TOTAL = 50 * 1024 * 1024;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL) throw new Error(`Total dos ficheiros excede 50 MB`);
    setUploadingRag(true);
    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('sourceType', sourceType);
      for (const file of files) formData.append('files[]', file);
      const res = await fetch('/api/work/rag/upload', { method: 'POST', body: formData });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error ?? 'Erro ao carregar ficheiros'); }
      const data = await res.json() as { results: Array<{ ok: boolean; filename: string; sourceId?: string; chunksStored?: number; error?: string }> };
      setRagSources(prev => [...prev, ...data.results.filter(r => r.ok && r.sourceId).map(r => ({ id: r.sourceId!, filename: r.filename, chunks: r.chunksStored ?? 0, sourceType }))]);
      return data.results;
    } finally { setUploadingRag(false); }
  }, []);

  const uploadRagFile = useCallback(async (file: File, sessionId: string, sourceType: 'reference' | 'institution_rules' = 'reference') => {
    const results = await uploadRagFiles([file], sessionId, sourceType);
    const r = results[0];
    if (!r?.ok) throw new Error(r?.error ?? 'Erro ao carregar ficheiro');
    return { ok: true, sourceId: r.sourceId, chunksStored: r.chunksStored };
  }, [uploadRagFiles]);

  const approveOutline = useCallback(async (outline: string) => {
    if (!session) return;
    try {
      const res = await fetch('/api/work/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.id, outline }) });
      if (!res.ok) throw new Error('Erro ao aprovar esboço');
      const updated: WorkSessionRecord = await res.json();
      setSession(updated);
      setStep('outline_approved');
    } catch (e: any) { setError(e.message); }
  }, [session]);

  const requestNewOutline = useCallback((suggestions?: string) => {
    if (!session) return;
    generateOutline(session.topic, { sessionId: session.id, suggestions });
  }, [generateOutline, session]);

  // ── developSection — 2 passes com agente revisor ─────────────────────────

  const developSection = useCallback(async (index: number) => {
    if (!session) return;
    const previousStatus = session.sections.find(s => s.index === index)?.status;
    const isRegeneration = previousStatus === 'developed' || previousStatus === 'inserted';

    setError(null);
    setActiveSectionIdx(index);
    setStreamingText('');
    setStep('developing');
    setDevelopPhase('drafting');
    setReviewMeta(null);

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
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);

            // ── Eventos de fase do agente revisor ─────────────────────────
            if (json.type === 'phase') {
              if (json.phase === 'reviewing') {
                setDevelopPhase('reviewing');
                // Limpa o streaming — Pass 1 não é mostrado ao utilizador
                setStreamingText('');
                accumulated = '';
              } else if (json.phase === 'refining') {
                setDevelopPhase('refining');
                setReviewMeta({
                  sourceCount: json.sourceCount ?? 0,
                  usedWeb: json.usedWeb ?? false,
                  ragCount: json.ragCount ?? 0,
                });
                // Marca secção como enriquecida se teve fontes
                if ((json.sourceCount ?? 0) > 0) {
                  setSourceEnhancedSections(prev => new Set(prev).add(index));
                }
              }
              continue;
            }

            // ── Conteúdo do Pass 2 (streaming visível) ────────────────────
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) { accumulated += delta; setStreamingText(accumulated); }
          } catch { /* ignorar */ }
        }
      }

      setSession(prev => {
        if (!prev) return prev;
        const sections = prev.sections.map(s =>
          s.index === index ? { ...s, content: accumulated, status: 'developed' as const } : s,
        );
        return { ...prev, sections, status: sections.every(s => s.status !== 'pending') ? 'completed' : 'in_progress' };
      });

      setStreamingText(accumulated);
      setDevelopPhase('idle');

      setRegeneratedSections(prev => {
        const next = new Set(prev);
        if (isRegeneration) next.add(index); else next.delete(index);
        return next;
      });

      setStep('section_ready');
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
        setStep('outline_approved');
        setDevelopPhase('idle');
      }
    }
  }, [session]);

  const insertSection = useCallback(async (
    index: number,
    onInsert: (text: string) => void,
    options?: { shouldResetEditor?: boolean; onReplace?: (text: string) => void },
  ) => {
    if (!session) return;
    const sec = session.sections[index];
    if (!sec?.content) return;

    const isSubsection = /^\d+\.\d+/.test(sec.title);
    const heading = isSubsection ? '###' : '##';
    const titleAlreadyPresent = contentStartsWithTitle(sec.content, sec.title);
    const baseText = titleAlreadyPresent ? sec.content : `${heading} ${sec.title}\n\n${sec.content}`;

    let fetchedSession: WorkSessionRecord | null = null;

    try {
      await fetch('/api/work/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'markInserted', sessionId: session.id, sectionIndex: index }),
      });

      if (options?.shouldResetEditor && options.onReplace) {
        const refreshRes = await fetch(`/api/work/session?id=${session.id}`);
        if (!refreshRes.ok) throw new Error('Erro ao sincronizar sessão regenerada');
        const refreshedSession: WorkSessionRecord = await refreshRes.json();
        fetchedSession = refreshedSession;
        const outline = refreshedSession.outline_approved ?? refreshedSession.outline_draft;
        const organizedContent = buildReconstructedContent(
          refreshedSession.sections.filter(s => s.content.trim()), outline ?? null,
        );
        options.onReplace(organizedContent);
      } else {
        onInsert(baseText);
      }
    } catch {
      if (options?.shouldResetEditor && options.onReplace) options.onReplace(baseText);
      else onInsert(baseText);
    }

    if (fetchedSession) setSession(fetchedSession);
    else setSession(prev => prev ? { ...prev, sections: prev.sections.map(s => s.index === index ? { ...s, status: 'inserted' as const } : s) } : prev);

    setRegeneratedSections(prev => { const next = new Set(prev); next.delete(index); return next; });
    setStep('outline_approved');
    setActiveSectionIdx(null);
  }, [session]);

  const isSectionRegenerated = useCallback((index: number) => regeneratedSections.has(index), [regeneratedSections]);

  const isSourceEnhanced = useCallback((index: number) => sourceEnhancedSections.has(index), [sourceEnhancedSections]);

  const backToOutline = useCallback(() => { setStep('outline_approved'); setActiveSectionIdx(null); }, []);

  const progressPct = session?.sections.length
    ? Math.round(session.sections.filter(s => s.status !== 'pending').length / session.sections.length * 100)
    : 0;

  return {
    step, session, streamingText, activeSectionIdx, error, progressPct, recentSessions,
    developPhase, reviewMeta, isSourceEnhanced,
    reset, startNew, submitTopic, approveOutline, requestNewOutline,
    developSection, insertSection, backToOutline, loadSessions, resumeSession,
    isSectionRegenerated, ragSources, uploadingRag, uploadRagFile, uploadRagFiles,
    skipResources, confirmResources,
  };
}
