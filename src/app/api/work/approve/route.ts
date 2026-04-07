import { NextResponse } from 'next/server';
import { approveWorkOutline, saveWorkResearchBrief } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/api-auth';
import { generateResearchBrief } from '@/lib/research/brief';

const MAX_SESSION_ID_CHARS = 100;
const MAX_OUTLINE_CHARS = 15_000;

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'work:approve', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    const outline = typeof body?.outline === 'string' ? body.outline.trim() : '';

    if (!sessionId || sessionId.length > MAX_SESSION_ID_CHARS || !outline) {
      return NextResponse.json({ error: 'sessionId e outline são obrigatórios' }, { status: 400 });
    }

    if (outline.length > MAX_OUTLINE_CHARS) {
      return NextResponse.json({ error: 'outline demasiado longo (máx 15 000 caracteres)' }, { status: 400 });
    }

    const session = await approveWorkOutline(sessionId, outline);

    try {
      const research = await generateResearchBrief(session.topic, outline);
      await saveWorkResearchBrief(session.id, research.keywords, research.brief);

      session.research_keywords = research.keywords;
      session.research_brief = research.brief;
      session.research_generated_at = new Date().toISOString();
    } catch (researchError) {
      // Não bloqueia a aprovação do esboço caso a pesquisa falhe.
      console.error('Falha ao gerar ficha técnica em /api/work/approve:', researchError);
    }

    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
