// src/app/api/cover/abstract/route.ts
// Gera automaticamente um resumo (abstract) com base no tema do trabalho.
// Usada após a submissão do formulário de capa.

import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { parseCoverAbstractPayload } from '@/lib/validation/input-guards';
import { wrapUserInput, PROMPT_INJECTION_GUARD } from '@/lib/prompt-sanitizer';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';

const SYSTEM = `${PROMPT_INJECTION_GUARD}

És um especialista em redacção académica do ensino secundário/médio em Moçambique.
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
  const limited = await enforceRateLimit(req, {
    scope: 'cover:abstract',
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'cover');
  if (planError) return planError;

  try {
    const parsedPayload = parseCoverAbstractPayload(await req.json());
    if (!parsedPayload) {
      return NextResponse.json({ error: 'Payload inválido ou demasiado longo' }, { status: 400 });
    }

    const { theme, topic, outline } = parsedPayload;

    const outlineExcerpt = outline
      ? outline.slice(0, 2500)
      : null;

    const userPrompt = outlineExcerpt
      ? `Gera um resumo (abstract) para a contracapa deste trabalho escolar.\n\nTema:\n${wrapUserInput('user_theme', theme)}\n\nEsboço aprovado do trabalho (usa isto como base para descrever o conteúdo):\n${wrapUserInput('user_outline', outlineExcerpt)}`
      : topic
        ? `Gera um resumo para a contracapa de um trabalho escolar.\n\nTópico geral:\n${wrapUserInput('user_topic', topic)}\nTema específico:\n${wrapUserInput('user_theme', theme)}`
        : `Gera um resumo para a contracapa de um trabalho escolar sobre:\n${wrapUserInput('user_theme', theme)}`;

    const stream = await geminiGenerateTextStreamSSE({
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      maxOutputTokens: 200,
      temperature: 0.4,
    });

    return new NextResponse(stream, {
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
