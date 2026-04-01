'use client';

import { useCallback, useState } from 'react';
import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEditorActions, useEditorMeta, usePanelActions, useSidePanel } from '@/hooks/useEditorStore';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { TccPanel } from '@/components/TccPanel';
import { WorkPanel } from '@/components/WorkPanel';
import { AiChatDrawer } from '@/components/AiChatDrawer';
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

  const handleInsert = useCallback(
    (text: string) => {
      setMarkdown((prev) => (prev ? `${prev}\n\n${text}` : text));
    },
    [setMarkdown],
  );

  const handleReplace = useCallback(
    (text: string) => {
      setMarkdown(text);
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
    <main className="flex h-dvh min-h-screen flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]" data-theme="dark">
      <EditorHeader
        sidePanel={sidePanel}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onTogglePanel={handleTogglePanel}
      />

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {!isMobile && (
          <aside className="flex w-11 flex-shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--bg-surface)] py-[18px]">
            <div className="h-10 w-0.5 rounded bg-[linear-gradient(to_bottom,transparent,var(--accent-amber),transparent)]" />
          </aside>
        )}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-base)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="mono text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Editor principal</span>
            <button
              type="button"
              onClick={() => setShowEditor((current) => !current)}
              className="mono rounded-[5px] border border-[var(--border)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] transition hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)]"
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

        {sidePanel !== 'none' && sidePanel !== 'chat' && (
          <aside className={cn('z-20 flex min-w-0 flex-shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]', isMobile ? 'absolute inset-0 animate-[slideUp_0.25s_ease] shadow-[0_-16px_40px_rgba(0,0,0,0.45)]' : 'relative w-[300px] animate-[slideIn_0.25s_ease]')}>
            {sidePanel === 'tcc' && <TccPanel onInsert={handleInsert} onTopicChange={setFilenameFromTopic} onClose={closePanel} isMobile={isMobile} />}
            {sidePanel === 'work' && <WorkPanel onInsert={handleInsert} onTopicChange={setFilenameFromTopic} onClose={closePanel} isMobile={isMobile} editorMarkdown={markdown} />}
          </aside>
        )}
      </div>

      <EditorStatusBar markdown={markdown} loading={loading} filename={filename} includeCover={includeCover} isMobile={isMobile} onExport={exportDocx} />

      <AiChatDrawer open={sidePanel === 'chat'} onClose={closePanel} onInsert={handleInsert} onReplace={handleReplace} isMobile={isMobile} />

      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } } @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </main>
  );
}
