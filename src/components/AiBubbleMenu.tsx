'use client';

import { useState, useCallback, useRef } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { Sparkles, ChevronRight, X, Check, RotateCcw, Loader2, Copy, Scissors, WholeWord } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  editor: Editor;
}

type Phase = 'idle' | 'custom' | 'loading' | 'preview';

interface AiAction {
  label: string;
  emoji: string;
  prompt: string;
}

// ── Quick action definitions ──────────────────────────────────────────────────

const ACTIONS: AiAction[] = [
  {
    label: 'Melhorar',
    emoji: '✦',
    prompt:
      'Melhora o texto: corrige erros, aumenta a clareza e o nível académico. Mantém o significado e o tamanho aproximado. Usa português europeu.',
  },
  {
    label: 'Expandir',
    emoji: '↔',
    prompt:
      'Expande o texto com mais detalhes, exemplos concretos e argumentação académica. Aumenta o texto em 50-100%.',
  },
  {
    label: 'Resumir',
    emoji: '↕',
    prompt:
      'Resume o texto de forma concisa mantendo os pontos mais importantes. Reduz o texto em 40-60%.',
  },
  {
    label: 'Corrigir',
    emoji: '✓',
    prompt:
      'Corrige APENAS erros ortográficos, gramaticais e de pontuação. Não altera o conteúdo nem o estilo. Usa as normas do português europeu.',
  },
  {
    label: 'Formalizar',
    emoji: '≡',
    prompt:
      'Reescreve o texto num registo académico formal, adequado para um trabalho universitário. Elimina coloquialismos e imprecisões.',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function AiBubbleMenu({ editor }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [customPrompt, setCustomPrompt] = useState('');
  const [result, setResult] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // ── Get selected text ───────────────────────────────────────────────────────

  const getSelectedText = useCallback(() => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, '\n');
  }, [editor]);

  // ── Native editing helpers (copy/cut/select-all) ──────────────────────────

  const copySelection = useCallback(async () => {
    const text = getSelectedText();
    if (!text.trim()) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      document.execCommand('copy');
    }
  }, [getSelectedText]);

  const cutSelection = useCallback(async () => {
    const { empty } = editor.state.selection;
    if (empty || !editor.isEditable) return;

    await copySelection();
    editor.chain().focus().deleteSelection().run();
  }, [copySelection, editor]);

  const selectAll = useCallback(() => {
    editor.chain().focus().selectAll().run();
  }, [editor]);

  // ── Call AI API ─────────────────────────────────────────────────────────────

  const runAi = useCallback(async (prompt: string) => {
    const text = getSelectedText();
    if (!text.trim()) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLastPrompt(prompt);
    setPhase('loading');
    setResult('');

    try {
      // Get surrounding context for better results (first 2 000 chars of doc)
      const markdownStorage = (editor.storage as { markdown?: { getMarkdown?: () => string } }).markdown;
      const context = markdownStorage?.getMarkdown?.()?.slice(0, 2000) ?? '';

      const res = await fetch('/api/ai/inline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, instruction: prompt, context }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error('Falha na resposta do servidor');

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
              setResult(accumulated);
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      setPhase('preview');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[AiBubbleMenu]', err);
        setPhase('idle');
      }
    }
  }, [editor, getSelectedText]);

  // ── Reset state ─────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setResult('');
    setCustomPrompt('');
    setLastPrompt('');
  }, []);

  // ── Apply result to editor ───────────────────────────────────────────────────

  const applyResult = useCallback(() => {
    if (!result) return;

    // Replace the selected text with the AI result
    editor
      .chain()
      .focus()
      .command(({ tr, state }) => {
        const { from, to } = state.selection;
        tr.replaceWith(from, to, state.schema.text(result));
        return true;
      })
      .run();

    reset();
  }, [editor, reset, result]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top-start',
        offset: 10,
      }}
      appendTo={() => document.body}
      shouldShow={({ editor, state }) => {
        const { from, to, empty } = state.selection;
        // Show only when real text is selected (not inside code block)
        return !empty && from !== to && !editor.isActive('codeBlock');
      }}
    >
      <div
        className="overflow-hidden rounded-xl border border-[color:rgba(201,169,110,0.55)] bg-[color:rgba(18,15,12,0.96)] text-[#f0e6d5] shadow-[0_14px_36px_rgba(0,0,0,0.62)] ring-1 ring-black/40"
        style={{ backdropFilter: 'blur(12px)' }}
      >

        {/* ── IDLE: action buttons column ── */}
        {phase === 'idle' && (
          <div className="flex flex-col p-1">
            <div className="px-3 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#6b5e4e]">
              Edição
            </div>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => void cutSelection()}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-[11px] text-[#f1e7d8] transition-all hover:bg-[#2a241f] hover:text-white"
              title="Cortar"
            >
              <Scissors className="h-3 w-3 text-[var(--gold2)]" />
              <span>Cortar</span>
            </button>

            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => void copySelection()}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-[11px] text-[#f1e7d8] transition-all hover:bg-[#2a241f] hover:text-white"
              title="Copiar"
            >
              <Copy className="h-3 w-3 text-[var(--gold2)]" />
              <span>Copiar</span>
            </button>

            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={selectAll}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-[11px] text-[#f1e7d8] transition-all hover:bg-[#2a241f] hover:text-white"
              title="Selecionar tudo"
            >
              <WholeWord className="h-3 w-3 text-[var(--gold2)]" />
              <span>Selecionar tudo</span>
            </button>

            <div className="my-1 h-px bg-[#3f352b]" />

            {/* IA label */}
            <div className="flex items-center gap-1.5 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--gold2)]">
              <Sparkles className="h-3 w-3" />
              <span>IA</span>
            </div>

            {/* Quick actions */}
            {ACTIONS.map(action => (
              <button
                key={action.label}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => runAi(action.prompt)}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-[11px] text-[#f1e7d8] transition-all hover:bg-[#2a241f] hover:text-white"
              >
                <span className="w-3 text-center text-[var(--gold2)]">{action.emoji}</span>
                <span>{action.label}</span>
              </button>
            ))}

            <div className="my-1 h-px bg-[#3f352b]" />

            {/* Custom prompt */}
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                setPhase('custom');
                setTimeout(() => customInputRef.current?.focus(), 50);
              }}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-[11px] text-[#f1e7d8] transition-all hover:bg-[#2a241f] hover:text-white"
            >
              <ChevronRight className="h-3 w-3 text-[var(--gold2)]" />
              <span>Instrução custom</span>
            </button>
          </div>
        )}

        {/* ── CUSTOM: text input ── */}
        {phase === 'custom' && (
          <div className="flex items-center gap-2 p-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--gold2)]" />
            <input
              ref={customInputRef}
              type="text"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customPrompt.trim()) runAi(customPrompt);
                if (e.key === 'Escape') reset();
              }}
              placeholder="Ex: traduz para inglês académico…"
              className="min-w-[200px] flex-1 rounded border border-[#4f4338] bg-[#15120f] px-3 py-1.5 font-mono text-[11px] text-[#f5ebdc] outline-none placeholder:text-[#a99a86] focus:border-[var(--gold2)]"
            />
            <button
              type="button"
              disabled={!customPrompt.trim()}
              onMouseDown={e => e.preventDefault()}
              onClick={() => customPrompt.trim() && runAi(customPrompt)}
              className="rounded border border-[var(--gold2)]/50 bg-[var(--gold2)]/10 px-3 py-1.5 font-mono text-[11px] text-[var(--gold2)] transition hover:bg-[var(--gold2)]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↵ Aplicar
            </button>
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={reset}
              className="flex h-8 w-8 items-center justify-center rounded border border-[#4f4338] text-[#b9aa95] transition hover:border-[#c9a96e] hover:text-[#f5ebdc]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── LOADING: streaming preview ── */}
        {phase === 'loading' && (
          <div className="flex max-w-[340px] items-start gap-3 p-3">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--gold2)]" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#b9aa95]">
                A processar…
              </p>
              {result && (
                <p className="line-clamp-3 font-mono text-[11px] leading-[1.65] text-[#f1e7d8]">
                  {result}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={reset}
              className="flex-shrink-0 text-[#b9aa95] hover:text-[#f5ebdc]"
              title="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── PREVIEW: result ready ── */}
        {phase === 'preview' && (
          <div className="max-w-[380px] p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[var(--gold2)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--gold2)]">
                  Sugestão IA
                </span>
              </div>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={reset}
                className="text-[#b9aa95] transition hover:text-[#f5ebdc]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Result preview */}
            <div className="max-h-[140px] overflow-y-auto rounded border border-[#4f4338] bg-[#1a1612] px-3 py-2.5 font-mono text-[11px] leading-[1.7] text-[#f1e7d8]">
              {result}
            </div>

            {/* Actions */}
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={applyResult}
                className="flex flex-1 items-center justify-center gap-1.5 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] py-1.5 font-mono text-[11px] font-semibold text-black transition hover:brightness-110"
              >
                <Check className="h-3.5 w-3.5" />
                Aplicar
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => runAi(lastPrompt)}
                title="Gerar nova versão"
                className="flex items-center justify-center gap-1.5 rounded border border-[#4f4338] px-3 py-1.5 font-mono text-[11px] text-[#f1e7d8] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Novo
              </button>
            </div>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
