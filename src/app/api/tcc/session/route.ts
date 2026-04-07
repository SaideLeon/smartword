import { NextResponse } from 'next/server';
import {
  createSession,
  getSession,
  listSessions,
  deleteSession,
  markSectionInserted,
  saveTccCoverData,
} from '@/lib/tcc/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/api-auth';

// GET /api/tcc/session          → listar sessões recentes
// GET /api/tcc/session?id=...   → buscar sessão específica
export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'tcc:session:get', maxRequests: 60, windowMs: 60_000 });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

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
  const limited = await enforceRateLimit(req, { scope: 'tcc:session:post', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();

    if (body._action === 'markInserted') {
      const { sessionId, sectionIndex } = body;
      if (!sessionId || typeof sectionIndex !== 'number') {
        return NextResponse.json({ error: 'Dados inválidos para actualizar secção' }, { status: 400 });
      }
      await markSectionInserted(sessionId, sectionIndex);
      return NextResponse.json({ ok: true });
    }

    if (body._action === 'saveCoverData') {
      const { sessionId, coverData } = body;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId é obrigatório' }, { status: 400 });
      }
      await saveTccCoverData(sessionId, coverData ?? null);
      return NextResponse.json({ ok: true });
    }

    const topic = body.topic?.trim();
    if (!topic) return NextResponse.json({ error: 'Tópico obrigatório' }, { status: 400 });

    const session = await createSession(topic);
    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/tcc/session?id=...
export async function DELETE(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'tcc:session:delete', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

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
