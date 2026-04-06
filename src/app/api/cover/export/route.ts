// src/app/api/cover/export/route.ts
// Gera um .docx com capa + contracapa + conteúdo do trabalho.
// Usa generateDocxWithCover de src/lib/docx/index.ts

import { NextResponse } from 'next/server';
import { generateDocxWithCover } from '@/lib/docx';
import { enforceRateLimit } from '@/lib/rate-limit';
import type { CoverData } from '@/lib/docx/cover-types';
import { validateBase64Image } from '@/lib/validation/image-validator';

function sanitizeExportFilename(input: unknown): string {
  if (typeof input !== 'string') return 'trabalho';

  const normalized = input
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\/\\?%*:|"<>;\r\n]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80);

  return normalized || 'trabalho';
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'cover:export',
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { coverData, markdown, filename = 'trabalho' } = await req.json();
    const safeFilename = sanitizeExportFilename(filename);

    if (!coverData) {
      return NextResponse.json({ error: 'coverData é obrigatório' }, { status: 400 });
    }

    if (coverData.logoBase64 || coverData.logoMediaType) {
      const validMediaTypes = ['image/png', 'image/jpeg'] as const;
      if (!coverData.logoBase64 || !coverData.logoMediaType || !validMediaTypes.includes(coverData.logoMediaType)) {
        return NextResponse.json({ error: 'Logo inválido: tipo MIME não suportado' }, { status: 400 });
      }

      const imageBuffer = validateBase64Image(coverData.logoBase64, coverData.logoMediaType);
      if (!imageBuffer) {
        return NextResponse.json(
          { error: 'Logo inválido: magic bytes não correspondem ao tipo declarado' },
          { status: 400 },
        );
      }
    }

    const buffer = await generateDocxWithCover(coverData as CoverData, markdown ?? '');

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}.docx"`,
      },
    });
  } catch (e: any) {
    console.error('Erro ao gerar DOCX com capa:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
