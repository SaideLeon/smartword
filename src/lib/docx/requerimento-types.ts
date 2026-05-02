// src/lib/docx/requerimento-types.ts
// Tipos de dados para geração de requerimentos académicos formais.
// Estrutura baseada no modelo oficial mozambicano.

export interface RequerimentoData {
  // ── Cabeçalho institucional ───────────────────────────────────────────────
  includeRepublica: boolean;
  institution: string;          // ex: "INSTITUTO INDUSTRIAL E COMERCIAL 1º DE MAIO"
  courseHeader: string;         // ex: "Curso de Contabilidade, nível CV3"
  city: string;                 // ex: "Quelimane"
  province?: string;            // ex: "Zambézia"
  logoBase64?: string;
  logoMediaType?: 'image/png' | 'image/jpeg';

  // ── Destinatário ──────────────────────────────────────────────────────────
  recipientTitle: string;       // ex: "Exmo. Sr. Formador"
  recipientName: string;        // ex: "Lucas Maribeu"
  recipientModule: string;      // ex: "Módulo de Projecto Integrado"
  recipientCity: string;

  // ── Dados pessoais do requerente ──────────────────────────────────────────
  fullName: string;
  fatherName: string;
  motherName: string;
  birthDate: string;            // ex: "15 de Novembro de 2004"
  birthPlace: string;           // ex: "Tete"
  docNumber: string;            // ex: "040107977967N"
  docIssueDate: string;         // ex: "26 de Agosto de 2024"
  docIssuePlace: string;        // ex: "cidade de Quelimane"

  // ── Dados académicos ──────────────────────────────────────────────────────
  courseName: string;           // ex: "Contabilidade"
  courseLevel: string;          // ex: "CV3"
  turma: string;                // ex: "B"

  // ── Propósito do pedido ───────────────────────────────────────────────────
  requestPurpose: string;       // ex: "a aprovação do meu projecto para o Módulo de Projecto Integrado"

  // ── Corpo do requerimento (secções numeradas) ─────────────────────────────
  section1Title: string;
  section1Content: string;
  section2Title: string;
  section2Content: string;
  section3Title: string;
  section3Content: string;

  // ── Assinatura ────────────────────────────────────────────────────────────
  submissionCity: string;
  submissionDate: string;       // ex: "29 de Abril de 2026"
  requerenteRole: string;       // ex: "Formando · Curso de Contabilidade CV3 · Turma B"
}

// ── Draft do formulário (inclui campos de UI extra) ──────────────────────────

export interface RequerimentoFormDraft {
  includeRepublica: boolean;
  institution: string;
  courseHeader: string;
  city: string;
  province: string;
  logoBase64: string;
  logoMediaType: 'image/png' | 'image/jpeg' | '';

  recipientTitle: string;
  recipientName: string;
  recipientModule: string;
  recipientCity: string;

  fullName: string;
  fatherName: string;
  motherName: string;
  birthDate: string;
  birthPlace: string;
  docNumber: string;
  docIssueDate: string;
  docIssuePlace: string;

  courseName: string;
  courseLevel: string;
  turma: string;

  requestPurpose: string;

  section1Title: string;
  section1Content: string;
  section2Title: string;
  section2Content: string;
  section3Title: string;
  section3Content: string;

  submissionCity: string;
  submissionDate: string;
  requerenteRole: string;
}

export const REQUERIMENTO_FORM_INITIAL: RequerimentoFormDraft = {
  includeRepublica: true,
  institution: '',
  courseHeader: '',
  city: '',
  province: '',
  logoBase64: '',
  logoMediaType: '',

  recipientTitle: 'Exmo. Sr.',
  recipientName: '',
  recipientModule: '',
  recipientCity: '',

  fullName: '',
  fatherName: '',
  motherName: '',
  birthDate: '',
  birthPlace: '',
  docNumber: '',
  docIssueDate: '',
  docIssuePlace: '',

  courseName: '',
  courseLevel: '',
  turma: '',

  requestPurpose: '',

  section1Title: '1. Identificação do Projecto',
  section1Content: '',
  section2Title: '2. Justificativa e Viabilidade do Projecto',
  section2Content: '',
  section3Title: '3. Do Pedido',
  section3Content: '',

  submissionCity: '',
  submissionDate: '',
  requerenteRole: '',
};
