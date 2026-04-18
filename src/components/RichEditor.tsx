'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Markdown } from 'tiptap-markdown';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { AiBubbleMenu } from '@/components/AiBubbleMenu';

// ── Marker Decoration Extension ───────────────────────────────────────────────
// Decora parágrafos que contêm marcadores especiais ({pagebreak}, {toc},
// {section}) com classes CSS para renderização visual, mantendo o texto
// original no documento (necessário para exportação DOCX).

const MARKER_PLUGIN_KEY = new PluginKey<DecorationSet>('markerDecoration');

const MarkerDecorationExtension = Extension.create({
  name: 'markerDecoration',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: MARKER_PLUGIN_KEY,
        state: {
          init(_, state) {
            return buildDecorations(state.doc);
          },
          apply(tr, old) {
            return tr.docChanged ? buildDecorations(tr.doc) : old;
          },
        },
        props: {
          decorations(state) {
            return MARKER_PLUGIN_KEY.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

function buildDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  doc.forEach((node: any, pos: number) => {
    if (node.type.name !== 'paragraph') return;
    const text = node.textContent.trim();

    if (text === '{pagebreak}') {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'rich-marker rich-marker-pagebreak',
        }),
      );
    } else if (text === '{toc}') {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'rich-marker rich-marker-toc',
        }),
      );
    } else if (text === '{section}') {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'rich-marker rich-marker-section',
        }),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

// ── Types & helpers ───────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  isMobile?: boolean;
  onEditorReady?: (editor: Editor) => void;
}

interface CollabState {
  active: boolean;
  ydoc: Y.Doc | null;
  provider: WebrtcProvider | null;
  roomId: string | null;
  peers: number;
  connected: boolean;
}

const CURSOR_COLORS = ['#f59e0b', '#00d6a0', '#7dd3fc', '#f97316', '#a78bfa', '#fb7185'];
function randomColor() { return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]; }

// ── Component ─────────────────────────────────────────────────────────────────

export function RichEditor({ value, onChange, isMobile = false, onEditorReady }: Props) {
  const lastExternalValue = useRef<string>(value);
  const suppressNextUpdate = useRef(false);
  const [ready, setReady] = useState(false);
  const onEditorReadyRef = useRef(onEditorReady);
  useEffect(() => { onEditorReadyRef.current = onEditorReady; });

  const [collab, setCollab] = useState<CollabState>({
    active: false, ydoc: null, provider: null, roomId: null, peers: 0, connected: false,
  });

  useEffect(() => () => {
    collab.provider?.destroy();
    collab.ydoc?.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extensions = [
    StarterKit.configure({ undoRedo: collab.active ? false : {} }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return 'Título…';
        return 'Página em branco — escreve aqui ou usa o painel lateral para gerar conteúdo com IA…';
      },
      emptyEditorClass: 'rich-is-empty',
    }),
    CharacterCount,
    Markdown.configure({ html: false, tightLists: true, transformPastedText: true, transformCopiedText: false }),
    MarkerDecorationExtension,
    ...(collab.active && collab.ydoc
      ? [
          Collaboration.configure({ document: collab.ydoc }),
          CollaborationCursor.configure({
            provider: collab.provider!,
            user: { name: 'Eu', color: randomColor() },
          }),
        ]
      : []),
  ];

  const editor = useEditor({
    extensions,
    content: value,
    autofocus: false,
    editorProps: {
      attributes: { class: 'rich-prose', spellcheck: 'true', lang: 'pt' },
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

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReadyRef.current) {
      onEditorReadyRef.current(editor);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Sync external markdown changes
  useEffect(() => {
    if (!editor || !ready) return;
    if (value === lastExternalValue.current) return;
    suppressNextUpdate.current = true;
    lastExternalValue.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
    requestAnimationFrame(() => { suppressNextUpdate.current = false; });
  }, [value, editor, ready]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {editor && <AiBubbleMenu editor={editor} />}
      <EditorContent editor={editor} className="rich-root" />

      <style>{`
        /* ── Root ───────────────────────────────────────────────────────── */
        .rich-root { display: flex; flex-direction: column; flex: 1; }
        .rich-root, .rich-root * { -webkit-touch-callout: none !important; }

        /* ── White A4 editing surface ───────────────────────────────────── */
        .rich-prose {
          flex: 1;
          min-height: 749px;
          padding: ${isMobile ? '40px 32px' : '64px 72px'};
          font-family: 'Times New Roman', Times, serif;
          font-size: ${isMobile ? '13px' : '15px'};
          line-height: 1.8;
          color: #111;
          outline: none;
          caret-color: #555;
          word-break: break-word;
          overflow-wrap: break-word;
          -webkit-touch-callout: none !important;
          -webkit-user-select: text;
          user-select: text;
        }

        /* ── Placeholder ────────────────────────────────────────────────── */
        .rich-is-empty .rich-prose::before {
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          color: #bbb;
          font-style: italic;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }

        /* ── Paragraphs ─────────────────────────────────────────────────── */
        .rich-prose p { margin: 0 0 0.8em; text-align: justify; }
        .rich-prose p:last-child { margin-bottom: 0; }

        /* ── Headings — ABNT ────────────────────────────────────────────── */
        .rich-prose h1 { font-size: 1.4em; font-weight: 700; text-align: center; text-transform: uppercase; margin: 1.6em 0 0.5em; line-height: 1.3; }
        .rich-prose h2 { font-size: 1.15em; font-weight: 700; text-align: left; margin: 1.3em 0 0.45em; line-height: 1.35; }
        .rich-prose h3 { font-size: 1em; font-weight: 700; font-style: italic; margin: 1.1em 0 0.4em; }
        .rich-prose h4, .rich-prose h5, .rich-prose h6 { font-size: 1em; font-weight: 700; margin: 0.9em 0 0.35em; }

        /* ── Inline ─────────────────────────────────────────────────────── */
        .rich-prose strong { font-weight: 700; }
        .rich-prose em { font-style: italic; }
        .rich-prose s { text-decoration: line-through; opacity: 0.6; }
        .rich-prose code { font-family: 'Courier New', monospace; font-size: 0.87em; background: #f0f0f0; border-radius: 3px; padding: 1px 4px; color: #a0522d; }

        /* ── Lists ──────────────────────────────────────────────────────── */
        .rich-prose ul, .rich-prose ol { margin: 0.4em 0 0.8em; padding-left: 1.6em; }
        .rich-prose ul { list-style: disc; }
        .rich-prose ol { list-style: decimal; }
        .rich-prose li { margin: 0.2em 0; line-height: 1.7; }

        /* ── Blockquote ─────────────────────────────────────────────────── */
        .rich-prose blockquote { border-left: 3px solid #c9a96e; margin: 0.8em 0; padding: 0.3em 0 0.3em 1em; color: #555; font-style: italic; }

        /* ── HR ─────────────────────────────────────────────────────────── */
        .rich-prose hr { border: none; border-top: 1px solid #ccc; margin: 1.6em 0; }

        /* ── Code block ─────────────────────────────────────────────────── */
        .rich-prose pre { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px 14px; overflow-x: auto; margin: 0.8em 0; }
        .rich-prose pre code { background: none; padding: 0; font-size: 12px; color: #333; line-height: 1.6; }

        /* ── Selection ──────────────────────────────────────────────────── */
        .rich-prose ::selection { background: rgba(201,169,110,0.22); }

        /* ── Collaboration cursors ───────────────────────────────────────── */
        .collaboration-cursor__caret { border-left: 2px solid; border-right: 2px solid; margin-left: -1px; margin-right: -1px; pointer-events: none; }
        .collaboration-cursor__label { border-radius: 3px 3px 3px 0; color: #fff; font-size: 10px; font-weight: 600; left: -1px; line-height: normal; padding: 1px 4px; position: absolute; top: -1.4em; user-select: none; white-space: nowrap; font-family: monospace; }

        /* ── Heading placeholder ─────────────────────────────────────────── */
        .rich-prose .is-empty::before { content: attr(data-placeholder); float: left; height: 0; pointer-events: none; color: #aaa; font-style: italic; font-family: 'JetBrains Mono', monospace; font-size: 12px; }


        /* ═══════════════════════════════════════════════════════════════════
           SPECIAL MARKER NODES
           Paragraphs containing {pagebreak}, {toc}, or {section} are
           decorated with a CSS class and rendered visually.
           The original text is hidden via font-size:0 / color:transparent;
           the ::before pseudo-element shows the visual indicator.
           The caret still works normally inside the paragraph.
        ════════════════════════════════════════════════════════════════════ */

        /* ── Base marker styles ─────────────────────────────────────────── */
        .rich-prose p.rich-marker {
          position: relative !important;
          margin: 10px 0 !important;
          padding: 0 !important;
          text-indent: 0 !important;
          text-align: center !important;

          /* Hide the raw text ({pagebreak} etc.) visually */
          font-size: 0 !important;
          color: transparent !important;
          caret-color: #bbb;
          user-select: none;
          cursor: default;
        }

        /* ── {pagebreak} ────────────────────────────────────────────────── */
        .rich-prose p.rich-marker-pagebreak {
          height: 30px !important;
          min-height: 30px !important;
        }
        .rich-prose p.rich-marker-pagebreak::before {
          content: '↕  QUEBRA DE PÁGINA';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: #b0a898;
          pointer-events: none;
        }
        .rich-prose p.rich-marker-pagebreak::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 0;
          border-top: 2px dashed #d8d0c6;
          pointer-events: none;
        }

        /* ── {section} ──────────────────────────────────────────────────── */
        .rich-prose p.rich-marker-section {
          height: 30px !important;
          min-height: 30px !important;
        }
        .rich-prose p.rich-marker-section::before {
          content: '≡  NOVA SECÇÃO  (numeração reinicia)';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: #6a9e5f;
          pointer-events: none;
        }
        .rich-prose p.rich-marker-section::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 0;
          border-top: 2px solid #c8e6c2;
          pointer-events: none;
        }

        /* ── {toc} ──────────────────────────────────────────────────────── */
        .rich-prose p.rich-marker-toc {
          height: 72px !important;
          min-height: 72px !important;
          border: 2px dashed #d8d0c6 !important;
          border-radius: 6px !important;
          background: #faf8f5 !important;
          margin: 16px 0 !important;
        }
        .rich-prose p.rich-marker-toc::before {
          content: '☰  ÍNDICE AUTOMÁTICO';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: #b0a898;
          pointer-events: none;
        }
        .rich-prose p.rich-marker-toc::after {
          content: 'gerado automaticamente ao exportar para Word';
          position: absolute;
          bottom: 10px;
          left: 0;
          right: 0;
          text-align: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 8px;
          letter-spacing: 0.08em;
          color: #c8c0b8;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
