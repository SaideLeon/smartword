export interface ParsedDocument {
  text: string;
  fileType: 'pdf' | 'docx' | 'txt';
  charCount: number;
}

export async function parseUploadedFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedDocument> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return { text: data.text, fileType: 'pdf', charCount: data.text.length };
  }

  if (ext === 'docx') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: buffer.buffer });
    return { text: result.value, fileType: 'docx', charCount: result.value.length };
  }

  if (ext === 'txt' || ext === 'md') {
    const text = buffer.toString('utf-8');
    return { text, fileType: 'txt', charCount: text.length };
  }

  throw new Error(`Tipo de ficheiro não suportado: .${ext}`);
}

export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 200,
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start += chunkSize - overlap;
  }
  return chunks;
}
