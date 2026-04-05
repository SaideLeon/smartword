// src/app/api/tcc/approve/route.ts

import { NextResponse } from 'next/server';
import { approveOutline, saveTccResearchBrief, saveContextType } from '@/lib/tcc/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateResearchBrief } from '@/lib/research/brief';
import { detectContextType } from '@/lib/tcc/context-detector';

type ErrorInfo = {
  status: number;
  type: string;
  message: string;
};

function classifyApprovalError(error: unknown): ErrorInfo {
  if (error instanceof SyntaxError) {
    return {
      status: 400,
      type: 'invalid_json',
      message: 'Payload JSON inválido no corpo da requisição.',
    };
  }

  if (error instanceof TypeError) {
    return {
      status: 502,
      type: 'upstream_connection_error',
      message: error.message || 'Falha de ligação com serviço externo.',
    };
  }

  if (error instanceof Error) {
    const message = error.message || 'Erro interno ao aprovar esboço.';

    if (/GROQ_API_KEY/i.test(message)) {
      return {
        status: 500,
        type: 'missing_configuration',
        message,
      };
    }

    if (/permission|policy|rls|jwt|auth/i.test(message)) {
      return {
        status: 403,
        type: 'authorization_error',
        message,
      };
    }

    return {
      status: 500,
      type: 'approval_error',
      message,
    };
  }

  return {
    status: 500,
    type: 'unknown_error',
    message: 'Erro interno desconhecido ao aprovar esboço.',
  };
}

// POST /api/tcc/approve  { sessionId, outline }
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:approve', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  let sessionId: string | undefined;
  try {
    const body = await req.json();
    sessionId = body?.sessionId;
    const outline = body?.outline;

    if (!sessionId || !outline?.trim()) {
      return NextResponse.json(
        { error: 'sessionId e outline são obrigatórios' },
        { status: 400 },
      );
    }

    const session = await approveOutline(sessionId, outline.trim());

    // Detecta o tipo de contextualização UMA VEZ, no momento da aprovação,
    // e persiste na sessão para que todos os develops subsequentes a usem
    // sem recalcular.
    try {
      const contextType = detectContextType(session.topic, outline.trim());
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
        outline.trim(),
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
    const err = classifyApprovalError(e);

    console.error('[api/tcc/approve] erro ao aprovar esboço', {
      sessionId,
      errorType: err.type,
      status: err.status,
      message: err.message,
      stack: e instanceof Error ? e.stack : null,
      rawError: e,
    });

    return NextResponse.json(
      {
        error: 'Falha ao aprovar esboço',
        errorType: err.type,
        details: err.message,
      },
      { status: err.status },
    );
  }
}
