// src/app/api/cover/agent/route.ts
// Agente Groq com tool calling para decidir se gera capa/contracapa.

import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { groqJSON } from '@/lib/groq-resilient';

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
  if (limited) {
    console.warn('[cover:agent] rate_limited');
    return limited;
  }

  try {
    const { topic, outline, messages, mode = 'unknown', phase = 'unknown' } = await req.json();

    if (!topic) {
      console.warn('[cover:agent] bad_request missing_topic', { mode, phase });
      return NextResponse.json(
        { error: 'topic é obrigatório' },
        { status: 400 },
      );
    }

    const normalizedOutline = typeof outline === 'string' && outline.trim()
      ? outline.trim()
      : 'Esboço aprovado não fornecido.';

    const messageList = Array.isArray(messages) ? messages : [];
    const lastUserMessage = [...messageList].reverse().find((m: any) => m?.role === 'user')?.content ?? '';
    const normalizedLastUserMessage = String(lastUserMessage).toLowerCase();
    const userIntent = /\b(sim|quero|ok|pode|inclui|incluir)\b/.test(normalizedLastUserMessage)
      ? 'accept_cover_likely'
      : /\b(nao|não|sem capa|saltar|dispenso)\b/.test(normalizedLastUserMessage)
        ? 'reject_cover_likely'
        : 'unknown';

    console.info('[cover:agent] request', {
      mode,
      phase,
      topicPreview: String(topic).slice(0, 120),
      outlineChars: normalizedOutline.length,
      messagesCount: messageList.length,
      userIntent,
      lastUserPreview: String(lastUserMessage).slice(0, 120),
    });

    const systemPrompt = buildSystemPrompt(topic, normalizedOutline);

    const data = await groqJSON((_key, _attempt) => ({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messageList,
        ],
        tools: [COVER_TOOL],
        tool_choice: 'auto',
        stream: false,
        max_tokens: 512,
        temperature: 0.3,
      }));

    const choice = (data as any)?.choices?.[0];
    const toolCalls = choice?.message?.tool_calls ?? [];
    const toolNames = toolCalls
      .map((tc: any) => tc?.function?.name)
      .filter(Boolean);
    const hasCreateCover = toolNames.includes('criar_capa');
    const assistantPreview = String(choice?.message?.content ?? '').slice(0, 180);

    console.info('[cover:agent] response', {
      mode,
      phase,
      finishReason: choice?.finish_reason ?? null,
      hasToolCalls: toolCalls.length > 0,
      toolNames,
      hasCreateCover,
      assistantPreview,
      modalExpected: hasCreateCover,
    });

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[cover:agent] error', {
      message: e?.message ?? 'Erro desconhecido',
      stack: e?.stack,
    });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
