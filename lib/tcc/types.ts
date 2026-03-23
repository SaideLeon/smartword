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
}
