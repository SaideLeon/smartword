// lib/tcc/types.ts  (versão actualizada — substitui o ficheiro original)
import type { CoverData } from '@/lib/docx/cover-types';

export type TccSectionStatus = 'pending' | 'developed' | 'inserted';

export interface TccSection {
  index:   number;
  title:   string;    // ex: "2. Revisão de Literatura"
  status:  TccSectionStatus;
  content: string;    // texto desenvolvido pela IA
}

export type TccStatus =
  | 'outline_pending'    // à espera de aprovação do esboço
  | 'outline_approved'   // esboço aprovado, pronto para desenvolver
  | 'in_progress'        // a desenvolver secções
  | 'completed';         // todas as secções desenvolvidas

export interface TccSession {
  id:               string;
  created_at:       string;
  updated_at:       string;
  topic:            string;
  outline_draft:    string | null;
  outline_approved: string | null;   // âncora imutável
  sections:         TccSection[];
  status:           TccStatus;

  // ── Campos de compressão de contexto ──────────────────────────────────────
  context_summary:      string | null;   // resumo comprimido das secções antigas
  summary_covers_up_to: number | null;   // índice da última secção resumida
  summary_updated_at:   string | null;   // quando foi gerado
  total_tokens_estimate: number;         // estimativa acumulada de tokens
  research_keywords: string[] | null;
  research_brief: string | null;
  research_generated_at: string | null;
  /** Dados de capa persistidos — restaurados automaticamente ao retomar a sessão. */
  cover_data: CoverData | null;
}

// ── Tipos auxiliares para o sistema de compressão ─────────────────────────

/**
 * Decide se é necessário comprimir o contexto antes de desenvolver uma secção.
 * Threshold: quando há 3 ou mais secções desenvolvidas que não estão no resumo.
 */
export interface CompressionDecision {
  shouldCompress: boolean;
  developedButUncompressed: TccSection[];
  compressedSections: TccSection[];      // já no resumo (só o título disponível)
  recentSections: TccSection[];          // as 2 mais recentes, sempre completas
}

/**
 * Contexto optimizado enviado à IA para desenvolvimento de uma secção.
 * Em vez do conteúdo completo de todas as secções anteriores,
 * usa o resumo comprimido + as 2 secções mais recentes completas.
 */
export interface OptimisedContext {
  outline: string;
  contextSummary: string | null;        // resumo das secções antigas
  recentSectionsContent: string;        // secções recentes em formato completo
  compressionActive: boolean;           // indica se compressão está a ser usada
}
