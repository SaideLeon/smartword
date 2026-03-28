// src/app/api/cover/agent/route.ts
// Agente Groq com tool calling para decidir se gera capa/contracapa.

import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

// ── JSON Schema da tool ───────────────────────────────────────────────────────

const COVER_TOOL = {
  type: 'function',
  function: {
    name: 'criar_capa',
    description:
      'Coleta dados do utilizador para gerar capa e contracapa de um trabalho académico. Chama esta tool APENAS quando o utilizador confirmar que quer capa e contracapa.',
    parameters: {
      type: 'object',
      properties: {
        institution: {
          type: 'string',
          description: 'Nome completo da instituição',
        },
        delegation: {
          type: 'string',
          description: 'Delegação ou localização',
          nullable: true,
        },
        logoBase64: {
          type: 'string',
          description: 'Imagem do logotipo em base64 ou data URL',
          nullable: true,
        },
        logoMediaType: {
          type: 'string',
          enum: ['image/png', 'image/jpeg'],
          nullable: true,
        },
        course: {
          type: 'string',
          description: 'Nome do curso',
        },
        subject: {
          type: 'string',
          description: 'Disciplina ou módulo',
        },
        theme: {
          type: 'string',
          description: 'Tema do trabalho',
        },
        group: {
          type: 'string',
          description: 'Identificação do grupo',
          nullable: true,
        },
        members: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'Lista de membros do grupo',
        },
        teacher: {
          type: 'string',
          description: 'Nome do docente/orientador',
        },
        city: {
          type: 'string',
          description: 'Cidade',
        },
        date: {
          type: 'string',
          description: 'Data formatada',
        },
      },
      required: [
        'institution',
        'course',
        'subject',
        'theme',
        'members',
        'teacher',
        'city',
        'date',
      ],
    },
  },
};

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(topic: string, outline: string): string {
  const outlineExcerpt = outline.slice(0, 600) + (outline.length > 600 ? '…' : '');

  return `És um assistente académico especializado em trabalhos escolares do ensino secundário/médio em Moçambique.

O utilizador acabou de aprovar o esboço de um trabalho sobre: "${topic}"

ESBOÇO APROVADO (resumo):
${outlineExcerpt}

A TUA ÚNICA TAREFA AGORA:
Pergunta ao utilizador de forma clara e directa se deseja incluir capa e contracapa no trabalho, ou prefere iniciar directamente pela Introdução.

REGRAS ABSOLUTAS:
1. Faz APENAS esta pergunta — nada mais na primeira mensagem
2. Se o utilizador responder SIM / quiser capa: chama a tool criar_capa IMEDIATAMENTE. Não peças NENHUM dado via chat — apenas via tool.
3. Se o utilizador responder NÃO / não quiser capa: responde de forma curta e positiva, sem chamar nenhuma tool
4. Nunca inventas dados de capa — são sempre fornecidos pelo utilizador através do formulário
5. Responde sempre em português europeu
6. Quando o utilizador confirmar capa, deves chamar criar_capa com valores placeholder vazios — o sistema substituirá pelos dados reais do formulário`;
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, {
    scope: 'cover:agent',
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { topic, outline, messages } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });
    }

    if (!topic) {
      return NextResponse.json(
        { error: 'topic é obrigatório' },
        { status: 400 },
      );
    }

    const normalizedOutline = typeof outline === 'string' && outline.trim()
      ? outline.trim()
      : 'Esboço aprovado não fornecido.';

    const systemPrompt = buildSystemPrompt(topic, normalizedOutline);

    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages ?? []),
        ],
        tools: [COVER_TOOL],
        tool_choice: 'auto',
        stream: false,
        max_tokens: 512,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
