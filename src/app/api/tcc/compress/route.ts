// app/api/tcc/compress/route.ts
// Endpoint para compressão manual e consulta de estado de compressão.

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/tcc/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  compressContextIfNeeded,
  analyseCompressionNeed,
} from '@/lib/tcc/context-compressor';

// GET /api/tcc/compress?sessionId=...&targetSection=N
// Retorna o estado de compressão sem executar nada.
export async function GET(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:compress:get', maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(req.url);
    const sessionId    = searchParams.get('sessionId');
    const targetStr    = searchParams.get('targetSection');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId obrigatório' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }

    const targetSectionIndex = targetStr ? parseInt(targetStr, 10) : session.sections.length;
    const decision = analyseCompressionNeed(session, targetSectionIndex);

    return NextResponse.json({
      sessionId,
      compressionActive:      session.context_summary !== null,
      summaryCoveredUpTo:     session.summary_covers_up_to,
      summaryUpdatedAt:       session.summary_updated_at,
      summaryLength:          session.context_summary?.length ?? 0,
      shouldCompress:         decision.shouldCompress,
      sectionsInSummary:      decision.compressedSections.length,
      sectionsStillFull:      decision.recentSections.length,
      sectionsUncompressed:   decision.developedButUncompressed.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/tcc/compress  { sessionId, targetSectionIndex }
// Executa a compressão (se necessário) e retorna a sessão actualizada.
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:compress:post', maxRequests: 12, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { sessionId, targetSectionIndex = 999 } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId obrigatório' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }

    if (!session.outline_approved) {
      return NextResponse.json(
        { error: 'Esboço ainda não aprovado — compressão não aplicável' },
        { status: 400 },
      );
    }

    const decision = analyseCompressionNeed(session, targetSectionIndex);

    if (!decision.shouldCompress) {
      return NextResponse.json({
        compressed: false,
        message:    'Compressão não necessária ainda',
        session,
      });
    }

    const updatedSession = await compressContextIfNeeded(session, targetSectionIndex);

    return NextResponse.json({
      compressed:           true,
      summaryCoveredUpTo:   updatedSession.summary_covers_up_to,
      summaryLength:        updatedSession.context_summary?.length ?? 0,
      session:              updatedSession,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
