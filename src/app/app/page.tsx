'use client';

// src/app/app/page.tsx
// Changes from original:
//   1. Import RichEditor instead of MarkdownEditor
//   2. Replace MarkdownEditor JSX with RichEditor (same props interface)
//   3. The "showEditor" toggle now shows raw Markdown textarea side-by-side (power user mode)
//   4. RichEditor is always visible as the primary editing surface

import { useCallback, useEffect, useState } from 'react';
import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEditorActions, useEditorMeta, usePanelActions, useSidePanel } from '@/hooks/useEditorStore';
import { useThemeMode } from '@/hooks/useThemeMode';
import { RichEditor } from '@/components/RichEditor';          // ← NEW
import { MarkdownEditor } from '@/components/MarkdownEditor';  // kept for power-user raw mode
import { TccPanel } from '@/components/TccPanel';
import { WorkPanel } from '@/components/WorkPanel';
import { AiChatDrawer } from '@/components/AiChatDrawer';
import { EditorHeader } from '@/components/EditorHeader';
import { EditorFileToolbar } from '@/components/EditorFileToolbar';
import { EditorStatusBar } from '@/components/EditorStatusBar';
import { DocumentPreview } from '@/components/DocumentPreview';
import { cn } from '@/lib/utils';

export default function Home() {
  const {
    markdown, previewMarkdown, setMarkdown, filename, includeCover,
    setFilename, loading, exportDocx, importTextFile, clearDefaultMarkdown,
    setFilenameFromTopic,
  } = useDocumentEditor();

  const sidePanel = useSidePanel();
  const { togglePanel, closePanel } = usePanelActions();
  const { canRedo, canUndo } = useEditorMeta();
  const { redo, undo } = useEditorActions();
  const isMobile = useIsMobile();

  // "showEditor" now means "show raw Markdown textarea" (power user mode)
  // "showPreview" means "show DOCX preview alongside"
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [showPreview, setShowPreview]         = useState(false);

  const { themeMode, toggleThemeMode } = useThemeMode();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

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

  const handleReplace = useCallback(
    (text: string) => { setMarkdown(text); },
    [setMarkdown],
  );

  const handleTogglePanel = useCallback(
    (panel: Parameters<typeof togglePanel>[0]) => {
      clearDefaultMarkdown();
      togglePanel(panel);
    },
    [clearDefaultMarkdown, togglePanel],
  );

  useEffect(() => {
    setFullscreenSupported(
      typeof document !== 'undefined' && !!document.documentElement.requestFullscreen,
    );
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (!fullscreenSupported) return;
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    await document.documentElement.requestFullscreen();
  }, [fullscreenSupported]);

  // Determine grid columns based on visible panels
  const gridCols = cn(
    'grid min-h-0 flex-1 gap-3',
    showRawMarkdown && showPreview  ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]' :
    showRawMarkdown || showPreview  ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' :
    'grid-cols-1',
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
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        fullscreenSupported={fullscreenSupported}
      />

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {!isMobile && (
          <aside className="flex w-11 flex-shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--parchment)] py-[18px]">
            <div className="h-10 w-0.5 rounded bg-[linear-gradient(to_bottom,transparent,var(--gold),transparent)]" />
          </aside>
        )}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--parchment)]">
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">

            {/* File toolbar — with toggle buttons for raw markdown and preview */}
            <EditorFileToolbar
              filename={filename}
              onFilenameChange={setFilename}
              onImportFile={importTextFile}
              showAdvanced={showRawMarkdown}
              onToggleAdvanced={() => setShowRawMarkdown(v => !v)}
              showPreview={showPreview}
              onTogglePreview={() => setShowPreview(v => !v)}
            />

            {/* Editor area */}
            <div className={gridCols}>

              {/* ── PRIMARY: Rich editor (always visible) ── */}
              <RichEditor
                value={markdown}
                onChange={setMarkdown}
                isMobile={isMobile}
              />

              {/* ── OPTIONAL: Raw Markdown textarea (power user) ── */}
              {showRawMarkdown && (
                <MarkdownEditor
                  value={markdown}
                  onChange={setMarkdown}
                  isMobile={isMobile}
                />
              )}

              {/* ── OPTIONAL: DOCX preview ── */}
              {showPreview && (
                <DocumentPreview
                  markdown={previewMarkdown}
                  originalMarkdown={markdown}
                  isMobile={isMobile}
                />
              )}
            </div>
          </div>
        </section>

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

      <AiChatDrawer
        open={sidePanel === 'chat'}
        onClose={closePanel}
        onInsert={handleInsert}
        onReplace={handleReplace}
        isMobile={isMobile}
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
