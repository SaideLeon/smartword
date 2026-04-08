// src/lib/work/service.ts
// Operações CRUD para sessões de trabalho escolar.
// Usa o cliente Supabase autenticado (via cookies) para que o RLS funcione.

import { createClient, requireUserId } from '@/lib/supabase';
import type { WorkSection, WorkSessionRecord } from './types';
import type { CoverData } from '@/lib/docx/cover-types';

export async function createWorkSession(topic: string): Promise<WorkSessionRecord> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('work_sessions')
    .insert({ topic, status: 'outline_pending', user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WorkSessionRecord;
}

export async function getWorkSession(id: string): Promise<WorkSessionRecord | null> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('work_sessions')
    .select()
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as WorkSessionRecord | null;
}

export async function listWorkSessions(): Promise<WorkSessionRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('work_sessions')
    .select('id, topic, status, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []) as WorkSessionRecord[];
}

export async function saveWorkOutlineDraft(id: string, outline: string): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { error } = await supabase
    .from('work_sessions')
    .update({ outline_draft: outline })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function approveWorkOutline(id: string, outline: string): Promise<WorkSessionRecord> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const sections = extractSections(outline);

  const { data, error } = await supabase
    .from('work_sessions')
    .update({
      outline_draft:    outline,
      outline_approved: outline,
      sections,
      status: 'outline_approved',
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WorkSessionRecord;
}

export async function saveWorkResearchBrief(
  id: string,
  keywords: string[],
  brief: string,
): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { error } = await supabase
    .from('work_sessions')
    .update({
      research_keywords:      keywords,
      research_brief:         brief,
      research_generated_at:  new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function saveWorkSectionContent(
  id: string,
  index: number,
  content: string,
  currentSections: WorkSection[],
): Promise<WorkSessionRecord> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const sections = currentSections.map(section =>
    section.index === index
      ? { ...section, content, status: 'developed' as const }
      : section,
  );

  const status = sections.every(section => section.status !== 'pending') ? 'completed' : 'in_progress';

  const { data, error } = await supabase
    .from('work_sessions')
    .update({ sections, status })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WorkSessionRecord;
}

export async function markWorkSectionInserted(
  id: string,
  index: number,
): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { data: session, error: fetchError } = await supabase
    .from('work_sessions')
    .select('sections')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !session) throw new Error('Sessão não encontrada');

  const currentSections: WorkSection[] = Array.isArray(session.sections) ? session.sections as WorkSection[] : [];
  const sections = currentSections.map(section =>
    section.index === index
      ? { ...section, status: 'inserted' as const }
      : section,
  );

  const { error } = await supabase
    .from('work_sessions')
    .update({ sections })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function saveWorkCoverData(
  id: string,
  coverData: CoverData | null,
): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { error } = await supabase
    .from('work_sessions')
    .update({ cover_data: coverData })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function deleteWorkSession(id: string): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { error } = await supabase
    .from('work_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

// ── Normalização de título para comparação ────────────────────────────────────

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

// ── Secções fixas de fallback ─────────────────────────────────────────────────

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

// ── Extracção de secções do esboço Markdown ───────────────────────────────────

function extractSections(outline: string): WorkSection[] {
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
    } else {
      sections.push({ index, title: raw[i].title, content: '', status: 'pending' });
      index++;
    }
  }

  return sections.length > 0 ? sections : buildFallbackSections();
}
