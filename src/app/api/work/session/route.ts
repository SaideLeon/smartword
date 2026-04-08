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
import { isValidUUID } from '@/lib/validation/input-guards';
import { parseCoverDataPayload } from '@/lib/validation/cover-data-validator';

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
      if (!isValidUUID(sessionId) || !Number.isInteger(sectionIndex) || sectionIndex < 0) {
        return NextResponse.json({ error: 'sessionId ou sectionIndex inválido' }, { status: 400 });
      }
      await markWorkSectionInserted(sessionId, sectionIndex);
      return NextResponse.json({ ok: true });
    }

    // Persistir dados de capa (incluindo abstract)
    if (body._action === 'saveCoverData') {
      const { sessionId, coverData } = body;
      if (!isValidUUID(sessionId)) {
        return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 });
      }

      const parsedCoverData = parseCoverDataPayload(coverData ?? null);
      if (parsedCoverData === null && coverData != null) {
        return NextResponse.json({ error: 'coverData inválido ou demasiado grande' }, { status: 400 });
      }

      await saveWorkCoverData(sessionId, parsedCoverData);
      return NextResponse.json({ ok: true });
    }

    // Criar nova sessão
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    if (!topic || topic.length < 3) {
      return NextResponse.json({ error: 'Tópico obrigatório (mínimo 3 caracteres)' }, { status: 400 });
    }
    if (topic.length > 500) {
      return NextResponse.json({ error: 'Tópico demasiado longo (máx 500 caracteres)' }, { status: 400 });
    }

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
