'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Markdown } from 'tiptap-markdown';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { EditorToolbar } from '@/components/EditorToolbar';
import { AiBubbleMenu } from '@/components/AiBubbleMenu';
import { CollaborationPanel } from '@/components/CollaborationPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  isMobile?: boolean;
}

interface CollabState {
  active: boolean;
  ydoc: Y.Doc | null;
  provider: WebrtcProvider | null;
  roomId: string | null;
  peers: number;
  connected: boolean;
}

// ── Random colour for cursor awareness ────────────────────────────────────────

const CURSOR_COLORS = [
  '#f59e0b', '#00d6a0', '#7dd3fc', '#f97316',
  '#a78bfa', '#fb7185', '#34d399', '#fbbf24',
];

function randomColor() {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RichEditor({ value, onChange, isMobile = false }: Props) {
  const lastExternalValue = useRef<string>(value);
  const suppressNextUpdate = useRef(false);
  const [ready, setReady] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [zoom, setZoom] = useState(100);

  const [collab, setCollab] = useState<CollabState>({
    active: false,
    ydoc: null,
    provider: null,
    roomId: null,
    peers: 0,
    connected: false,
  });

  // ── Yjs collaboration lifecycle ─────────────────────────────────────────────

  const startCollab = useCallback((roomId: string) => {
    // Tear down previous
    collab.provider?.destroy();
    collab.ydoc?.destroy();

    const ydoc = new Y.Doc();
    const provider = new WebrtcProvider(roomId, ydoc, {
      signaling: ['wss://signaling.yjs.dev'],
    });

    provider.on('status', ({ connected }: { connected: boolean }) => {
      setCollab(prev => ({ ...prev, connected }));
    });

    provider.awareness.setLocalState({
      name: 'Eu',
      color: randomColor(),
    });

    provider.awareness.on('change', () => {
      setCollab(prev => ({
        ...prev,
        peers: provider.awareness.getStates().size,
      }));
    });

    setCollab({ active: true, ydoc, provider, roomId, peers: 1, connected: false });
  }, [collab]);

  const stopCollab = useCallback(() => {
    collab.provider?.destroy();
    collab.ydoc?.destroy();
    setCollab({ active: false, ydoc: null, provider: null, roomId: null, peers: 0, connected: false });
  }, [collab]);

  const createRoom = useCallback(() => {
    const id = `muneri-${Math.random().toString(36).slice(2, 10)}`;
    startCollab(id);
    return id;
  }, [startCollab]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      collab.provider?.destroy();
      collab.ydoc?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Extensions ───────────────────────────────────────────────────────────────

  const extensions = [
    StarterKit.configure({
      // When Yjs is active, Yjs handles history (undo/redo).
      undoRedo: collab.active ? false : {},
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return 'Título…';
        return 'Escreve aqui, ou usa o painel lateral para gerar conteúdo com IA…';
      },
      emptyEditorClass: 'rich-is-empty',
    }),
    CharacterCount,
    Markdown.configure({
      html: false,
      tightLists: true,
      transformPastedText: true,
      transformCopiedText: false,
    }),
    ...(collab.active && collab.ydoc
      ? [
          Collaboration.configure({ document: collab.ydoc }),
          CollaborationCursor.configure({
            provider: collab.provider!,
            user: {
              name: 'Eu',
              color: randomColor(),
            },
          }),
        ]
      : []),
  ];

  // ── Editor instance ──────────────────────────────────────────────────────────

  const editor = useEditor({
    extensions,
    content: value,
    autofocus: false,
    editorProps: {
      attributes: {
        class: 'rich-prose',
        spellcheck: 'true',
        lang: 'pt',
      },
      handleDOMEvents: {
        contextmenu: (_view, event) => {
          event.preventDefault();
          return true;
        },
      },
    },
    onUpdate: ({ editor }) => {
      if (suppressNextUpdate.current) return;
      const markdownStorage = (editor.storage as { markdown?: { getMarkdown?: () => string } }).markdown;
      const md = markdownStorage?.getMarkdown?.() ?? '';
      lastExternalValue.current = md;
      onChange(md);
    },
    onCreate: () => setReady(true),
  });

  // ── Sync external markdown changes (from TCC/Work panels) ────────────────────

  useEffect(() => {
    if (!editor || !ready) return;
    if (value === lastExternalValue.current) return;

    suppressNextUpdate.current = true;
    lastExternalValue.current = value;
    editor.commands.setContent(value, { emitUpdate: false });

    requestAnimationFrame(() => {
      suppressNextUpdate.current = false;
    });
  }, [value, editor, ready]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const chars = editor?.storage.characterCount?.characters() ?? 0;
  const words = editor?.storage.characterCount?.words() ?? 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">

      {/* Toolbar */}
      <EditorToolbar
        editor={editor}
        isMobile={isMobile}
        collabActive={collab.active}
        collabPeers={collab.peers}
        onToggleCollab={() => setShowCollab(v => !v)}
      />

      {/* Collaboration panel */}
      {showCollab && (
        <CollaborationPanel
          collab={collab}
          onCreateRoom={createRoom}
          onJoinRoom={startCollab}
          onStop={stopCollab}
          onClose={() => setShowCollab(false)}
        />
      )}

      {/* AI bubble menu (shows when text is selected) */}
      {editor && <AiBubbleMenu editor={editor} />}

      {/* Editor surface */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex h-full min-h-0">
          <div className="word-left-ruler">
            {Array.from({ length: 22 }, (_, i) => (
              <span key={`v-${i}`} className="word-left-ruler-mark">{i}</span>
            ))}
          </div>
          <div className="word-workspace">
            <div className="word-ruler">
              {Array.from({ length: 17 }, (_, i) => (
                <div key={`tick-${i}`} className="word-ruler-tick" style={{ left: `${(i / 16) * 100}%` }}>
                  <span className="word-ruler-label">{i}</span>
                </div>
              ))}
            </div>
            <div className="word-page-wrap" onClick={() => editor?.commands.focus()}>
              <div className="word-page" style={{ transform: `scale(${zoom / 100})` }}>
                <EditorContent editor={editor} className="rich-root" />
                <span className="word-page-number">1</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 px-0.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--muted)]">
          {words.toLocaleString('pt-BR')} palavras
        </span>
        <span className="h-3 w-px bg-[var(--border)]" />
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--muted)]">
          {chars.toLocaleString('pt-BR')} caracteres
        </span>
        {collab.active && (
          <>
            <span className="h-3 w-px bg-[var(--border)]" />
            <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--teal)]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${collab.connected ? 'bg-[var(--teal)] shadow-[0_0_4px_var(--teal)]' : 'bg-[var(--faint)]'}`}
              />
              {collab.peers} {collab.peers === 1 ? 'editor' : 'editores'}
            </span>
          </>
        )}
        <span className="h-3 w-px bg-[var(--border)]" />
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--faint)]">
          Layout Word-like
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom(v => Math.max(70, v - 10))}
            className="h-5 w-5 rounded border border-[var(--border)] text-[var(--faint)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
          >
            -
          </button>
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--muted)]">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(v => Math.min(130, v + 10))}
            className="h-5 w-5 rounded border border-[var(--border)] text-[var(--faint)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
          >
            +
          </button>
        </div>
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        /* Root container */
        .rich-root { display: flex; flex-direction: column; min-height: 1040px; }

        .word-workspace {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          background: linear-gradient(180deg, color-mix(in oklab, var(--surface), #000 18%), var(--surface));
        }
        .word-left-ruler {
          width: 32px;
          border-right: 1px solid var(--border);
          background: color-mix(in oklab, var(--surface), #000 14%);
          color: var(--faint);
          font-family: 'JetBrains Mono', monospace;
          font-size: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding-top: 34px;
          overflow: hidden;
          opacity: 0.7;
        }
        .word-left-ruler-mark {
          position: relative;
        }
        .word-left-ruler-mark::before {
          content: '';
          position: absolute;
          left: -8px;
          top: 50%;
          width: 5px;
          height: 1px;
          background: var(--faint);
        }
        .word-ruler {
          position: relative;
          margin: 10px auto 0;
          width: min(860px, calc(100% - 20px));
          height: 24px;
          border: 1px solid var(--border);
          border-bottom: none;
          background: color-mix(in oklab, var(--surface), #000 8%);
          border-radius: 6px 6px 0 0;
        }
        .word-ruler-tick {
          position: absolute;
          top: 8px;
          bottom: 4px;
          width: 1px;
          background: var(--faint);
          opacity: 0.45;
        }
        .word-ruler-label {
          position: absolute;
          top: -7px;
          left: -5px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 8px;
          color: var(--faint);
        }
        .word-page-wrap {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 0 12px 22px;
        }
        .word-page-wrap::-webkit-scrollbar { width: 8px; height: 8px; }
        .word-page-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; }
        .word-page {
          width: 820px;
          margin: 0 auto;
          transform-origin: top center;
          transition: transform 150ms ease;
          position: relative;
        }
        .word-page-number {
          position: absolute;
          left: 50%;
          bottom: 32px;
          transform: translateX(-50%);
          color: #787878;
          font-family: 'Times New Roman', Times, serif;
          font-size: 30px;
          opacity: 0.55;
          pointer-events: none;
        }

        /* The ProseMirror editable area */
        .rich-prose {
          flex: 1;
          min-height: 480px;
          margin: 0 auto;
          max-width: 100%;
          background: #fff;
          color: #111;
          border: 1px solid #d9d9d9;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
          border-radius: 0 0 4px 4px;
          padding: ${isMobile ? '56px 54px' : '66px 78px'};
          font-family: 'Times New Roman', Times, serif;
          font-size: ${isMobile ? '14px' : '15px'};
          line-height: 1.8;
          outline: none;
          caret-color: var(--gold2, #8b6914);
          word-break: break-word;
          overflow-wrap: break-word;
          -webkit-touch-callout: none;
        }

        /* Placeholder */
        .rich-is-empty::before {
          content: attr(data-placeholder);
          position: absolute;
          margin-top: 2px;
          pointer-events: none;
          color: #a8a8a8;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }

        /* Paragraphs */
        .rich-prose p {
          margin: 0 0 0.8em;
          text-align: justify;
        }
        .rich-prose p:last-child { margin-bottom: 0; }

        /* Headings — ABNT style */
        .rich-prose h1 {
          font-size: 1.45em;
          font-weight: 700;
          text-align: center;
          text-transform: uppercase;
          margin: 1.6em 0 0.5em;
          line-height: 1.3;
        }
        .rich-prose h2 {
          font-size: 1.2em;
          font-weight: 700;
          text-align: left;
          margin: 1.3em 0 0.45em;
          line-height: 1.35;
        }
        .rich-prose h3 {
          font-size: 1.05em;
          font-weight: 700;
          font-style: italic;
          margin: 1.1em 0 0.4em;
        }
        .rich-prose h4, .rich-prose h5, .rich-prose h6 {
          font-size: 1em;
          font-weight: 700;
          margin: 0.9em 0 0.35em;
        }

        /* Inline formatting */
        .rich-prose strong { font-weight: 700; }
        .rich-prose em     { font-style: italic; }
        .rich-prose s      { text-decoration: line-through; opacity: 0.65; }
        .rich-prose code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.87em;
          background: var(--border);
          border-radius: 3px;
          padding: 1px 5px;
          color: var(--gold2, #8b6914);
        }

        /* Lists */
        .rich-prose ul, .rich-prose ol {
          margin: 0.4em 0 0.8em;
          padding-left: 1.6em;
        }
        .rich-prose ul { list-style: disc; }
        .rich-prose ol { list-style: decimal; }
        .rich-prose li {
          margin: 0.2em 0;
          line-height: 1.7;
        }

        /* Blockquote */
        .rich-prose blockquote {
          border-left: 3px solid var(--gold, #c9a96e);
          margin: 0.8em 0;
          padding: 0.3em 0 0.3em 1.1em;
          color: var(--muted);
          font-style: italic;
        }

        /* Horizontal rule */
        .rich-prose hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 1.6em 0;
        }

        /* Code block */
        .rich-prose pre {
          background: var(--heroRight, #090908);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 12px 16px;
          overflow-x: auto;
          margin: 0.8em 0;
        }
        .rich-prose pre code {
          background: none;
          padding: 0;
          font-size: 12px;
          color: #c8bfb4;
          line-height: 1.65;
        }

        /* Selection */
        .rich-prose ::selection {
          background: rgba(201, 169, 110, 0.22);
        }

        /* Collaboration cursors */
        .collaboration-cursor__caret {
          border-left: 2px solid;
          border-right: 2px solid;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          word-break: normal;
        }
        .collaboration-cursor__label {
          border-radius: 3px 3px 3px 0;
          color: #0d0d0d;
          font-size: 10px;
          font-style: normal;
          font-weight: 600;
          left: -1px;
          line-height: normal;
          padding: 1px 4px;
          position: absolute;
          top: -1.4em;
          user-select: none;
          white-space: nowrap;
          font-family: 'JetBrains Mono', monospace;
        }

        /* Tiptap heading placeholder */
        .rich-prose .is-empty::before {
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          color: var(--faint);
          font-style: italic;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
