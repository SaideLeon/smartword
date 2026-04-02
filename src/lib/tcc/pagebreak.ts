// src/lib/tcc/pagebreak.ts
//
// ── REGRA DE PAGEBREAK PARA O MODO TCC ─────────────────────────────────────
//
// O conteúdo guardado no Supabase é SEMPRE puro — sem {pagebreak}.
// Os {pagebreak} são adicionados APENAS aqui, no momento de inserção no editor.
//
// CLASSIFICAÇÃO DE SECÇÕES TCC:
//
//   GRUPO A — Secções estruturais independentes (sempre pagebreak antes, se não for a 1ª)
//     Introdução, Justificativa/Justificação, Objectivos, Metodologia,
//     Revisão de Literatura/Referencial Teórico, Resultados e Discussão,
//     Conclusão/Considerações Finais, Referências Bibliográficas
//
//   GRUPO B — Subsecções numéricas (ex: 1.1, 2.3, III.1)
//     Sem pagebreak individual — fluem dentro do bloco pai.
//     A PRIMEIRA subsecção de um grupo recebe o heading pai + pagebreak antes do bloco.
//     As seguintes (1.2, 1.3…) fluem sem pagebreak.
//
//   GRUPO C — Capítulos de desenvolvimento numerados (ex: "1. Desenvolvimento Teórico")
//     Nunca são accionáveis directamente (filtrados pelo extractSections).
//     Inseridos automaticamente como heading pai da primeira subsecção do grupo.
//
// INVARIANTE:
//   - Primeira secção inserida num editor vazio → NUNCA tem {pagebreak} antes.
//   - Todas as outras secções principais → TÊM {pagebreak} antes.
//   - Subsecções seguintes ao heading pai → SEM pagebreak.

import type { TccSection } from '@/lib/tcc/types';

// ── Normalização de título ────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')     // remove diacríticos
    .replace(/^[ivxlcdm]+\.\s*/i, '')    // remove I., II., III. (algarismos romanos)
    .replace(/^\d+(\.\d+)?\.\s*/, '')    // remove 1., 1.1.
    .replace(/[^a-z0-9\s]/g, '')         // remove pontuação
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Detector de subsecção numérica ────────────────────────────────────────────

export function isSubsection(title: string): boolean {
  // Padrões: "1.1", "1.1.", "2.3 Título", "III.1 Título"
  return /^\d+\.\d+|^[ivxlcdm]+\.\d+/i.test(title.trim());
}

// ── Extractor do número do grupo pai ─────────────────────────────────────────

export function getParentGroupNumber(title: string): string | null {
  // "1.1 Foo" → "1", "2.3 Bar" → "2"
  const numericMatch = title.match(/^(\d+)\.\d+/);
  if (numericMatch) return numericMatch[1];
  // "III.1 Foo" → "III"
  const romanMatch = title.match(/^([ivxlcdm]+)\.\d+/i);
  if (romanMatch) return romanMatch[1].toUpperCase();
  return null;
}

// ── Extractor de heading pai a partir do esboço ───────────────────────────────

export function getParentTitleFromOutline(outline: string, parentNum: string): string | null {
  for (const line of outline.split('\n')) {
    // Aceita: "## 1. Desenvolvimento Teórico" ou "## 1 Desenvolvimento Teórico"
    const numMatch = line.match(/^##\s+(\d+)\.?\s+(.+)/);
    if (numMatch && numMatch[1] === parentNum) {
      return `${numMatch[1]}. ${numMatch[2].trim()}`;
    }
    // Aceita: "## III. Desenvolvimento" ou "## III Desenvolvimento"
    const romanMatch = line.match(/^##\s+([IVXLCDM]+)\.?\s+(.+)/i);
    if (romanMatch && romanMatch[1].toUpperCase() === parentNum) {
      return `${romanMatch[1].toUpperCase()}. ${romanMatch[2].trim()}`;
    }
  }
  return null;
}

// ── Classificador de secções TCC ──────────────────────────────────────────────
//
// Retorna o tipo de pagebreak que esta secção deve ter.

export type TccSectionClass =
  | 'structural'    // Grupo A: secção principal autónoma
  | 'first_sub'     // Grupo B: primeira subsecção de um grupo (inclui heading pai)
  | 'following_sub' // Grupo B: subsecção seguinte no mesmo grupo
  | 'unknown';      // fallback — tratado como structural

// Termos-chave que identificam secções estruturais de nível superior
// mesmo que venham prefixados com algarismos romanos (I., II., III.)
const STRUCTURAL_KEYWORDS = new Set([
  'introducao',
  'introducção',
  'introducao geral',
  'justificativa',
  'justificacao',
  'justificação',
  'objectivos',
  'objetivos',
  'objectivos gerais',
  'objetivos gerais',
  'objetivos especificos',
  'objectivos especificos',
  'metodologia',
  'metodos',
  'materiais e metodos',
  'revisao de literatura',
  'revisão de literatura',
  'referencial teorico',
  'referencial teórico',
  'fundamentacao teorica',
  'fundamentação teórica',
  'marco teorico',
  'marco teórico',
  'revisao bibliografica',
  'revisão bibliográfica',
  'desenvolvimento',
  'desenvolvimento teorico',
  'desenvolvimento teórico',
  'resultados',
  'resultados e discussao',
  'resultados e discussão',
  'discussao',
  'discussão',
  'analise',
  'análise',
  'analise dos resultados',
  'análise dos resultados',
  'conclusao',
  'conclusão',
  'consideracoes finais',
  'considerações finais',
  'notas finais',
  'referencias',
  'referências',
  'referencias bibliograficas',
  'referências bibliográficas',
  'bibliografia',
  'anexos',
  'apendices',
  'apêndices',
  'glossario',
  'glossário',
  'lista de abreviaturas',
  'lista de siglas',
  'lista de figuras',
  'lista de tabelas',
]);

function classifyTitle(normalizedTitle: string): 'structural' | 'unknown' {
  // Correspondência exacta
  if (STRUCTURAL_KEYWORDS.has(normalizedTitle)) return 'structural';
  // Correspondência parcial — o título contém uma palavra-chave
  for (const keyword of STRUCTURAL_KEYWORDS) {
    if (normalizedTitle.includes(keyword) || keyword.includes(normalizedTitle)) {
      return 'structural';
    }
  }
  return 'unknown';
}

export function classifyTccSection(
  section: TccSection,
  allSections: TccSection[],
): TccSectionClass {
  if (isSubsection(section.title)) {
    const parentNum = getParentGroupNumber(section.title);
    if (!parentNum) return 'following_sub';

    // É a primeira subsecção do grupo a ser inserida?
    const hasSiblingInserted = allSections.some(s => {
      if (s.index === section.index) return false;
      if (s.status !== 'inserted') return false;
      const pNum = getParentGroupNumber(s.title);
      return pNum === parentNum;
    });

    return hasSiblingInserted ? 'following_sub' : 'first_sub';
  }

  const normalized = normalizeTitle(section.title);
  const classified = classifyTitle(normalized);

  // Qualquer secção de nível 2 (##) é tratada como structural
  return classified === 'structural' ? 'structural' : 'unknown';
}

// ── Construtor de Markdown com pagebreak ──────────────────────────────────────
//
// É a ÚNICA função que decide o {pagebreak} e o heading de cada bloco TCC.

export interface BuildTccSectionOptions {
  section: TccSection;
  allSections: TccSection[];
  isFirstInEditor: boolean;
  outline: string;
}

export function buildTccSectionMarkdown(opts: BuildTccSectionOptions): string {
  const { section, allSections, isFirstInEditor, outline } = opts;
  const sectionClass = classifyTccSection(section, allSections);
  const isSub = isSubsection(section.title);
  const heading = isSub ? '###' : '##';

  // Detecta se o conteúdo já começa com o próprio título
  const firstLine = section.content.trimStart().split('\n')[0].trim();
  const headingText = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '') : '';
  const normalizedFirstLine = normalizeTitle(headingText);
  const normalizedTitle = normalizeTitle(section.title);
  const titleAlreadyPresent =
    normalizedFirstLine === normalizedTitle ||
    normalizedFirstLine.includes(normalizedTitle) ||
    normalizedTitle.includes(normalizedFirstLine);

  const body = titleAlreadyPresent
    ? section.content
    : `${heading} ${section.title}\n\n${section.content}`;

  switch (sectionClass) {
    case 'structural':
    case 'unknown':
      // Secção principal autónoma
      return isFirstInEditor ? body : `{pagebreak}\n\n${body}`;

    case 'first_sub': {
      // Primeira subsecção do grupo → insere heading pai + pagebreak (se necessário)
      const parentNum = getParentGroupNumber(section.title);
      const parentTitle = parentNum
        ? getParentTitleFromOutline(outline, parentNum)
        : null;

      if (parentTitle) {
        const parentBlock = `## ${parentTitle}`;
        const fullBlock = `${parentBlock}\n\n${body}`;
        return isFirstInEditor ? fullBlock : `{pagebreak}\n\n${fullBlock}`;
      }
      // Sem heading pai encontrado — comporta-se como structural
      return isFirstInEditor ? body : `{pagebreak}\n\n${body}`;
    }

    case 'following_sub':
      // Subsecção seguinte — flui sem pagebreak
      return body;
  }
}

// ── Reconstrução completa do editor (para restauração/regeneração) ─────────────
//
// Replica a lógica de buildTccSectionMarkdown para todas as secções já inseridas,
// na ordem correcta, com headings pai automáticos.

export function buildReconstructedTccContent(
  sections: TccSection[],
  outline: string,
): string {
  const sorted = [...sections]
    .filter(s => s.content.trim())
    .sort((a, b) => a.index - b.index);

  const parts: string[] = [];
  const insertedParentNums = new Set<string>();

  for (const section of sorted) {
    const isSub = isSubsection(section.title);
    const heading = isSub ? '###' : '##';

    const firstLine = section.content.trimStart().split('\n')[0].trim();
    const headingText = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '') : '';
    const normalizedFirstLine = normalizeTitle(headingText);
    const normalizedTitle = normalizeTitle(section.title);
    const titleAlreadyPresent =
      normalizedFirstLine === normalizedTitle ||
      normalizedFirstLine.includes(normalizedTitle) ||
      normalizedTitle.includes(normalizedFirstLine);

    const body = titleAlreadyPresent
      ? section.content
      : `${heading} ${section.title}\n\n${section.content}`;

    if (isSub && outline) {
      const parentNum = getParentGroupNumber(section.title);
      if (parentNum && !insertedParentNums.has(parentNum)) {
        const parentTitle = getParentTitleFromOutline(outline, parentNum);
        if (parentTitle) {
          const parentBlock = `## ${parentTitle}`;
          parts.push(parts.length === 0 ? parentBlock : `{pagebreak}\n\n${parentBlock}`);
          insertedParentNums.add(parentNum);
        }
      }
      // Subsecções fluem sem pagebreak dentro do bloco pai
      parts.push(body);
      continue;
    }

    // Secção autónoma
    parts.push(parts.length === 0 ? body : `{pagebreak}\n\n${body}`);
  }

  return parts.join('\n\n');
}
