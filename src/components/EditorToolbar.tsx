'use client';

import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code, Quote, Minus,
  Undo2, Redo2, List, ListOrdered, Heading1, Heading2, Heading3,
  Pi, Users, Code2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  editor: Editor | null;
  isMobile?: boolean;
  collabActive?: boolean;
  collabPeers?: number;
  onToggleCollab?: () => void;
}

interface BtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolBtn({ icon, label, onClick, active, disabled }: BtnProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded transition-all ${
        active
          ? 'bg-[var(--gold)]/20 text-[var(--gold2)]'
          : disabled
            ? 'cursor-not-allowed text-[var(--faint)]'
            : 'text-[var(--muted)] hover:bg-[var(--border)]/70 hover:text-[var(--ink)]'
      }`}
    >
      {icon}
    </button>
  );
}

function Sep() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-[var(--border)]" />;
}

// ── Math dialog ───────────────────────────────────────────────────────────────

function MathDialog({
  onInsert,
  onClose,
}: {
  onInsert: (latex: string, block: boolean) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');

  const submit = (block: boolean) => {
    if (!input.trim()) return;
    onInsert(input.trim(), block);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--faint)]">
          Equação LaTeX
        </p>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.shiftKey) submit(true);
            else if (e.key === 'Enter') submit(false);
            else if (e.key === 'Escape') onClose();
          }}
          placeholder="x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
          className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none placeholder-[var(--faint)] focus:border-[var(--gold2)]"
        />
        <p className="mt-1.5 font-mono text-[10px] text-[var(--faint)]">
          Enter = inline · Shift+Enter = bloco centrado
        </p>

        {/* Preview rendered by DocumentPreview — we show raw LaTeX here for simplicity */}
        {input && (
          <div className="mt-2 rounded border border-[var(--border)] bg-[var(--border)]/20 px-3 py-2 font-mono text-[12px] text-[var(--muted)]">
            {input}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => submit(false)}
            className="flex-1 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] py-2 font-mono text-[11px] font-semibold text-black transition hover:brightness-110"
          >
            Inline $…$
          </button>
          <button
            type="button"
            onClick={() => submit(true)}
            className="flex-1 rounded border border-[var(--border)] py-2 font-mono text-[11px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
          >
            Bloco $$…$$
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

export function EditorToolbar({
  editor,
  isMobile = false,
  collabActive = false,
  collabPeers = 0,
  onToggleCollab,
}: Props) {
  const [showMath, setShowMath] = useState(false);
  const [activeTab, setActiveTab] = useState<'inicio' | 'inserir' | 'layout' | 'revisao'>('inicio');

  const insertMath = useCallback(
    (latex: string, block: boolean) => {
      if (!editor) return;
      const markup = block ? `\n\n$$${latex}$$\n\n` : `$${latex}$`;
      editor.chain().focus().insertContent(markup).run();
      setShowMath(false);
    },
    [editor],
  );

  if (!editor) return null;

  // Compact mode for mobile — hide some buttons
  const showFull = !isMobile;

  const iconSz = 'h-3.5 w-3.5';

  const applyStylePreset = (preset: 'normal' | 'h1' | 'h2' | 'quote' | 'code') => {
    const chain = editor.chain().focus();
    if (preset === 'normal') chain.clearNodes().unsetAllMarks().run();
    if (preset === 'h1') chain.toggleHeading({ level: 1 }).run();
    if (preset === 'h2') chain.toggleHeading({ level: 2 }).run();
    if (preset === 'quote') chain.toggleBlockquote().run();
    if (preset === 'code') chain.toggleCodeBlock().run();
  };

  return (
    <>
      {showMath && (
        <MathDialog onInsert={insertMath} onClose={() => setShowMath(false)} />
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--parchment)]">
        <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-2 py-1">
          {[
            { key: 'inicio', label: 'Início' },
            { key: 'inserir', label: 'Inserir' },
            { key: 'layout', label: 'Layout' },
            { key: 'revisao', label: 'Revisão' },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition ${
                activeTab === tab.key
                  ? 'bg-[var(--gold)]/20 text-[var(--gold2)]'
                  : 'text-[var(--faint)] hover:text-[var(--muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1">
          {activeTab === 'inserir' && (
            <>
              <ToolBtn
                icon={<Pi className={iconSz} />}
                label="Equação LaTeX"
                onClick={() => setShowMath(true)}
              />
              <ToolBtn
                icon={<Minus className={iconSz} />}
                label="Linha separadora"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              />
            </>
          )}

          {activeTab === 'layout' && (
            <div className="flex items-center gap-2 px-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
                Página A4 · Margens ABNT
              </span>
            </div>
          )}

          {activeTab === 'revisao' && (
            <div className="flex items-center gap-2 px-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
                Revisão em andamento
              </span>
            </div>
          )}

          {activeTab === 'inicio' && (
            <>
              {/* History */}
              <ToolBtn
                icon={<Undo2 className={iconSz} />}
                label="Desfazer (Ctrl+Z)"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
              />
              <ToolBtn
                icon={<Redo2 className={iconSz} />}
                label="Refazer (Ctrl+Y)"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
              />

              <Sep />

              {/* Headings */}
              <ToolBtn
                icon={<Heading1 className={iconSz} />}
                label="Título 1"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                active={editor.isActive('heading', { level: 1 })}
              />
              <ToolBtn
                icon={<Heading2 className={iconSz} />}
                label="Título 2"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor.isActive('heading', { level: 2 })}
              />
              <ToolBtn
                icon={<Heading3 className={iconSz} />}
                label="Título 3"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                active={editor.isActive('heading', { level: 3 })}
              />

              <Sep />

              {/* Inline formatting */}
              <ToolBtn
                icon={<Bold className={iconSz} />}
                label="Negrito (Ctrl+B)"
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive('bold')}
              />
              <ToolBtn
                icon={<Italic className={iconSz} />}
                label="Itálico (Ctrl+I)"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive('italic')}
              />
              {showFull && (
                <ToolBtn
                  icon={<Strikethrough className={iconSz} />}
                  label="Tachado"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  active={editor.isActive('strike')}
                />
              )}
              <ToolBtn
                icon={<Code className={iconSz} />}
                label="Código inline"
                onClick={() => editor.chain().focus().toggleCode().run()}
                active={editor.isActive('code')}
              />

              <Sep />

              {/* Lists & blocks */}
              <ToolBtn
                icon={<List className={iconSz} />}
                label="Lista de marcadores"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive('bulletList')}
              />
              <ToolBtn
                icon={<ListOrdered className={iconSz} />}
                label="Lista numerada"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                active={editor.isActive('orderedList')}
              />
              {showFull && (
                <>
                  <ToolBtn
                    icon={<Quote className={iconSz} />}
                    label="Citação"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    active={editor.isActive('blockquote')}
                  />
                  <ToolBtn
                    icon={<Code2 className={iconSz} />}
                    label="Bloco de código"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    active={editor.isActive('codeBlock')}
                  />
                </>
              )}

              <Sep />

              {[
                { key: 'normal', label: 'Normal', active: !editor.isActive('heading') && !editor.isActive('blockquote') && !editor.isActive('codeBlock') },
                { key: 'h1', label: 'Título 1', active: editor.isActive('heading', { level: 1 }) },
                { key: 'h2', label: 'Título 2', active: editor.isActive('heading', { level: 2 }) },
                { key: 'quote', label: 'Citação', active: editor.isActive('blockquote') },
              ].map(style => (
                <button
                  key={style.key}
                  type="button"
                  onClick={() => applyStylePreset(style.key as Parameters<typeof applyStylePreset>[0])}
                  className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition ${
                    style.active
                      ? 'border-[var(--gold2)]/60 bg-[var(--gold)]/15 text-[var(--gold2)]'
                      : 'border-[var(--border)] text-[var(--faint)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </>
          )}

          {/* Collaboration — pushed to the right on desktop */}
          {onToggleCollab && (
            <>
              <div className="flex-1" />
              <button
                type="button"
                title={collabActive ? `Colaboração activa · ${collabPeers} editor(es)` : 'Colaboração em tempo real'}
                onClick={onToggleCollab}
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition ${
                  collabActive
                    ? 'border-[var(--teal)]/40 bg-[var(--teal)]/10 text-[var(--teal)]'
                    : 'border-[var(--border)] text-[var(--faint)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
                }`}
              >
                <Users className="h-3 w-3" />
                {collabActive ? (
                  <span>{collabPeers} online</span>
                ) : (
                  <span>Colaborar</span>
                )}
                {collabActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)] shadow-[0_0_4px_var(--teal)]" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
