import type { CoverData } from '@/lib/docx/cover-types';

export type WorkSectionStatus = 'pending' | 'developed' | 'inserted';

export interface WorkSection {
  index: number;
  title: string;
  content: string;
  status: WorkSectionStatus;
}

export type WorkStatus = 'outline_pending' | 'outline_approved' | 'in_progress' | 'completed';

export interface WorkSessionRecord {
  id: string;
  created_at: string;
  updated_at: string;
  topic: string;
  outline_draft: string | null;
  outline_approved: string | null;
  sections: WorkSection[];
  status: WorkStatus;
  research_keywords: string[] | null;
  research_brief: string | null;
  research_generated_at: string | null;
  /** Dados de capa persistidos — restaurados automaticamente ao retomar a sessão. */
  cover_data: CoverData | null;
  rag_enabled?: boolean;
  rag_ficha?: {
    autores?: string[];
    obras?: string[];
    conceitos_chave?: string[];
    normas_institucionais?: string[];
    resumo_fontes?: string;
  } | null;
  institution_rules?: string | null;
}
