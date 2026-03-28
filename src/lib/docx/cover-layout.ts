import { convertMillimetersToTwip } from 'docx';
import type { CoverData, CoverLayoutMetrics } from './cover-types';

// ── Dimensões de página A4 ────────────────────────────────────────────────────

const PAGE_HEIGHT_MM   = 297;
const MARGIN_TOP_MM    = 30;
const MARGIN_BOTTOM_MM = 20;

/** Altura útil do conteúdo em twips (1 twip = 1/1440 polegada = 1/20 pt) */
const CONTENT_HEIGHT = convertMillimetersToTwip(PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM);

/**
 * Buffer de segurança em twips — absorve micro-espaçamentos internos do Word
 * que as constantes LINE_*PT não conseguem prever com exactidão.
 * 300 twips ≈ 5mm ≈ uma linha a 12pt. Aumenta em 100 se ainda houver overflow.
 */
const LAYOUT_SAFETY_BUFFER = 300;

/**
 * Altura efectiva usada nos cálculos de gap — ligeiramente menor que
 * CONTENT_HEIGHT para garantir que o conteúdo não transborda na renderização real.
 */
const EFFECTIVE_CONTENT_HEIGHT = CONTENT_HEIGHT - LAYOUT_SAFETY_BUFFER;

// ── Alturas estimadas dos elementos (twips) ───────────────────────────────────
//
//  Cada valor inclui a altura visual da linha E o espaçamento "after" definido
//  no builder, para que a soma coincida com o espaço real consumido em página.
//
//  Linha 12pt espaçamento simples + 80 twips after  ≈ 270 + 80 = 350
//  Linha 14pt espaçamento simples + 100 twips after ≈ 315 + 100 = 415
//  Logo 35mm + 120 twips after                      ≈ 1984 + 120 = 2104

const LINE_12PT    = 270;  // altura visual de uma linha a 12pt (single-space)
const LINE_14PT    = 315;  // altura visual de uma linha a 14pt (single-space)
const LINE_10PT    = 225;  // altura visual de uma linha a 10pt (single-space)

const AFTER_LOGO        = 120;
const AFTER_INSTITUTION = 100;
const AFTER_METADATA    = 120;  // espaçamento após Curso e Disciplina (o Tema não tem)
const AFTER_GROUP       = 120;
const AFTER_MEMBER      = 80;

/** Altura do logo na página (35mm de imagem + padding depois) */
const LOGO_BLOCK = convertMillimetersToTwip(35) + AFTER_LOGO;

/** Número de zonas de espaçamento entre blocos */
const N_GAPS = 3;

/** Gap mínimo aceitável (15mm) — abaixo disso a capa parece comprimida */
const MIN_GAP = convertMillimetersToTwip(15);

// ── Estimativa de linhas do nome da instituição ───────────────────────────────
//
//  Times New Roman 14pt bold, espaço útil 160mm ≈ 454pt.
//  Largura média por caracter (mixed case bold) ≈ 7pt → ~65 chars/linha.
//  Valor conservador: 60 chars para absorver variações de renderização.

const INSTITUTION_CHARS_PER_LINE = 60;

function estimateInstitutionLines(institution: string): 1 | 2 {
  return institution.length > INSTITUTION_CHARS_PER_LINE ? 2 : 1;
}

// ── Estimativa de linhas do resumo (contra-capa) ──────────────────────────────
//
//  O resumo ocupa metade da largura útil (80mm ≈ 227pt).
//  12pt mixed case → avg 6pt/char → ~38 chars por linha.

const ABSTRACT_CHARS_PER_LINE = 38;

function estimateAbstractLines(abstract: string): number {
  return Math.ceil(abstract.length / ABSTRACT_CHARS_PER_LINE) + 1; // +1 margem
}

// ── Cálculo do conteúdo fixo (sem gaps) ──────────────────────────────────────

function fixedContentHeight(
  data: CoverData,
  opts: {
    hasLogo: boolean;
    institutionLines: 1 | 2;
    memberLineHeight: number; // altura total por membro (linha + spacing after)
    withAbstract: boolean;
  },
): number {
  const {
    hasLogo, institutionLines, memberLineHeight, withAbstract,
  } = opts;

  const logoBlock         = hasLogo ? LOGO_BLOCK : 0;
  const institutionBlock  = institutionLines * LINE_14PT + AFTER_INSTITUTION;
  const delegationBlock   = data.delegation ? LINE_12PT : 0;

  // Metadados: Curso + After, Disciplina + After, Tema (sem after)
  const metadataBlock     = LINE_12PT + AFTER_METADATA + LINE_12PT + AFTER_METADATA + LINE_12PT;

  const groupBlock        = data.group ? LINE_12PT + AFTER_GROUP : 0;
  const membersBlock      = data.members.length * memberLineHeight;

  const abstractBlock     = (withAbstract && data.abstract)
    ? estimateAbstractLines(data.abstract) * LINE_12PT + 200 // 200 = spacing before
    : 0;

  const dateBlock = LINE_12PT;

  return (
    logoBlock +
    institutionBlock +
    delegationBlock +
    metadataBlock +
    groupBlock +
    membersBlock +
    abstractBlock +
    dateBlock
  );
}

// ── Cálculo de gaps adaptativos ───────────────────────────────────────────────

function computeGaps(
  data: CoverData,
  opts: { hasLogo: boolean; withAbstract: boolean },
): { metrics: CoverLayoutMetrics; memberLineHeight: number } {
  const { hasLogo, withAbstract } = opts;
  const institutionLines = estimateInstitutionLines(data.institution);

  // ── Tentativa 1: 12pt nos membros ────────────────────────────────────────
  const memberLineHeight12 = LINE_12PT + AFTER_MEMBER;
  const fixed12 = fixedContentHeight(data, {
    hasLogo, institutionLines, memberLineHeight: memberLineHeight12, withAbstract,
  });
  const remaining12 = EFFECTIVE_CONTENT_HEIGHT - fixed12;
  const gap12 = Math.floor(remaining12 / N_GAPS);

  if (gap12 >= MIN_GAP) {
    return {
      memberLineHeight: memberLineHeight12,
      metrics: {
        gap1: gap12,
        gap2: gap12,
        gap3: gap12,
        memberFontSizeHalfPt: 24, // 12pt
        teacherLineIndex: withAbstract
          ? Math.floor(data.members.length / 2)
          : data.members.length - 1,
        hasOverflow: false,
      },
    };
  }

  // ── Tentativa 2: 10pt nos membros (fallback) ──────────────────────────────
  const memberLineHeight10 = LINE_10PT + AFTER_MEMBER;
  const fixed10 = fixedContentHeight(data, {
    hasLogo, institutionLines, memberLineHeight: memberLineHeight10, withAbstract,
  });
  const remaining10 = EFFECTIVE_CONTENT_HEIGHT - fixed10;
  const gap10 = Math.floor(remaining10 / N_GAPS);

  const effectiveGap = Math.max(gap10, convertMillimetersToTwip(8)); // mínimo absoluto

  return {
    memberLineHeight: memberLineHeight10,
    metrics: {
      gap1: effectiveGap,
      gap2: effectiveGap,
      gap3: effectiveGap,
      memberFontSizeHalfPt: 20, // 10pt
      teacherLineIndex: withAbstract
        ? Math.floor(data.members.length / 2)
        : data.members.length - 1,
      hasOverflow: gap10 < 0,
    },
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Calcula o layout adaptativo para a CAPA (com logo opcional).
 * O docente aparece na linha do último membro.
 */
export function calculateCoverLayout(data: CoverData): CoverLayoutMetrics {
  const { metrics } = computeGaps(data, {
    hasLogo: !!data.logoBase64,
    withAbstract: false,
  });
  return metrics;
}

/**
 * Calcula o layout adaptativo para a CONTRA-CAPA (sem logo, com resumo opcional).
 * O docente aparece na linha do membro central.
 */
export function calculateBackCoverLayout(data: CoverData): CoverLayoutMetrics {
  const { metrics } = computeGaps(data, {
    hasLogo: false,
    withAbstract: true,
  });
  return metrics;
}
