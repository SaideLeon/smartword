'use client';

import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor | null;
}

const STYLES = [
  {
    id: 'h1',
    name: 'Título 1',
    apply: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e: Editor) => e.isActive('heading', { level: 1 }),
    style: { fontWeight: 700, fontSize: '13px' } as React.CSSProperties,
  },
  {
    id: 'blockquote',
    name: 'Citação',
    apply: (e: Editor) => e.chain().focus().toggleBlockquote().run(),
    isActive: (e: Editor) => e.isActive('blockquote'),
    style: { fontStyle: 'italic' } as React.CSSProperties,
  },
  {
    id: 'h2',
    name: 'Subtítulo',
    apply: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e: Editor) => e.isActive('heading', { level: 2 }),
    style: { fontSize: '12px', color: '#a09585' } as React.CSSProperties,
  },
  {
    id: 'h3',
    name: 'Sent. Subtítulo',
    apply: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e: Editor) => e.isActive('heading', { level: 3 }),
    style: { fontSize: '11px', color: '#8a7d6e' } as React.CSSProperties,
  },
  {
    id: 'normal',
    name: 'Normal',
    apply: (e: Editor) => e.chain().focus().setParagraph().run(),
    isActive: (e: Editor) => e.isActive('paragraph') && !e.isActive('heading'),
    style: {} as React.CSSProperties,
  },
];

export function StylesPanel({ editor }: Props) {
  return (
    <div className="shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-mono text-[11px] font-semibold tracking-[.04em] text-[var(--gold2)]">Estilos</span>
      </div>

      {/* Style items */}
      <div className="px-2 py-2 space-y-px">
        {STYLES.map(s => {
          const active = editor ? s.isActive(editor) : false;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => editor && s.apply(editor)}
              className={`flex w-full cursor-pointer items-center justify-between rounded px-2 py-1.5 transition ${
                active
                  ? 'bg-[var(--gold2)] text-black'
                  : 'text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--ink)]'
              }`}
            >
              <span style={active ? undefined : s.style} className="text-[12px]">{s.name}</span>
              <span className={`font-mono text-[9px] ${active ? 'text-black/60' : 'text-[var(--dim)]'}`}>
                {active ? '✓' : 'Ta'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Divider + utility buttons */}
      <div className="mx-2 border-t border-[var(--border)] pt-2 pb-2 space-y-1">
        <button type="button" className="w-full cursor-pointer rounded border border-[var(--border2)] py-1 font-mono text-[10px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
          IMPORTAR
        </button>
        <button type="button" className="w-full cursor-pointer rounded border border-[var(--border2)] py-1 font-mono text-[10px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
          AVANÇADO
        </button>
      </div>
    </div>
  );
}
