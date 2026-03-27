import { Document, Packer } from 'docx';
import { parseToAST } from './parser';
import { buildDocxDocument, buildContentSections, SHARED_STYLES, SHARED_NUMBERING } from './docx-builder';
import { buildCoverSections } from './cover-builder';
import type { CoverData } from './cover-types';

// ── API original (inalterada) ─────────────────────────────────────────────────

export async function generateDocx(markdown: string): Promise<Buffer> {
  const ast = parseToAST(markdown);
  const doc = await buildDocxDocument(ast);
  return Packer.toBuffer(doc);
}

// ── Nova API: documento com capa + contra-capa + conteúdo ────────────────────

/**
 * Gera um documento .docx completo com:
 *   Página 1 — Capa (com logo opcional, metadados, membros, data)
 *   Página 2 — Contra-capa (sem logo, com resumo opcional, docente centrado)
 *   Página 3+ — Conteúdo do trabalho em markdown, com rodapé de paginação
 *
 * @param coverData  Dados da capa (ver CoverData em cover-types.ts)
 * @param markdown   Conteúdo do trabalho em markdown (pode estar vazio)
 */
export async function generateDocxWithCover(
  coverData: CoverData,
  markdown: string,
): Promise<Buffer> {
  const coverSections   = buildCoverSections(coverData);

  // Conteúdo pode estar vazio — nesse caso produz uma terceira página em branco
  const ast             = parseToAST(markdown || '');
  const contentSections = await buildContentSections(ast);

  const doc = new Document({
    styles:    SHARED_STYLES,
    numbering: SHARED_NUMBERING,
    sections:  [...coverSections, ...contentSections] as any[],
  });

  return Packer.toBuffer(doc);
}

// ── Re-exportações de tipos úteis ─────────────────────────────────────────────

export type { CoverData } from './cover-types';
