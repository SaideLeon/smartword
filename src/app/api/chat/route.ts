import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { parseChatMessages } from '@/lib/validation/input-guards';

const SYSTEM_PROMPT = `És um assistente especialista em matemática e ciências.
Quando responderes, usa SEMPRE formatação Markdown bem estruturada:
- Cabeçalhos com # ## ###
- Equações inline com $...$ e em bloco com $$...$$
- Listas, negrito e itálico onde adequado
- Exemplos resolvidos passo a passo

Usa notação LaTeX correcta para equações. Responde em português europeu.`;

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'chat:post', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { messages } = await req.json();

    const parsedMessages = parseChatMessages(messages);
    if (!parsedMessages) {
      return NextResponse.json({ error: 'messages inválidas ou demasiado longas' }, { status: 400 });
    }

    const stream = await geminiGenerateTextStreamSSE({
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...parsedMessages,
      ],
      maxOutputTokens: 4096,
      temperature: 0.7,
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
