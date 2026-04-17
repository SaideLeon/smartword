'use client';

import { useState, useCallback, useRef } from 'react';
import { ProcessingBars } from '@/components/ProcessingBars';
import { AudioInputButton } from '@/components/AudioInputButton';

interface Props {
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  onOpenFullChat: () => void;
}

const SUGGESTIONS = [
  'Explica equações do 2.º grau com exemplos',
  'Exercícios sobre logaritmos com soluções',
  'Resumo das progressões aritméticas',
];

export function IaMiniPanel({ onInsert, onReplace, onOpenFullChat }: Props) {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentAction, setRecentAction] = useState<'insert' | 'replace' | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((action: 'insert' | 'replace') => {
    setRecentAction(action);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    actionTimerRef.current = setTimeout(() => setRecentAction(null), 2000);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setResponse('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error('Erro');

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
            if (delta) { accumulated += delta; setResponse(accumulated); }
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setResponse('_Erro ao gerar resposta._');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading]);

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <span className="text-[14px] text-[var(--gold2)]">✦</span>
        <span className="font-mono text-[11px] font-semibold tracking-[.04em] text-[var(--gold2)]">IA · Matemática</span>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Description */}
        <p className="font-mono text-[10px] leading-[1.6] text-[var(--muted)] text-center">
          Descreve o conteúdo que queres gerar.
          <br />
          <strong className="text-[var(--gold2)]">Equações LaTeX prontas para Word.</strong>
        </p>

        {/* Suggestions */}
        {!response && !loading && (
          <div className="space-y-1">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="w-full cursor-pointer rounded border border-[var(--border2)] bg-transparent px-2 py-1.5 text-left font-mono text-[10px] leading-[1.45] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Response preview */}
        {(response || loading) && (
          <div className="max-h-48 overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface2)] p-2.5 font-mono text-[10px] leading-[1.65] text-[var(--muted)]">
            {loading && !response && <ProcessingBars height={10} />}
            {response}
            {loading && response && <span className="inline-block w-px h-3 bg-[var(--gold2)] animate-pulse ml-px align-middle" />}
          </div>
        )}

        {/* Response actions */}
        {response && !loading && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { onInsert(response); showFeedback('insert'); }}
              className="flex-1 rounded border border-[var(--green)]/40 bg-[var(--green)]/10 py-1.5 font-mono text-[10px] text-[var(--green)] transition hover:bg-[var(--green)]/20"
            >
              {recentAction === 'insert' ? '✓ Inserido' : '↓ Inserir'}
            </button>
            <button
              type="button"
              onClick={() => { onReplace(response); showFeedback('replace'); }}
              className="flex-1 rounded border border-[var(--gold2)]/40 bg-[var(--gold2)]/10 py-1.5 font-mono text-[10px] text-[var(--gold2)] transition hover:bg-[var(--gold2)]/20"
            >
              {recentAction === 'replace' ? '✓ Aplicado' : '⟳ Substituir'}
            </button>
          </div>
        )}

        {/* Input */}
        <div className="space-y-1.5">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Gera exercícios sobre equações do 2.º grau…"
            rows={3}
            className="w-full resize-none rounded border border-[var(--border2)] bg-[var(--surface2)] p-2 font-mono text-[10px] leading-[1.55] text-[var(--ink)] caret-[var(--gold2)] outline-none placeholder-[var(--faint)] transition focus:border-[var(--gold2)]"
          />
          <div className="flex gap-1.5">
            <AudioInputButton
              onTranscription={text => setInput(prev => prev ? `${prev} ${text}` : text)}
              disabled={loading}
              className="border-[var(--border2)]"
            />
            <button
              type="button"
              onClick={loading ? () => { abortRef.current?.abort(); setLoading(false); } : send}
              className={`flex-1 rounded py-1.5 font-mono text-[10px] font-bold transition ${
                loading
                  ? 'border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : input.trim()
                    ? 'bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black hover:brightness-110'
                    : 'border border-[var(--border2)] text-[var(--dim)]'
              }`}
            >
              {loading ? '■ Parar' : '↑ Enviar'}
            </button>
          </div>
        </div>

        {/* Open full chat */}
        <button
          type="button"
          onClick={onOpenFullChat}
          className="w-full rounded border border-[var(--border2)] py-1.5 font-mono text-[10px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
        >
          ↗ Abrir chat completo
        </button>
      </div>
    </div>
  );
}
