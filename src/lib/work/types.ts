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
}
