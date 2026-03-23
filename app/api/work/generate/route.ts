import { NextResponse } from 'next/server';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM = `És um especialista em metodologia académica do ensino secundário e médio em Moçambique.
Vais gerar um esboço orientador para um trabalho escolar sobre o tópico fornecido.

O trabalho tem SEMPRE estas secções fixas (não adicionares nem removeres nenhuma), na sessão "4. Desenvolvimento Teórico" deve haver titulos do tema(exemplo: 4.1 Conceito de correio eletronico, 4.2 Historia de correio eletronico), a estrutura principal é essa:
1. Índice
2. Introdução
3. Objectivos e Metodologia
4. Desenvolvimento Teórico
5. Conclusão
6. Referências Bibliográficas

Para cada secção, descreve em 2-4 frases o que o aluno deve abordar nessa secção, tendo em conta o tópico específico.
Usa Markdown: ## para o título de cada secção, texto corrido para a descrição.
Escreve em português europeu/moçambicano. Sê concreto e útil — o esboço serve de guia para o desenvolvimento posterior.`;

export async function POST(req: Request) {
  try {
    const { topic } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: `Gera o esboço orientador para um trabalho escolar sobre: "${topic}"` },
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
