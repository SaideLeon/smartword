import { NextResponse } from 'next/server';
import { approveOutline } from '@/lib/tcc/service';

// POST /api/tcc/approve  { sessionId, outline }
export async function POST(req: Request) {
  try {
    const { sessionId, outline } = await req.json();

    if (!sessionId || !outline?.trim()) {
      return NextResponse.json({ error: 'sessionId e outline são obrigatórios' }, { status: 400 });
    }

    const session = await approveOutline(sessionId, outline.trim());
    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
