'use client';

import { useCallback, useState } from 'react';
import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEditorActions, useEditorMeta, usePanelActions, useSidePanel } from '@/hooks/useEditorStore';
import { useThemeMode } from '@/hooks/useThemeMode';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { TccPanel } from '@/components/TccPanel';
import { WorkPanel } from '@/components/WorkPanel';
import ChatPanel from '@/components/ChatPanel';
import { EditorHeader } from '@/components/EditorHeader';
import { EditorFileToolbar } from '@/components/EditorFileToolbar';
import { EditorStatusBar } from '@/components/EditorStatusBar';
import { DocumentPreview } from '@/components/DocumentPreview';
import { cn } from '@/lib/utils';

export default function Home() {
  const { markdown, previewMarkdown, setMarkdown, filename, includeCover, setFilename, loading, exportDocx, importTextFile, clearDefaultMarkdown, setFilenameFromTopic } = useDocumentEditor();
  const sidePanel = useSidePanel();
  const { togglePanel, closePanel } = usePanelActions();
  const { canRedo, canUndo } = useEditorMeta();
  const { redo, undo } = useEditorActions();
  const isMobile = useIsMobile();
  const [showEditor, setShowEditor] = useState(false);
  const { themeMode, toggleThemeMode } = useThemeMode();

  const themeVars =
    themeMode === 'dark'
      ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
      : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  const handleInsert = useCallback(
    (text: string) => {
      setMarkdown((prev) => (prev ? `${prev}\n\n${text}` : text));
    },
    [setMarkdown],
  );

  const handleTogglePanel = useCallback(
    (panel: Parameters<typeof togglePanel>[0]) => {
      clearDefaultMarkdown();
      togglePanel(panel);
    },
    [clearDefaultMarkdown, togglePanel],
  );

  return (
    <main
      className={`${themeVars} flex h-dvh min-h-screen flex-col overflow-hidden bg-[var(--parchment)] text-[var(--ink)]`}
    >
      <EditorHeader
        sidePanel={sidePanel}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onTogglePanel={handleTogglePanel}
        themeMode={themeMode}
        onToggleTheme={toggleThemeMode}
      />

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {!isMobile && (
          <aside className="flex w-11 flex-shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--parchment)] py-[18px]">
            <div className="h-10 w-0.5 rounded bg-[linear-gradient(to_bottom,transparent,var(--gold),transparent)]" />
          </aside>
        )}

        {sidePanel === 'chat' ? (
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--parchment)]">
            <ChatPanel />
          </section>
        ) : (
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--parchment)]">
            {/* Barra de contexto do editor */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--faint)]">
                Editor principal
              </span>
              <button
                type="button"
                onClick={() => setShowEditor((current) => !current)}
                className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
                title="Modo avançado"
              >
                {showEditor ? 'Ocultar edição' : 'Modo avançado'}
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
              <EditorFileToolbar filename={filename} onFilenameChange={setFilename} onImportFile={importTextFile} />
              <div className={cn('grid min-h-0 flex-1 gap-3', showEditor && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
                {showEditor && <MarkdownEditor value={markdown} onChange={setMarkdown} isMobile={isMobile} />}
                {/*
                  originalMarkdown = markdown antes de formalizePreviewHeadings
                  → preserva os níveis reais dos headings para o TOC ({toc})
                */}
                <DocumentPreview
                  markdown={previewMarkdown}
                  originalMarkdown={markdown}
                  isMobile={isMobile}
                />
              </div>
            </div>
          </section>
        )}

        {sidePanel !== 'none' && sidePanel !== 'chat' && (
          <aside
            className={cn(
              'z-20 flex min-w-0 flex-shrink-0 flex-col border-l border-[var(--border)] bg-[var(--parchment)]',
              isMobile
                ? 'absolute inset-0 animate-[slideUp_0.25s_ease] shadow-[0_-16px_40px_rgba(0,0,0,0.45)]'
                : 'relative w-[300px] animate-[slideIn_0.25s_ease]',
            )}
          >
            {sidePanel === 'tcc' && (
              <TccPanel
                onInsert={handleInsert}
                onTopicChange={setFilenameFromTopic}
                onClose={closePanel}
                isMobile={isMobile}
                editorMarkdown={markdown}
              />
            )}
            {sidePanel === 'work' && (
              <WorkPanel
                onInsert={handleInsert}
                onTopicChange={setFilenameFromTopic}
                onClose={closePanel}
                isMobile={isMobile}
                editorMarkdown={markdown}
              />
            )}
          </aside>
        )}
      </div>

      <EditorStatusBar
        markdown={markdown}
        loading={loading}
        filename={filename}
        includeCover={includeCover}
        isMobile={isMobile}
        onExport={exportDocx}
      />

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
