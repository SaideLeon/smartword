// src/lib/tcc/service.ts
// Operações CRUD para sessões TCC.
// Usa o cliente Supabase autenticado (via cookies) para que o RLS funcione.

import { createClient, requireUserId } from '@/lib/supabase';
import type { TccSession, TccSection } from './types';
import type { CoverData } from '@/lib/docx/cover-types';

// ─── Criar nova sessão ────────────────────────────────────────────────────────
export async function createSession(topic: string): Promise<TccSession> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('tcc_sessions')
    .insert({ topic, status: 'outline_pending', user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as TccSession;
}

// ─── Buscar sessão por ID ─────────────────────────────────────────────────────
export async function getSession(id: string): Promise<TccSession | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tcc_sessions')
    .select()
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as TccSession | null;
}

// ─── Listar sessões recentes do utilizador actual ─────────────────────────────
export async function listSessions(): Promise<TccSession[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tcc_sessions')
    .select('id, topic, status, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []) as TccSession[];
}

// ─── Guardar esboço rascunho ──────────────────────────────────────────────────
export async function saveOutlineDraft(id: string, outline: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('tcc_sessions')
    .update({ outline_draft: outline })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── Aprovar esboço e extrair secções ────────────────────────────────────────
export async function approveOutline(
  id: string,
  outline: string,
): Promise<TccSession> {
  const supabase = await createClient();
  const sections = extractSections(outline);

  const { data, error } = await supabase
    .from('tcc_sessions')
    .update({
      outline_approved: outline,
      outline_draft:    outline,
      sections,
      status: 'outline_approved',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as TccSession;
}

// ─── Guardar ficha técnica de pesquisa ───────────────────────────────────────
export async function saveTccResearchBrief(
  id: string,
  keywords: string[],
  brief: string,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('tcc_sessions')
    .update({
      research_keywords:      keywords,
      research_brief:         brief,
      research_generated_at:  new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── Guardar conteúdo de uma secção desenvolvida ─────────────────────────────
export async function saveSectionContent(
  id:              string,
  index:           number,
  content:         string,
  currentSections: TccSection[],
): Promise<TccSession> {
  const supabase = await createClient();

  const updated = currentSections.map(s =>
    s.index === index
      ? { ...s, content, status: 'developed' as const }
      : s,
  );

  const allDone = updated.every(s => s.status !== 'pending');
  const status  = allDone ? 'completed' : 'in_progress';

  const { data, error } = await supabase
    .from('tcc_sessions')
    .update({ sections: updated, status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as TccSession;
}

// ─── Marcar secção como inserida no editor ────────────────────────────────────
export async function markSectionInserted(
  id:              string,
  index:           number,
  currentSections: TccSection[],
): Promise<void> {
  const supabase = await createClient();

  const updated = currentSections.map(s =>
    s.index === index ? { ...s, status: 'inserted' as const } : s,
  );

  const { error } = await supabase
    .from('tcc_sessions')
    .update({ sections: updated })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── Persistir dados de capa (incluindo abstract) ───────────────────────────
export async function saveTccCoverData(
  id: string,
  coverData: CoverData | null,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('tcc_sessions')
    .update({ cover_data: coverData })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── Eliminar sessão ──────────────────────────────────────────────────────────
export async function deleteSession(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('tcc_sessions')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── Utilitário: extrair secções accionáveis do esboço Markdown ───────────────
function extractSections(outline: string): TccSection[] {
  const lines = outline.split('\n');
  const raw: { title: string; level: 2 | 3 }[] = [];
  const sections: TccSection[] = [];
  let index = 0;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);

    if (h2) raw.push({ title: h2[1].trim(), level: 2 });
    else if (h3) raw.push({ title: h3[1].trim(), level: 3 });
  }

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].level === 2) {
      const nextIsH3 = i + 1 < raw.length && raw[i + 1].level === 3;
      if (!nextIsH3) {
        sections.push({ index, title: raw[i].title, status: 'pending', content: '' });
        index++;
      }
      continue;
    }

    sections.push({ index, title: raw[i].title, status: 'pending', content: '' });
    index++;
  }

  // Fallback: usa # de nível 1-3 se não encontrar ## ou ###
  if (sections.length === 0) {
    for (const line of lines) {
      const match = line.match(/^#{1,3}\s+(.+)/);
      if (match) {
        sections.push({ index, title: match[1].trim(), status: 'pending', content: '' });
        index++;
      }
    }
  }

  return sections;
}
