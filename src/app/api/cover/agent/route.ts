// src/app/api/cover/agent/route.ts
// Agente Gemini com tool calling para decidir se gera capa/contracapa.

import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';

const COVER_TOOL_DECLARATION = {
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
        description: 'Delegação ou localização (opcional)',
      },
      logoBase64: {
        type: 'string',
        description: 'Imagem do logotipo em base64 ou data URL (opcional)',
      },
      logoMediaType: {
        type: 'string',
        enum: ['image/png', 'image/jpeg'],
        description: 'Tipo MIME do logotipo (opcional)',
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
        description: 'Identificação do grupo (opcional)',
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
};

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

    const apiKeys = collectGeminiKeys();
    if (apiKeys.length === 0) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada.' },
        { status: 500 },
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

    const payload = {
      systemInstruction: { parts: [{ text: buildSystemPrompt(topic, normalizedOutline) }] },
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
      tools: [{ functionDeclarations: [COVER_TOOL_DECLARATION] }],
      contents: toGeminiContents(messageList),
    };

    let result: any = null;
    let lastErrorMessage = 'Erro ao chamar Gemini.';

    for (let i = 0; i < apiKeys.length; i++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeys[i]}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const json = await response.json();
      if (response.ok) {
        result = json;
        break;
      }

      lastErrorMessage = json?.error?.message ?? `Erro Gemini (status ${response.status}).`;
      if (i < apiKeys.length - 1 && canRetryWithNextKey(response.status)) {
        console.warn('[cover:agent] gemini_retry_next_key', {
          status: response.status,
          keyIndex: i + 1,
          totalKeys: apiKeys.length,
        });
        continue;
      }

      throw new Error(lastErrorMessage);
    }

    if (!result) {
      throw new Error(lastErrorMessage);
    }

    const candidate = result?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') ?? '';
    const parts = candidate?.content?.parts ?? [];
    const functionCalls = parts
      .map((part: any) => part?.functionCall)
      .filter((fc: any) => Boolean(fc?.name));

    const toolNames = functionCalls.map((fc: any) => fc.name);
    const hasCreateCover = toolNames.includes('criar_capa');

    console.info('[cover:agent] response', {
      mode,
      phase,
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
