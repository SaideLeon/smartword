// src/app/api/cover/export/route.ts
// Gera um .docx com capa + contracapa + conteúdo do trabalho.
// Usa generateDocxWithCover de src/lib/docx/index.ts

import { NextResponse } from 'next/server';
import { generateDocxWithCover } from '@/lib/docx';
import { enforceRateLimit } from '@/lib/rate-limit';
import type { CoverData } from '@/lib/docx/cover-types';
import { sanitizeExportFilename } from '@/lib/utils/filename';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';

const MAX_MARKDOWN_CHARS = 150_000;

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'cover:export',
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'cover');
  if (planError) return planError;

  try {
    const { coverData, markdown, filename = 'trabalho' } = await req.json();
    const safeFilename = sanitizeExportFilename(filename);
    const normalizedMarkdown = markdown == null ? '' : typeof markdown === 'string' ? markdown : null;

    if (!coverData) {
      return NextResponse.json({ error: 'coverData é obrigatório' }, { status: 400 });
    }
    if (normalizedMarkdown === null) {
      return NextResponse.json({ error: 'markdown inválido' }, { status: 400 });
    }
    if (normalizedMarkdown.length > MAX_MARKDOWN_CHARS) {
      return NextResponse.json({ error: 'markdown demasiado longo (máx 150 000 caracteres)' }, { status: 400 });
    }

    if (coverData.logoBase64 || coverData.logoMediaType) {
      const validMediaTypes = ['image/png', 'image/jpeg'] as const;
      if (!coverData.logoBase64 || !coverData.logoMediaType || !validMediaTypes.includes(coverData.logoMediaType)) {
        return NextResponse.json({ error: 'Logo inválido: tipo MIME não suportado' }, { status: 400 });
      }

    }

    const buffer = await generateDocxWithCover(coverData as CoverData, normalizedMarkdown);

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
