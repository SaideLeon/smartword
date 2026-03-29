// src/lib/docx/truncate-export.ts
// Corta o conteúdo Markdown ao meio para utilizadores sem plano completo.
// A exportação truncada mostra a primeira metade + aviso de upgrade.

const UPGRADE_NOTICE = `

---

> **⚠ Versão de demonstração — conteúdo cortado**
> 
> Para exportar o documento completo, faça upgrade para um plano pago em **muneri.app/planos**.
> 
> Planos disponíveis a partir de **50 MT** (avulso) ou **320 MT/mês** (Básico).

`;

/**
 * Trunca o markdown ao meio e adiciona aviso de upgrade.
 * Utilizado na exportação de utilizadores com plano 'free'.
 *
 * @param markdown  Conteúdo completo em Markdown
 * @returns         Primeira metade + aviso de upgrade
 */
export function truncateMarkdownForFreeExport(markdown: string): string {
  if (!markdown.trim()) return markdown;

  const lines = markdown.split('\n');
  const halfIndex = Math.ceil(lines.length / 2);
  const firstHalf = lines.slice(0, halfIndex).join('\n');

  return firstHalf + UPGRADE_NOTICE;
}

/**
 * Verifica se o markdown deve ser truncado e aplica a truncagem se necessário.
 *
 * @param markdown        Conteúdo completo
 * @param exportFull      true = exportar completo; false = truncar
 */
export function prepareMarkdownForExport(markdown: string, exportFull: boolean): string {
  if (exportFull) return markdown;
  return truncateMarkdownForFreeExport(markdown);
}
