// ── Dados de entrada para geração de capa ────────────────────────────────────

export interface CoverData {
  /** Nome completo da instituição (ex: "INSTITUTO INDUSTRIAL E COMERCIAL 1º DE MAIO") */
  institution: string;

  /** Delegação ou localização (ex: "QUELIMANE") */
  delegation?: string;

  /**
   * Logo em base64 — aceita string pura ou data URL (data:image/png;base64,...).
   * Quando ausente, a capa começa directamente pelo nome da instituição.
   */
  logoBase64?: string;
  logoMediaType?: 'image/png' | 'image/jpeg';

  /** Metadados do trabalho */
  course: string;   // ex: "CONTABILIDADE CV3"
  subject: string;  // ex: "Preencher os modelos obrigatórios para o pagamento das obrigações sociais e legais"
  theme: string;    // ex: "Conhecer os Princípios Básicos da Legislação Comercial, Laboral e Fiscal em Moçambique"

  /** Identificação do grupo (ex: "3º Grupo") */
  group?: string;

  /** Lista de nomes dos membros, por ordem de apresentação */
  members: string[];

  /** Nome do docente */
  teacher: string;

  /** Localidade e data (ex: "Quelimane", "Março de 2026") */
  city: string;
  date: string;

  /**
   * Resumo/abstract — aparece APENAS na contra-capa,
   * alinhado à direita (recuo de ~50% da largura útil).
   */
  abstract?: string;
}

// ── Resultado dos cálculos de layout ─────────────────────────────────────────

export interface CoverLayoutMetrics {
  /** Espaçamento (twips) entre o bloco de cabeçalho e o bloco de metadados */
  gap1: number;
  /** Espaçamento (twips) entre o bloco de metadados e o bloco de membros */
  gap2: number;
  /** Espaçamento (twips) entre o bloco de membros e a data */
  gap3: number;

  /** Tamanho de fonte dos membros em meios-pontos (24 = 12pt, 20 = 10pt) */
  memberFontSizeHalfPt: number;

  /** Índice (base 0) do membro cuja linha exibe o docente à direita */
  teacherLineIndex: number;

  /**
   * true se o conteúdo estimado exceder a página mesmo após o fallback de fonte.
   * A capa ainda é gerada, mas o utilizador deve rever manualmente.
   */
  hasOverflow: boolean;
}
