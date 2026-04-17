// src/app/api/ai/inline/route.ts
// Inline AI text editing — replaces/improves selected text based on instruction.
// Called by AiBubbleMenu when user picks an AI action on selected text.

import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/api-auth';
import { geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { wrapUserInput, PROMPT_INJECTION_GUARD } from '@/lib/prompt-sanitizer';

// ── Limits ────────────────────────────────────────────────────────────────────

const MAX_TEXT_CHARS    = 8_000;
const MAX_CONTEXT_CHARS = 2_000;
const MAX_PROMPT_CHARS  = 500;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `${PROMPT_INJECTION_GUARD}

És um editor académico especialista em português europeu.
Recebes um texto de um documento académico e uma instrução de modificação.

REGRAS OBRIGATÓRIAS:
- Responde EXCLUSIVAMENTE com o texto modificado — sem prefixos, sem explicações, sem aspas
- NUNCA escrevas frases como "Aqui está o texto:" ou "Texto melhorado:"
- NUNCA uses aspas duplas à volta do resultado
- Mantém o registo académico e o estilo do texto original
- Usa português europeu correcto (não português do Brasil)
- Preserva toda a formatação Markdown presente no original (negrito, itálico, ## headings, listas, etc.)
- Preserva marcadores especiais como {pagebreak}, {section}, {toc} exactamente como estão
- Se a instrução pedir tradução, mantém a formatação mas muda o idioma
- O resultado deve ser pronto a usar — o utilizador vai substituir o texto seleccionado pelo teu resultado`;

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Rate limit: 30 requests/minute per IP
  const limited = await enforceRateLimit(req, {
    scope: 'ai:inline',
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  // Require authenticated user
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();

    // ── Input validation ──────────────────────────────────────────────────────

    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : '';
    const context = typeof body?.context === 'string' ? body.context.trim().slice(0, MAX_CONTEXT_CHARS) : '';

    if (!text || !instruction) {
      return NextResponse.json(
        { error: 'text e instruction são obrigatórios' },
        { status: 400 },
      );
    }
    if (text.length > MAX_TEXT_CHARS) {
      return NextResponse.json(
        { error: `Texto demasiado longo (máx ${MAX_TEXT_CHARS} caracteres)` },
        { status: 400 },
      );
    }
    if (instruction.length > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        { error: `Instrução demasiado longa (máx ${MAX_PROMPT_CHARS} caracteres)` },
        { status: 400 },
      );
    }

    // ── Build user prompt ─────────────────────────────────────────────────────

    const parts = [
      context
        ? `Contexto do documento (para referência do estilo e tema):\n${wrapUserInput('user_context', context)}`
        : null,
      `Instrução:\n${wrapUserInput('user_instruction', instruction)}`,
      `Texto a modificar:\n${wrapUserInput('user_text', text)}`,
    ].filter(Boolean);

    const userPrompt = parts.join('\n\n');

    // ── Stream response ───────────────────────────────────────────────────────

    const stream = await geminiGenerateTextStreamSSE({
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      maxOutputTokens: 2048,
      temperature: 0.35,
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    console.error('[api/ai/inline]', e);
    return NextResponse.json(
      { error: e?.message ?? 'Erro interno' },
      { status: 500 },
    );
  }
}
