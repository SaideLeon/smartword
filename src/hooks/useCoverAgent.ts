'use client';

// hooks/useCoverAgent.ts

import { useState, useCallback } from 'react';
import type { CoverData } from '@/lib/docx/cover-types';
import { readApiErrorMessage } from '@/lib/api-error';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type CoverAgentStep =
  | 'idle'
  | 'asking'
  | 'awaiting_form'
  | 'generating_abstract'
  | 'done_with_cover'
  | 'done_without_cover'
  | 'error';

export interface CoverAgentState {
  step: CoverAgentStep;
  coverData: CoverData | null;
  abstract: string | null;
  error: string | null;
  streamingAbstract: string;
}

interface CoverAgentContext {
  mode: 'tcc' | 'work';
}

const COVER_INITIAL_QUESTION =
  'Deseja incluir capa e contracapa no seu trabalho, ou prefere iniciar directamente pela Introdução?';

// ── JSON Schema da tool ───────────────────────────────────────────────────────
// IMPORTANTE: não usar "nullable: true" — manter schema simples para compatibilidade.
// Campos opcionais são simplesmente omitidos do array "required".

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
        delegation:     { type: 'string', description: 'Delegação ou localização (opcional)' },
        logoBase64:     { type: 'string', description: 'Imagem do logotipo em base64 ou data URL (opcional)' },
        logoMediaType:  { type: 'string', enum: ['image/png', 'image/jpeg'], description: 'Tipo MIME do logotipo (opcional)' },
        course:         { type: 'string', description: 'Nome do curso' },
        subject:        { type: 'string', description: 'Disciplina ou módulo' },
        theme:          { type: 'string', description: 'Tema do trabalho' },
        group:          { type: 'string', description: 'Identificação do grupo (opcional)' },
        members:        { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Lista de membros do grupo' },
        teacher:        { type: 'string', description: 'Nome do docente/orientador' },
        city:           { type: 'string', description: 'Cidade' },
        date:           { type: 'string', description: 'Data formatada' },
      },
      required: ['institution', 'course', 'subject', 'theme', 'members', 'teacher', 'city', 'date'],
    },
  },
};

// ── Geração de abstract ───────────────────────────────────────────────────────

async function generateAbstract(
  theme: string,
  topic: string,
  outline: string,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const res = await fetch('/api/cover/abstract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme, topic, outline }),
  });

  if (!res.ok || !res.body) {
    const errorMessage = await readApiErrorMessage(res, 'Erro ao gerar resumo da capa');
    throw new Error(errorMessage);
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

  // ── Restaurar dados de capa de uma sessão anterior ────────────────────────

  const restoreCoverData = useCallback((coverData: CoverData) => {
    setState({
      step: 'done_with_cover',
      coverData,
      abstract: coverData.abstract ?? null,
      error: null,
      streamingAbstract: '',
    });
  }, []);

  // ── Iniciar: perguntar sobre capa ─────────────────────────────────────────

  const askAboutCover = useCallback((
    _topic: string,
    _outline: string,
    appendMessage: (role: 'assistant', content: string) => void,
    _context?: CoverAgentContext,
  ) => {
    setState(prev => ({ ...prev, step: 'asking', error: null }));
    appendMessage('assistant', COVER_INITIAL_QUESTION);
  }, []);

  // ── Processar resposta do utilizador (sim/não) ────────────────────────────

  const handleUserResponse = useCallback(async (
    userMessage: string,
    topic: string,
    outline: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    appendMessage: (role: 'assistant', content: string) => void,
    onToolCall: () => void,
    context?: CoverAgentContext,
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
          mode: context?.mode ?? 'work',
        }),
      });

      if (!res.ok) {
        const errorMessage = await readApiErrorMessage(res, 'Erro no agente');
        throw new Error(errorMessage);
      }
      const data = await res.json();

      const choice = data.choices?.[0];
      const toolCalls = choice?.message?.tool_calls ?? [];
      const hasCreateCoverTool = toolCalls.some((tc: any) => tc?.function?.name === 'criar_capa');
      if (hasCreateCoverTool) {
        setState(prev => ({ ...prev, step: 'awaiting_form' }));
        onToolCall();
        return;
      }

      const message = choice?.message?.content ?? '';
      if (message) {
        appendMessage('assistant', message);
        setState(prev => ({ ...prev, step: 'done_without_cover' }));
      } else {
        appendMessage(
          'assistant',
          'Entendido. Podes desenvolver as secções directamente.',
        );
        setState(prev => ({ ...prev, step: 'done_without_cover' }));
      }
    } catch (e: any) {
      setState(prev => ({ ...prev, step: 'error', error: e.message }));
    }
  }, []);

  // ── Receber dados do formulário de capa e gerar abstract ──────────────────

  const submitCoverData = useCallback(async (
    coverData: CoverData,
    topic: string,
    outline: string,
    appendMessage: (role: 'assistant', content: string) => void,
  ): Promise<CoverData | null> => {
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
        outline,
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

      return finalData;
    } catch (e: any) {
      setState(prev => ({ ...prev, step: 'error', error: e.message }));
      return null;
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

  const chooseWithoutCover = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: 'done_without_cover',
      coverData: null,
      abstract: null,
      streamingAbstract: '',
      error: null,
    }));
  }, []);

  const chooseCover = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: 'awaiting_form',
      error: null,
    }));
  }, []);

  return {
    ...state,
    askAboutCover,
    handleUserResponse,
    submitCoverData,
    restoreCoverData,
    chooseCover,
    chooseWithoutCover,
    reset,
  };
}
