import { NextResponse } from 'next/server';
import { approveWorkOutline, saveWorkResearchBrief } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateResearchBrief } from '@/lib/research/brief';

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'work:approve', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { sessionId, outline } = await req.json();

    if (!sessionId || !outline?.trim()) {
      return NextResponse.json({ error: 'sessionId e outline são obrigatórios' }, { status: 400 });
    }

    const session = await approveWorkOutline(sessionId, outline.trim());

    // A ficha técnica é obrigatória imediatamente após a aprovação do esboço.
    // Se a geração falhar, devolvemos erro para que o cliente possa reenviar.
    const research = await generateResearchBrief(session.topic, outline.trim());
    await saveWorkResearchBrief(session.id, research.keywords, research.brief);

    session.research_keywords = research.keywords;
    session.research_brief = research.brief;
    session.research_generated_at = new Date().toISOString();

    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
