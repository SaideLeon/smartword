'use client';

// src/hooks/useRequerimento.ts
// Orquestra a geração de requerimentos:
//   1. abre o modal RequerimentoFormModal
//   2. envia os dados para /api/requerimento/generate
//   3. despoleta o download do .docx

import { useState, useCallback } from 'react';
import { showAppAlert } from '@/lib/ui-alert';
import type { RequerimentoData } from '@/lib/docx/requerimento-types';

export type RequerimentoStep = 'idle' | 'form' | 'generating' | 'done' | 'error';

export function useRequerimento() {
  const [step,    setStep]    = useState<RequerimentoStep>('idle');
  const [error,   setError]   = useState<string | null>(null);

  const openForm = useCallback(() => {
    setStep('form');
    setError(null);
  }, []);

  const closeForm = useCallback(() => {
    setStep('idle');
  }, []);

  const generate = useCallback(async (data: RequerimentoData) => {
    setStep('generating');
    setError(null);

    try {
      const res = await fetch('/api/requerimento/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body?.error === 'string'
            ? body.error
            : 'Falha ao gerar o requerimento.',
        );
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;

      // Tenta extrair o nome do ficheiro do header Content-Disposition
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : 'requerimento.docx';

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStep('done');
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      setStep('error');
      showAppAlert({ title: 'Erro ao gerar requerimento', message });
    }
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
  }, []);

  return {
    step,
    error,
    isFormOpen:    step === 'form',
    isGenerating:  step === 'generating',
    openForm,
    closeForm,
    generate,
    reset,
  };
}
