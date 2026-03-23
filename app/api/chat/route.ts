import { NextResponse } from 'next/server';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `És um assistente especialista em matemática e ciências.
Quando responderes, usa SEMPRE formatação Markdown bem estruturada:
- Cabeçalhos com # ## ###
- Equações inline com $...$ e em bloco com $$...$$
- Listas, negrito e itálico onde adequado
- Exemplos resolvidos passo a passo

Usa notação LaTeX correcta para equações. Responde em português europeu.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });
    }

    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

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
