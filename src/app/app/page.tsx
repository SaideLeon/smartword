'use client';

import { useCallback } from 'react';
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
import { cn } from '@/lib/utils';

export default function Home() {
  const { markdown, setMarkdown, filename, setFilename, loading, exportDocx, clearDefaultMarkdown, setFilenameFromTopic } = useDocumentEditor();
  const sidePanel = useSidePanel();
  const { togglePanel, closePanel } = usePanelActions();
  const { canRedo, canUndo } = useEditorMeta();
  const { redo, undo } = useEditorActions();
  const isMobile = useIsMobile();

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
    <main className="relative flex h-dvh min-h-screen flex-col overflow-hidden bg-[#0f0e0d] font-serif text-[#e8e2d9]">
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-repeat opacity-50"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
          backgroundSize: '180px',
        }}
      />

      <EditorHeader
        sidePanel={sidePanel}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onTogglePanel={handleTogglePanel}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <section className={cn('flex min-h-0 min-w-0 flex-1 flex-col gap-5 px-4 pb-3 pt-4 md:px-8 md:pb-4 md:pt-10', sidePanel !== 'none' && isMobile && 'overflow-hidden', !(sidePanel !== 'none' && isMobile) && 'overflow-y-auto')}>
          <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
            <EditorFileToolbar filename={filename} onFilenameChange={setFilename} />

            <MarkdownEditor value={markdown} onChange={setMarkdown} isMobile={isMobile} />
          </div>
        </section>

        {sidePanel !== 'none' && sidePanel !== 'chat' && (
          <aside className={cn('z-20 flex min-w-0 flex-shrink-0 flex-col border-l border-[#2a2520] md:w-[380px]', isMobile ? 'absolute inset-0 animate-[slideUp_0.25s_ease] shadow-[0_-16px_40px_rgba(0,0,0,0.45)]' : 'relative animate-[slideIn_0.25s_ease]', sidePanel === 'tcc' ? 'bg-[#0b0d0b]' : 'bg-[#0a0d0a]')}>
            {sidePanel === 'tcc' && <TccPanel onInsert={handleInsert} onTopicChange={setFilenameFromTopic} onClose={closePanel} isMobile={isMobile} />}
            {sidePanel === 'work' && <WorkPanel onInsert={handleInsert} onTopicChange={setFilenameFromTopic} onClose={closePanel} isMobile={isMobile} />}
          </aside>
        )}
      </div>

      <EditorStatusBar markdown={markdown} loading={loading} filename={filename} isMobile={isMobile} onExport={exportDocx} />

      {!isMobile && (
        <footer className="relative z-10 flex flex-shrink-0 items-center justify-center border-t border-[#1e1b18] px-10 py-3">
          <span className="font-mono text-[11px] tracking-[0.06em] text-[#3a3530]">temml · mathml2omml · Muneri · Quelimane, Moçambique</span>
        </footer>
      )}

      <AiChatDrawer open={sidePanel === 'chat'} onClose={closePanel} onInsert={handleInsert} onReplace={handleReplace} isMobile={isMobile} />

      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } } @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </main>
  );
}
