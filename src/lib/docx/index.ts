import { parseToAST } from './parser';
import { buildDocxDocument } from './docx-builder';
import { Packer } from 'docx';

export async function generateDocx(markdown: string): Promise<Buffer> {
  const ast = parseToAST(markdown);
  const doc = await buildDocxDocument(ast);
  return await Packer.toBuffer(doc);
}
