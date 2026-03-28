// src/app/api/cover/abstract/route.ts
// Gera automaticamente um resumo (abstract) com base no tema do trabalho.
// Usada após a submissão do formulário de capa.

import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });
    }

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

    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
        max_tokens: 200,
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
        Connection: 'keep-alive',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
