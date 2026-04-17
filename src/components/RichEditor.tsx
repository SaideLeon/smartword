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
      history: !collab.active,
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
    },
    onUpdate: ({ editor }) => {
      if (suppressNextUpdate.current) return;
      const md = editor.storage.markdown.getMarkdown();
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
    editor.commands.setContent(value, false);

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
      <div
        className="relative min-h-0 flex-1 cursor-text overflow-hidden rounded-md border border-[var(--border)] bg-[var(--parchment)]"
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} className="rich-root" />
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-0.5">
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
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        /* Root container */
        .rich-root { display: flex; flex-direction: column; min-height: 480px; }

        /* The ProseMirror editable area */
        .rich-prose {
          flex: 1;
          min-height: 480px;
          padding: ${isMobile ? '18px 20px' : '28px 36px'};
          font-family: 'Times New Roman', Times, serif;
          font-size: ${isMobile ? '14px' : '15px'};
          line-height: 1.8;
          color: var(--ink);
          outline: none;
          caret-color: var(--gold2, #8b6914);
          word-break: break-word;
          overflow-wrap: break-word;
        }

        /* Placeholder */
        .rich-is-empty .rich-prose::before {
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          color: var(--faint);
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
