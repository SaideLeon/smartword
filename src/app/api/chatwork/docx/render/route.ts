import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';
import { renderDocxHtml } from '../../../../../lib/chatwork/docx-html';

const MAX_DOCX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'chatwork:docx-render', maxRequests: 10, windowMs: 60_000 });
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

    const html = renderDocxHtml(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ html });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
