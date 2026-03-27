'use client';

// hooks/useCoverAgent.ts
// Agente Groq com tool calling para decidir se gera capa/contracapa.
// Integra-se com o WorkPanel logo após a aprovação do esboço.

import { useState, useCallback } from 'react';
import type { CoverData } from '@/lib/docx/cover-types';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type CoverAgentStep =
  | 'idle'               // ainda não iniciado
  | 'asking'             // a aguardar resposta do utilizador (sim/não capa)
  | 'awaiting_form'      // tool chamada — modal aberto à espera de dados
  | 'generating_abstract'// a gerar resumo automático com base no theme
  | 'done_with_cover'    // capa gerada com sucesso
  | 'done_without_cover' // utilizador optou por não ter capa
  | 'error';

export interface CoverAgentState {
  step: CoverAgentStep;
  coverData: CoverData | null;
  abstract: string | null;
  error: string | null;
  streamingAbstract: string;
}

// ── JSON Schema da tool para o Groq ─────────────────────────────────────────

const COVER_TOOL = {
  type: 'function' as const,
  function: {
    name: 'criar_capa',
    description:
      'Coleta dados do utilizador para gerar capa e contracapa de um trabalho académico. Chama esta tool APENAS quando o utilizador confirmar que quer capa e contracapa.',
    parameters: {
      type: 'object',
      properties: {
        institution:    { type: 'string', description: 'Nome completo da instituição' },
        delegation:     { type: 'string', description: 'Delegação ou localização', nullable: true },
        logoBase64:     { type: 'string', description: 'Imagem do logotipo em base64 ou data URL', nullable: true },
        logoMediaType:  { type: 'string', enum: ['image/png', 'image/jpeg'], nullable: true },
        course:         { type: 'string', description: 'Nome do curso' },
        subject:        { type: 'string', description: 'Disciplina ou módulo' },
        theme:          { type: 'string', description: 'Tema do trabalho' },
        group:          { type: 'string', description: 'Identificação do grupo', nullable: true },
        members:        { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Lista de membros do grupo' },
        teacher:        { type: 'string', description: 'Nome do docente/orientador' },
        city:           { type: 'string', description: 'Cidade' },
        date:           { type: 'string', description: 'Data formatada' },
      },
      required: ['institution', 'course', 'subject', 'theme', 'members', 'teacher', 'city', 'date'],
    },
  },
};

// ── Prompt do agente ─────────────────────────────────────────────────────────

function buildAgentSystemPrompt(topic: string, outline: string): string {
  return `És um assistente académico especializado em trabalhos escolares do ensino secundário/médio em Moçambique.

O utilizador acabou de aprovar o esboço de um trabalho sobre: "${topic}"

ESBOÇO APROVADO:
${outline.slice(0, 800)}${outline.length > 800 ? '…' : ''}

A TUA ÚNICA TAREFA AGORA:
Pergunta ao utilizador de forma clara e directa:
"Deseja incluir capa e contracapa no trabalho, ou prefere iniciar directamente pela Introdução?"

REGRAS ABSOLUTAS:
- Faz APENAS esta pergunta — nenhuma outra
- Se o utilizador responder SIM à capa: chama a tool criar_capa IMEDIATAMENTE (não peças dados via chat)
- Se o utilizador responder NÃO à capa: responde "Entendido. Podes desenvolver as secções directamente." e não chames nenhuma tool
- Nunca pedes dados de capa via chat — apenas via tool
- Responde em português europeu`;
}

// ── Geração de abstract ───────────────────────────────────────────────────────

async function generateAbstract(
  theme: string,
  topic: string,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;

  // Chama via API Route para não expor a chave (ver nota abaixo)
  const res = await fetch('/api/cover/abstract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme, topic }),
  });

  if (!res.ok || !res.body) {
    throw new Error('Erro ao gerar resumo da capa');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          accumulated += delta;
          onDelta(delta);
        }
      } catch { /* ignorar */ }
    }
  }

  return accumulated;
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useCoverAgent() {
  const [state, setState] = useState<CoverAgentState>({
    step: 'idle',
    coverData: null,
    abstract: null,
    error: null,
    streamingAbstract: '',
  });

  // ── Iniciar: enviar mensagem do agente a perguntar sobre capa ─────────────

  const askAboutCover = useCallback(async (
    topic: string,
    outline: string,
    appendMessage: (role: 'assistant', content: string) => void,
  ) => {
    setState(prev => ({ ...prev, step: 'asking', error: null }));

    try {
      const res = await fetch('/api/cover/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          outline,
          messages: [],
        }),
      });

      if (!res.ok) throw new Error('Erro no agente de capa');
      const data = await res.json();
      const message = data.choices?.[0]?.message?.content ?? '';

      if (message) appendMessage('assistant', message);
    } catch (e: any) {
      setState(prev => ({ ...prev, step: 'error', error: e.message }));
    }
  }, []);

  // ── Processar resposta do utilizador (sim/não) ────────────────────────────

  const handleUserResponse = useCallback(async (
    userMessage: string,
    topic: string,
    outline: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    appendMessage: (role: 'assistant', content: string) => void,
    onToolCall: () => void,  // abre o modal
  ) => {
    try {
      const res = await fetch('/api/cover/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          outline,
          messages: [
            ...conversationHistory,
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!res.ok) throw new Error('Erro no agente');
      const data = await res.json();

      const choice = data.choices?.[0];
      const finishReason = choice?.finish_reason;

      // ── Tool call → abrir modal ─────────────────────────────────────────
      if (finishReason === 'tool_calls') {
        const toolCall = choice?.message?.tool_calls?.[0];
        if (toolCall?.function?.name === 'criar_capa') {
          setState(prev => ({ ...prev, step: 'awaiting_form' }));
          onToolCall();
          return;
        }
      }

      // ── Resposta de texto → utilizador não quer capa ──────────────────
      const message = choice?.message?.content ?? '';
      if (message) {
        appendMessage('assistant', message);
        setState(prev => ({ ...prev, step: 'done_without_cover' }));
      }
    } catch (e: any) {
      setState(prev => ({ ...prev, step: 'error', error: e.message }));
    }
  }, []);

  // ── Receber dados do formulário de capa e gerar abstract ─────────────────

  const submitCoverData = useCallback(async (
    coverData: CoverData,
    topic: string,
    appendMessage: (role: 'assistant', content: string) => void,
  ) => {
    setState(prev => ({
      ...prev,
      step: 'generating_abstract',
      coverData,
      streamingAbstract: '',
    }));

    try {
      let accumulated = '';

      const abstract = await generateAbstract(
        coverData.theme,
        topic,
        chunk => {
          accumulated += chunk;
          setState(prev => ({ ...prev, streamingAbstract: accumulated }));
        },
      );

      const finalData: CoverData = { ...coverData, abstract };

      setState(prev => ({
        ...prev,
        step: 'done_with_cover',
        coverData: finalData,
        abstract,
        streamingAbstract: '',
      }));

      appendMessage(
        'assistant',
        '✓ Capa e contracapa geradas com sucesso! Podes agora desenvolver as secções do trabalho.',
      );
    } catch (e: any) {
      setState(prev => ({ ...prev, step: 'error', error: e.message }));
    }
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      coverData: null,
      abstract: null,
      error: null,
      streamingAbstract: '',
    });
  }, []);

  return {
    ...state,
    askAboutCover,
    handleUserResponse,
    submitCoverData,
    reset,
  };
}
