// src/app/api/cover/export/route.ts
// Gera um .docx com capa + contracapa + conteúdo do trabalho.
// Usa generateDocxWithCover de src/lib/docx/index.ts

import { NextResponse } from 'next/server';
import { generateDocxWithCover } from '@/lib/docx';
import { enforceRateLimit } from '@/lib/rate-limit';
import type { CoverData } from '@/lib/docx/cover-types';

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, {
    scope: 'cover:export',
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { coverData, markdown, filename = 'trabalho' } = await req.json();

    if (!coverData) {
      return NextResponse.json({ error: 'coverData é obrigatório' }, { status: 400 });
    }

    const buffer = await generateDocxWithCover(coverData as CoverData, markdown ?? '');

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      },
    });
  } catch (e: any) {
    console.error('Erro ao gerar DOCX com capa:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
