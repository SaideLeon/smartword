import { NextResponse } from 'next/server';
import { createSession, getSession, listSessions, deleteSession } from '@/lib/tcc/service';
import { enforceRateLimit } from '@/lib/rate-limit';

// GET /api/tcc/session          → listar sessões recentes
// GET /api/tcc/session?id=...   → buscar sessão específica
export async function GET(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:session:get', maxRequests: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const session = await getSession(id);
      if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
      return NextResponse.json(session);
    }

    const sessions = await listSessions();
    return NextResponse.json(sessions);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/tcc/session  { topic }  → criar sessão
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:session:post', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { topic } = await req.json();
    if (!topic?.trim()) return NextResponse.json({ error: 'Tópico obrigatório' }, { status: 400 });

    const session = await createSession(topic.trim());
    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/tcc/session?id=...
export async function DELETE(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:session:delete', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
