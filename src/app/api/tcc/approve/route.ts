// src/app/api/tcc/approve/route.ts

import { NextResponse } from 'next/server';
import { approveOutline, saveTccResearchBrief, saveContextType } from '@/lib/tcc/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateResearchBrief } from '@/lib/research/brief';
import { detectContextType } from '@/lib/tcc/context-detector';

const MAX_SESSION_ID_CHARS = 100;
const MAX_OUTLINE_CHARS = 15_000;

// POST /api/tcc/approve  { sessionId, outline }
export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'tcc:approve', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = await req.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    const outline = typeof body?.outline === 'string' ? body.outline.trim() : '';

    if (!sessionId || sessionId.length > MAX_SESSION_ID_CHARS || !outline) {
      return NextResponse.json(
        { error: 'sessionId e outline são obrigatórios' },
        { status: 400 },
      );
    }

    if (outline.length > MAX_OUTLINE_CHARS) {
      return NextResponse.json(
        { error: 'outline demasiado longo (máx 15 000 caracteres)' },
        { status: 400 },
      );
    }

    const session = await approveOutline(sessionId, outline);

    // Detecta o tipo de contextualização UMA VEZ, no momento da aprovação,
    // e persiste na sessão para que todos os develops subsequentes a usem
    // sem recalcular.
    try {
      const contextType = detectContextType(session.topic, outline);
      await saveContextType(session.id, contextType);
      session.context_type = contextType;
    } catch (ctxError) {
      // Não bloqueia a aprovação — usa 'comparative' como fallback seguro.
      console.error('Falha ao detectar/guardar context_type:', ctxError);
      session.context_type = 'comparative';
    }

    // Gera a ficha de pesquisa após o contexto estar definido
    try {
      const research = await generateResearchBrief(
        session.topic,
        outline,
        session.context_type, // passa o contexto para que o brief use fontes adequadas
      );
      await saveTccResearchBrief(session.id, research.keywords, research.brief);

      session.research_keywords    = research.keywords;
      session.research_brief       = research.brief;
      session.research_generated_at = new Date().toISOString();
    } catch (researchError) {
      // Não bloqueia a aprovação do esboço caso a pesquisa falhe.
      console.error('Falha ao gerar ficha técnica em /api/tcc/approve:', researchError);
    }

    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
