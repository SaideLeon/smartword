import { NextResponse } from 'next/server';
import {
  createWorkSession,
  deleteWorkSession,
  getWorkSession,
  listWorkSessions,
  markWorkSectionInserted,
  saveWorkCoverData,
} from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/api-auth';

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'work:session:get', maxRequests: 60, windowMs: 60_000 });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const session = await getWorkSession(id);
      if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
      return NextResponse.json(session);
    }

    const sessions = await listWorkSessions();
    return NextResponse.json(sessions);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'work:session:post', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();

    // Marcar secção como inserida no editor
    if (body._action === 'markInserted') {
      const { sessionId, sectionIndex } = body;
      if (!sessionId || typeof sectionIndex !== 'number') {
        return NextResponse.json({ error: 'Dados inválidos para actualizar secção' }, { status: 400 });
      }
      await markWorkSectionInserted(sessionId, sectionIndex);
      return NextResponse.json({ ok: true });
    }

    // Persistir dados de capa (incluindo abstract)
    if (body._action === 'saveCoverData') {
      const { sessionId, coverData } = body;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId é obrigatório' }, { status: 400 });
      }
      await saveWorkCoverData(sessionId, coverData ?? null);
      return NextResponse.json({ ok: true });
    }

    // Criar nova sessão
    const topic = body.topic?.trim();
    if (!topic) return NextResponse.json({ error: 'Tópico obrigatório' }, { status: 400 });

    const session = await createWorkSession(topic);
    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'work:session:delete', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    await deleteWorkSession(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
