import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateDocx } from '@/lib/docx';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sanitizeExportFilename } from '@/lib/utils/filename';

const DEFAULT_MAX_CONTENT_BYTES = 500_000;

function resolveMaxContentBytes(): number {
  const rawValue = process.env.EXPORT_MAX_CONTENT_BYTES;
  if (!rawValue) return DEFAULT_MAX_CONTENT_BYTES;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_CONTENT_BYTES;

  return Math.floor(parsed);
}

function parseExportPayload(body: unknown): { content: string; filename: string } | null {
  if (!body || typeof body !== 'object') return null;

  const payload = body as Record<string, unknown>;
  if (typeof payload.content !== 'string' || !payload.content.trim()) return null;

  const maxContentBytes = resolveMaxContentBytes();
  if (Buffer.byteLength(payload.content, 'utf8') > maxContentBytes) return null;

  const filename = sanitizeExportFilename(payload.filename ?? 'trabalho');
  return { content: payload.content, filename };
}

async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'export:post',
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = parseExportPayload(body);
    if (!parsed) {
      return NextResponse.json({ error: 'Payload inválido ou demasiado grande' }, { status: 400 });
    }

    const buffer = await generateDocx(parsed.content);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${parsed.filename}.docx"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating DOCX:', error.stack || error);
    return NextResponse.json({ error: 'Failed to generate DOCX' }, { status: 500 });
  }
}
