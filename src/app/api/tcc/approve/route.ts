import { NextResponse } from 'next/server';
import { approveOutline, saveTccResearchBrief } from '@/lib/tcc/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateResearchBrief } from '@/lib/research/brief';

// POST /api/tcc/approve  { sessionId, outline }
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:approve', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { sessionId, outline } = await req.json();

    if (!sessionId || !outline?.trim()) {
      return NextResponse.json({ error: 'sessionId e outline são obrigatórios' }, { status: 400 });
    }

    const session = await approveOutline(sessionId, outline.trim());

    try {
      const research = await generateResearchBrief(session.topic, outline.trim());
      await saveTccResearchBrief(session.id, research.keywords, research.brief);

      session.research_keywords = research.keywords;
      session.research_brief = research.brief;
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
