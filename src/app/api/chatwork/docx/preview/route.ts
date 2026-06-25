import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';

const MAX_DOCX_BYTES = 8 * 1024 * 1024;

function textToMarkdown(raw: string): string {
  const paragraphs = raw
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return '# Documento importado\n\n';

  const [first, ...rest] = paragraphs;
  return [`# ${first}`, ...rest].join('\n\n');
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'chatwork:docx-preview', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'ai_chat', req);
  if (planError) return planError;

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'Envia um ficheiro .docx válido' }, { status: 400 });
    }

    if (file.size > MAX_DOCX_BYTES) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 8 MB)' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });

    return NextResponse.json({
      markdown: textToMarkdown(result.value),
      warnings: result.messages.map(message => message.message),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
