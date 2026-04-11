import { PDFPage } from 'pdf-lib';
import type { ParsedSource } from './rag-types';

const PAGES_PER_CHUNK = 6;

async function pdfHasExtractableText(buffer: Buffer): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer, { max: 2 });
    return data.text.trim().length > 200;
  } catch {
    return false;
  }
}

async function splitPdfByPages(
  buffer: Buffer,
): Promise<Array<{ data: Buffer; startPage: number; endPage: number }>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFDocument } = require('pdf-lib');
  const srcDoc = await PDFDocument.load(buffer);
  const totalPages = srcDoc.getPageCount();
  const groups: Array<{ data: Buffer; startPage: number; endPage: number }> = [];

  for (let start = 0; start < totalPages; start += PAGES_PER_CHUNK) {
    const end = Math.min(start + PAGES_PER_CHUNK, totalPages);
    const subDoc = await PDFDocument.create();
    const pages = await subDoc.copyPages(
      srcDoc,
      Array.from({ length: end - start }, (_, i) => start + i),
    );
    pages.forEach((p: PDFPage) => subDoc.addPage(p));
    const bytes = await subDoc.save();
    groups.push({
      data: Buffer.from(bytes),
      startPage: start + 1,
      endPage: end,
    });
  }

  return groups;
}

export async function parseUploadedFile(buffer: Buffer, filename: string): Promise<ParsedSource> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'docx') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: buffer.buffer });
    const text = result.value as string;
    return {
      type: 'text',
      textChunks: chunkText(text),
      charCount: text.length,
      fileType: 'docx',
    };
  }

  if (ext === 'txt' || ext === 'md') {
    const text = buffer.toString('utf-8');
    return {
      type: 'text',
      textChunks: chunkText(text),
      charCount: text.length,
      fileType: 'txt',
    };
  }

  if (ext === 'pdf') {
    const hasText = await pdfHasExtractableText(buffer);

    if (hasText) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return {
        type: 'text',
        textChunks: chunkText(data.text),
        charCount: data.text.length,
        fileType: 'pdf_text',
      };
    }

    const pageGroups = await splitPdfByPages(buffer);
    return {
      type: 'pdf_pages',
      binaryChunks: pageGroups.map((group, i) => ({
        data: group.data.toString('base64'),
        mimeType: 'application/pdf',
        label: `pág ${group.startPage}–${group.endPage}`,
        pageGroup: i,
      })),
      charCount: buffer.length,
      fileType: 'pdf_visual',
    };
  }

  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    return {
      type: 'image',
      binaryChunks: [{
        data: buffer.toString('base64'),
        mimeType,
        label: filename,
      }],
      charCount: buffer.length,
      fileType: 'image',
    };
  }

  if (ext === 'mp3' || ext === 'wav') {
    const mimeType = ext === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    return {
      type: 'audio',
      binaryChunks: [{
        data: buffer.toString('base64'),
        mimeType,
        label: filename,
      }],
      charCount: buffer.length,
      fileType: 'audio',
    };
  }

  throw new Error(`Tipo de ficheiro não suportado: .${ext}`);
}

export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
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
