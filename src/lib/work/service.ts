import { supabase } from '@/lib/supabase';
import type { WorkSection, WorkSessionRecord } from './types';

export async function createWorkSession(topic: string): Promise<WorkSessionRecord> {
  const { data, error } = await supabase
    .from('work_sessions')
    .insert({ topic, status: 'outline_pending' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WorkSessionRecord;
}

export async function getWorkSession(id: string): Promise<WorkSessionRecord | null> {
  const { data, error } = await supabase
    .from('work_sessions')
    .select()
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as WorkSessionRecord | null;
}

export async function listWorkSessions(): Promise<WorkSessionRecord[]> {
  const { data, error } = await supabase
    .from('work_sessions')
    .select('id, topic, status, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []) as WorkSessionRecord[];
}

export async function saveWorkOutlineDraft(id: string, outline: string): Promise<void> {
  const { error } = await supabase
    .from('work_sessions')
    .update({ outline_draft: outline })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function approveWorkOutline(id: string, outline: string): Promise<WorkSessionRecord> {
  const sections = extractSections(outline);

  const { data, error } = await supabase
    .from('work_sessions')
    .update({
      outline_draft: outline,
      outline_approved: outline,
      sections,
      status: 'outline_approved',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WorkSessionRecord;
}

export async function saveWorkSectionContent(
  id: string,
  index: number,
  content: string,
  currentSections: WorkSection[],
): Promise<WorkSessionRecord> {
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
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as WorkSessionRecord;
}

export async function markWorkSectionInserted(
  id: string,
  index: number,
  currentSections: WorkSection[],
): Promise<void> {
  const sections = currentSections.map(section =>
    section.index === index
      ? { ...section, status: 'inserted' as const }
      : section,
  );

  const { error } = await supabase
    .from('work_sessions')
    .update({ sections })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteWorkSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('work_sessions')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

function extractSections(outline: string): WorkSection[] {
  const lines = outline.split('\n');
  const raw: { title: string; level: 2 | 3 }[] = [];

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);

    if (h2) raw.push({ title: h2[1].trim(), level: 2 });
    else if (h3) raw.push({ title: h3[1].trim(), level: 3 });
  }

  if (raw.length === 0) {
    return [
      'Índice',
      'Introdução',
      'Objectivos e Metodologia',
      'Desenvolvimento Teórico',
      'Conclusão',
      'Referências Bibliográficas',
    ].map((title, index) => ({ index, title, content: '', status: 'pending' as const }));
  }

  const sections: WorkSection[] = [];
  let index = 0;

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].level === 2) {
      const nextIsH3 = i + 1 < raw.length && raw[i + 1].level === 3;
      if (!nextIsH3) {
        sections.push({ index, title: raw[i].title, content: '', status: 'pending' });
        index++;
      }
      continue;
    }

    sections.push({ index, title: raw[i].title, content: '', status: 'pending' });
    index++;
  }

  return sections;
}
