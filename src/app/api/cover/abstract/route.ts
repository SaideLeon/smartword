// src/app/api/cover/abstract/route.ts
// Gera automaticamente um resumo (abstract) com base no tema do trabalho.
// Usada após a submissão do formulário de capa.

import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { groqFetch } from '@/lib/groq-resilient';

const SYSTEM = `És um especialista em redacção académica do ensino secundário/médio em Moçambique.
Gera um resumo (abstract) conciso e académico para a contracapa de um trabalho escolar.

REGRAS ABSOLUTAS:
- Entre 60 e 120 palavras
- Tom declarativo e afirmativo — NUNCA faças perguntas de nenhum tipo
- Começa com frase afirmativa: "O presente trabalho aborda…", "O trabalho analisa…" ou equivalente
- Baseia-te EXCLUSIVAMENTE no esboço fornecido para descrever o conteúdo real do trabalho
- Inclui: âmbito do tema, objectivos principais e relevância para o contexto moçambicano
- Tom académico mas acessível ao nível do ensino secundário/médio
- Português europeu correcto
- Apresenta o trabalho como facto consumado, não como proposta nem interrogação`;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, {
    scope: 'cover:abstract',
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { theme, topic, outline } = await req.json();

    if (!theme) {
      return NextResponse.json({ error: 'theme é obrigatório' }, { status: 400 });
    }

    const outlineExcerpt = typeof outline === 'string' && outline.trim()
      ? outline.trim().slice(0, 2500)
      : null;

    const userPrompt = outlineExcerpt
      ? `Gera um resumo (abstract) para a contracapa deste trabalho escolar.\n\nTema: "${theme}"\n\nEsboço aprovado do trabalho (usa isto como base para descrever o conteúdo):\n${outlineExcerpt}`
      : topic
        ? `Gera um resumo para a contracapa de um trabalho escolar.\n\nTópico geral: "${topic}"\nTema específico: "${theme}"`
        : `Gera um resumo para a contracapa de um trabalho escolar sobre: "${theme}"`;

    const response = await groqFetch((_key, _attempt) => ({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        max_tokens: 200,
        temperature: 0.4,
      }));

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
