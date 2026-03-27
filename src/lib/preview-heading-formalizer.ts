const PREVIEW_HEADING_PATTERN = /^(\s{0,3})#{1,5}(\s+.+)$/;

/**
 * Formaliza títulos e subtítulos no preview para nível 6 (######).
 *
 * Regras:
 * - Linhas iniciadas por # até ##### passam a ######
 * - Linhas já em ###### permanecem inalteradas
 * - Conteúdo não-heading permanece inalterado
 */
export function formalizePreviewHeadings(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => {
      const match = line.match(PREVIEW_HEADING_PATTERN);
      if (!match) return line;

      const [, leadingSpaces, headingTail] = match;
      return `${leadingSpaces}######${headingTail}`;
    })
    .join('\n');
}
