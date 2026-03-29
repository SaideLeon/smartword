import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { groqFetch } from '@/lib/groq-resilient';

const SYSTEM_PROMPT = `És um assistente especialista em matemática e ciências.
Quando responderes, usa SEMPRE formatação Markdown bem estruturada:
- Cabeçalhos com # ## ###
- Equações inline com $...$ e em bloco com $$...$$
- Listas, negrito e itálico onde adequado
- Exemplos resolvidos passo a passo

Usa notação LaTeX correcta para equações. Responde em português europeu.`;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'chat:post', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { messages } = await req.json();

    const response = await groqFetch((_key, _attempt) => ({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }));

    // Passa o stream SSE directamente ao cliente
    return new NextResponse(response.body, {
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
