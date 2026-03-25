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

    if (!session.research_brief) {
      try {
        const research = await generateResearchBrief(session.topic, outline.trim());
        await saveTccResearchBrief(session.id, research.keywords, research.brief);
      } catch (error) {
        console.error('Falha ao gerar ficha técnica de pesquisa (tcc):', error);
      }
    }

    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
