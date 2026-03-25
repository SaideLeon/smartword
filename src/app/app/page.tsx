'use client';

import { useCallback } from 'react';
import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEditorActions, useEditorMeta, usePanelActions, useSidePanel } from '@/hooks/useEditorStore';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { ExportButton } from '@/components/ExportButton';
import { TccPanel } from '@/components/TccPanel';
import { WorkPanel } from '@/components/WorkPanel';
import { AiChatDrawer } from '@/components/AiChatDrawer';
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

      <header className="relative z-10 flex min-h-16 flex-shrink-0 flex-col items-start justify-between gap-3 border-b border-[#2a2520] bg-[rgba(15,14,13,0.85)] px-4 py-3 backdrop-blur md:flex-row md:items-center md:px-10 md:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-[#c9a96e] to-[#8b6914] font-mono text-[13px] font-bold text-[#0f0e0d]">∂</span>
          <span className="font-serif text-[15px] italic tracking-[0.06em] text-[#c9a96e]">
            Muneri
            <span className="not-italic text-[#5a5248]"> · </span>
            <span className="text-[13px] not-italic text-[#8a7d6e]">Markdown para Word com Equações Nativas</span>
          </span>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-2 md:w-auto md:justify-end md:gap-3">
          <PanelToggleButton active={sidePanel === 'work'} icon="📚" label="Trabalhos" closeLabel="Fechar Trabalhos" onClick={() => handleTogglePanel('work')} />
          <PanelToggleButton active={sidePanel === 'tcc'} icon="📝" label="TCC" closeLabel="Fechar TCC" onClick={() => handleTogglePanel('tcc')} />
          <PanelToggleButton active={sidePanel === 'chat'} icon="✦" label="IA" closeLabel="Fechar IA" onClick={() => handleTogglePanel('chat')} />

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button aria-label="Desfazer" className="press-feedback rounded border border-[#2a2520] bg-[#1a1714] px-2 py-1 font-mono text-[11px] text-[#8a7d6e] disabled:opacity-40" disabled={!canUndo} onClick={undo}>
              ↶
            </button>
            <button aria-label="Refazer" className="press-feedback rounded border border-[#2a2520] bg-[#1a1714] px-2 py-1 font-mono text-[11px] text-[#8a7d6e] disabled:opacity-40" disabled={!canRedo} onClick={redo}>
              ↷
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#4a4440]">LaTeX → OMML</span>
            <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#4a7c59] shadow-[0_0_6px_#4a7c59]" />
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <section className={cn('flex min-h-0 min-w-0 flex-1 flex-col gap-5 px-4 pb-3 pt-4 md:px-8 md:pb-4 md:pt-10', sidePanel !== 'none' && isMobile && 'overflow-hidden', !(sidePanel !== 'none' && isMobile) && 'overflow-y-auto')}>
          <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
            <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
              <label className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em] text-[#5a5248]">Nome do ficheiro</label>
              <div className="relative w-full md:w-auto">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="w-full rounded border border-[#2a2520] bg-[#1a1714] px-2.5 py-1.5 pr-12 font-mono text-[13px] tracking-[0.02em] text-[#c9a96e] outline-none transition-colors focus:border-[#c9a96e55] md:w-[220px]"
                  aria-label="Nome do ficheiro"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[#4a4440]">.docx</span>
              </div>
            </div>

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

      <div className="relative z-20 flex flex-shrink-0 flex-col items-stretch justify-between gap-3 border-t border-[#2a2520] bg-[rgba(15,14,13,0.95)] px-4 py-3 backdrop-blur md:flex-row md:items-center md:px-8">
        <div className="font-mono text-[11px] tracking-[0.05em] text-[#3a3530]">{markdown.split('\n').length} linhas · {markdown.length} caracteres</div>
        <ExportButton onClick={exportDocx} loading={loading} filename={filename} fullWidth={isMobile} />
      </div>

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

function PanelToggleButton({
  active,
  icon,
  label,
  closeLabel,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  closeLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'press-feedback flex items-center gap-1 rounded border px-3 py-1.5 font-mono text-[12px] tracking-[0.05em] transition-colors',
        active ? 'border-[#c9a96e55] bg-[#c9a96e22] text-[#c9a96e]' : 'border-[#2a2520] bg-[#1a1714] text-[#8a7d6e]',
      )}
      onClick={onClick}
      aria-label={active ? closeLabel : label}
    >
      <span>{icon}</span>
      <span>{active ? closeLabel : label}</span>
    </button>
  );
}
