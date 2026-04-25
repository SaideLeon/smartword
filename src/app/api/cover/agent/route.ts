// src/app/api/cover/agent/route.ts
// Agente Gemini com tool calling para decidir se gera capa/contracapa.

import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';
import { wrapUserInput, PROMPT_INJECTION_GUARD } from '@/lib/prompt-sanitizer';

const MAX_TOPIC_CHARS = 500;
const MAX_OUTLINE_CHARS = 15_000;
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 8_000;

const COVER_TOOL_DECLARATION = {
  name: 'criar_capa',
  description:
    'Coleta dados do utilizador para gerar capa e contracapa de um trabalho académico. Chama esta tool APENAS quando o utilizador confirmar que quer capa e contracapa.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      institution: {
        type: Type.STRING,
        description: 'Nome completo da instituição',
      },
      delegation: {
        type: Type.STRING,
        description: 'Delegação ou localização (opcional)',
      },
      logoBase64: {
        type: Type.STRING,
        description: 'Imagem do logotipo em base64 ou data URL (opcional)',
      },
      logoMediaType: {
        type: Type.STRING,
        enum: ['image/png', 'image/jpeg'],
        description: 'Tipo MIME do logotipo (opcional)',
      },
      course: {
        type: Type.STRING,
        description: 'Nome do curso',
      },
      subject: {
        type: Type.STRING,
        description: 'Disciplina ou módulo',
      },
      theme: {
        type: Type.STRING,
        description: 'Tema do trabalho',
      },
      group: {
        type: Type.STRING,
        description: 'Identificação do grupo (opcional)',
      },
      members: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Lista de membros do grupo',
      },
      teacher: {
        type: Type.STRING,
        description: 'Nome do docente/orientador',
      },
      city: {
        type: Type.STRING,
        description: 'Cidade',
      },
      date: {
        type: Type.STRING,
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
};

function buildSystemPrompt(): string {
  return `${PROMPT_INJECTION_GUARD}

És um assistente académico especializado em trabalhos escolares do ensino secundário/médio em Moçambique.

A TUA ÚNICA TAREFA AGORA:
Pergunta ao utilizador de forma clara e directa se deseja incluir capa e contracapa no trabalho, ou prefere iniciar directamente pela Introdução.

REGRAS ABSOLUTAS:
1. Faz APENAS esta pergunta — nada mais na primeira mensagem
2. Se o utilizador responder SIM / quiser capa: chama a tool criar_capa IMEDIATAMENTE. Não peças NENHUM dado via chat — apenas via tool. Passa strings vazias ("") nos campos obrigatórios e omite os campos opcionais.
3. Se o utilizador responder NÃO / não quiser capa: responde de forma curta e positiva, sem chamar nenhuma tool
4. Nunca inventas dados de capa — são sempre fornecidos pelo utilizador através do formulário
5. Responde sempre em português europeu
6. Quando o utilizador confirmar capa, chama criar_capa com strings vazias nos campos obrigatórios e omite completamente os campos opcionais (delegation, logoBase64, logoMediaType, group)`;
}

function toGeminiContents(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  return messages
    .filter((m) => m?.content)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

function buildGeminiContents(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  topic: string,
  outline: string,
) {
  const contents = toGeminiContents(messages);
  if (contents.length > 0) return contents;

  const outlineExcerpt = outline.slice(0, 600) + (outline.length > 600 ? '…' : '');
  return [
    {
      role: 'user' as const,
      parts: [{
        text: [
          'Contexto do trabalho a tratar:\n',
          wrapUserInput('user_topic', topic),
          '\nEsboço aprovado:\n',
          wrapUserInput('user_outline', outlineExcerpt),
          '\nInicia a conversa conforme as instruções do sistema.',
        ].join(''),
      }],
    },
  ];
}

function toLegacyResponse(text: string, functionCalls: Array<{ name: string; args?: unknown }>) {
  const toolCalls = functionCalls.map((fc, index) => ({
    id: `call_${index + 1}`,
    type: 'function',
    function: {
      name: fc.name,
      arguments: JSON.stringify(fc.args ?? {}),
    },
  }));

  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: text,
          tool_calls: toolCalls,
        },
        finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      },
    ],
  };
}

function collectGeminiKeys(): string[] {
  const keys: string[] = [];

  const base = process.env.GEMINI_API_KEY ?? '';
  if (base) {
    keys.push(...base.split(',').map((v) => v.trim()).filter(Boolean));
  }

  const plural = process.env.GEMINI_API_KEYS ?? '';
  if (plural) {
    keys.push(...plural.split(',').map((v) => v.trim()).filter(Boolean));
  }

  for (let i = 1; i <= 10; i++) {
    const candidate = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (candidate) keys.push(candidate);
  }

  return Array.from(new Set(keys));
}

function canRetryWithNextKey(status: number | null): boolean {
  return status === 429 || (status !== null && status >= 500);
}

function extractStatusFromError(error: unknown): number | null {
  const candidate = error as { status?: unknown; cause?: { status?: unknown } };
  const directStatus = typeof candidate?.status === 'number' ? candidate.status : null;
  if (directStatus !== null) return directStatus;

  const causeStatus = typeof candidate?.cause?.status === 'number' ? candidate.cause.status : null;
  if (causeStatus !== null) return causeStatus;

  const message = (error as { message?: string })?.message ?? '';
  const statusMatch = message.match(/\b(\d{3})\b/);
  return statusMatch ? Number(statusMatch[1]) : null;
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'cover:agent',
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limited) {
    console.warn('[cover:agent] rate_limited');
    return limited;
  }

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'cover', req);
  if (planError) return planError;

  try {
    const { topic, outline, messages, mode = 'unknown' } = await req.json();
    const normalizedTopic = typeof topic === 'string' ? topic.trim() : '';
    const normalizedOutline = typeof outline === 'string' && outline.trim()
      ? outline.trim()
      : 'Esboço aprovado não fornecido.';
    const messageList = Array.isArray(messages) ? messages : null;

    if (!normalizedTopic || normalizedTopic.length > MAX_TOPIC_CHARS) {
      console.warn('[cover:agent] bad_request missing_topic', { mode });
      return NextResponse.json(
        { error: 'topic inválido ou demasiado longo' },
        { status: 400 },
      );
    }

    if (normalizedOutline.length > MAX_OUTLINE_CHARS) {
      return NextResponse.json(
        { error: 'outline demasiado longo (máx 15 000 caracteres)' },
        { status: 400 },
      );
    }

    if (!messageList || messageList.length > MAX_MESSAGES) {
      return NextResponse.json(
        { error: 'messages inválidas' },
        { status: 400 },
      );
    }

    for (const message of messageList) {
      if (!message || typeof message !== 'object') {
        return NextResponse.json({ error: 'messages inválidas' }, { status: 400 });
      }
      if (message.role !== 'user' && message.role !== 'assistant') {
        return NextResponse.json({ error: 'messages inválidas' }, { status: 400 });
      }
      if (typeof message.content !== 'string' || message.content.length > MAX_MESSAGE_CHARS) {
        return NextResponse.json({ error: 'mensagem demasiado longa' }, { status: 400 });
      }
    }

    const apiKeys = collectGeminiKeys();
    if (apiKeys.length === 0) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada.' },
        { status: 500 },
      );
    }

    const lastUserMessage = [...messageList].reverse().find((m: any) => m?.role === 'user')?.content ?? '';
    const normalizedLastUserMessage = String(lastUserMessage).toLowerCase();
    const userIntent = /\b(sim|quero|ok|pode|inclui|incluir)\b/.test(normalizedLastUserMessage)
      ? 'accept_cover_likely'
      : /\b(nao|não|sem capa|saltar|dispenso)\b/.test(normalizedLastUserMessage)
        ? 'reject_cover_likely'
        : 'unknown';

    console.info('[cover:agent] request', {
      mode,
      topicPreview: normalizedTopic.slice(0, 120),
      outlineChars: normalizedOutline.length,
      messagesCount: messageList.length,
      userIntent,
      lastUserPreview: String(lastUserMessage).slice(0, 120),
    });

    let result: any = null;
    let lastErrorMessage = 'Erro ao chamar Gemini.';

    for (let i = 0; i < apiKeys.length; i++) {
      const ai = new GoogleGenAI({ apiKey: apiKeys[i] });
      try {
        result = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: buildGeminiContents(messageList, normalizedTopic, normalizedOutline),
          config: {
            systemInstruction: buildSystemPrompt(),
            temperature: 0.3,
            maxOutputTokens: 512,
            tools: [{ functionDeclarations: [COVER_TOOL_DECLARATION] }],
          },
        });
        break;
      } catch (error: any) {
        const status = extractStatusFromError(error);
        lastErrorMessage = error?.message ?? `Erro Gemini (status ${status ?? 'desconhecido'}).`;

        if (i < apiKeys.length - 1 && canRetryWithNextKey(status)) {
          console.warn('[cover:agent] gemini_retry_next_key', {
            status,
            keyIndex: i + 1,
            totalKeys: apiKeys.length,
          });
          continue;
        }

        throw new Error(lastErrorMessage);
      }
    }

    if (!result) {
      throw new Error(lastErrorMessage);
    }

    const candidate = result?.candidates?.[0];
    const text = result?.text ?? candidate?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') ?? '';
    const parts = candidate?.content?.parts ?? [];
    const fromParts = parts
      .map((part: any) => part?.functionCall)
      .filter((fc: any) => Boolean(fc?.name));
    const fromResponse = Array.isArray(result?.functionCalls)
      ? result.functionCalls.filter((fc: any) => Boolean(fc?.name))
      : [];
    const functionCalls = fromResponse.length > 0 ? fromResponse : fromParts;

    const toolNames = functionCalls.map((fc: any) => fc.name);
    const hasCreateCover = toolNames.includes('criar_capa');

    console.info('[cover:agent] response', {
      mode,
      finishReason: candidate?.finishReason ?? null,
      hasToolCalls: functionCalls.length > 0,
      toolNames,
      hasCreateCover,
      assistantPreview: String(text).slice(0, 180),
      modalExpected: hasCreateCover,
    });

    return NextResponse.json(toLegacyResponse(text, functionCalls));
  } catch (e: any) {
    console.error('[cover:agent] error', {
      message: e?.message ?? 'Erro desconhecido',
      stack: e?.stack,
    });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
