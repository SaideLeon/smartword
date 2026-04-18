'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { useEditorActions, useEditorMeta } from '@/hooks/useEditorStore';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useIsMobile } from '@/hooks/use-mobile';
import { RichEditor } from '@/components/RichEditor';
import { TccPanel } from '@/components/TccPanel';
import { WorkPanel } from '@/components/WorkPanel';
import { AiChatDrawer } from '@/components/AiChatDrawer';
import { EditorHeader } from '@/components/EditorHeader';
import type { AppMode } from '@/components/EditorHeader';
import { EditorRibbon } from '@/components/EditorRibbon';
import { EditorFileToolbar } from '@/components/EditorFileToolbar';
import { EditorStatusBar } from '@/components/EditorStatusBar';
import { IaMiniPanel } from '@/components/IaMiniPanel';
import { StylesPanel } from '@/components/StylesPanel';

type RibbonTab = 'inicio' | 'inserir' | 'design' | 'layout' | 'referencias' | 'revisao';

const TABS: { key: RibbonTab; label: string }[] = [
  { key: 'inicio', label: 'PÁGINA INICIAL' },
  { key: 'inserir', label: 'INSERIR' },
  { key: 'design', label: 'DESIGN' },
  { key: 'layout', label: 'LAYOUT' },
  { key: 'referencias', label: 'REFERÊNCIAS' },
  { key: 'revisao', label: 'REVISÃO' },
];

// ── Ruler component ────────────────────────────────────────────────────────────
function Ruler() {
  const marks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div className="relative flex h-5 w-full max-w-[620px] shrink-0 items-end rounded-t border border-[var(--border2)] border-b-0 bg-[var(--surface)] px-10">
      {marks.map(n => (
        <span
          key={n}
          className="absolute bottom-0 font-mono text-[7px] text-[var(--dim)]"
          style={{ left: `${40 + n * 52}px`, transform: 'translateX(-50%)' }}
        >
          {n}
        </span>
      ))}
      {marks.slice(0, -1).map((_, i) => (
        <div
          key={`tick-${i}`}
          className="absolute bottom-1 w-px bg-[var(--dim)]"
          style={{ left: `${40 + i * 52 + 26}px`, height: '4px' }}
        />
      ))}
    </div>
  );
}

// ── Main page component ────────────────────────────────────────────────────────
export default function Home() {
  const {
    markdown, setMarkdown, filename, includeCover,
    setFilename, loading, exportDocx, importTextFile,
    clearDefaultMarkdown, setFilenameFromTopic,
  } = useDocumentEditor();

  const { canRedo, canUndo } = useEditorMeta();
  const { redo, undo } = useEditorActions();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const isMobile = useIsMobile();

  const [mode, setMode] = useState<AppMode>('tcc');
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>('inicio');
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [zoom, setZoom] = useState(90);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  // ── Multi-page tracking ────────────────────────────────────────────────────
  // pageNaturalHeight: A4 page height in px at 100% zoom (≈ 297mm @ 96dpi)
  const pageNaturalHeight = 877;
  const [pageCount, setPageCount] = useState(1);
  const [actualContentHeight, setActualContentHeight] = useState(pageNaturalHeight);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Track the actual rendered height of the editor content
  useEffect(() => {
    const el = pageContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      setActualContentHeight(h);
      setPageCount(Math.max(1, Math.ceil(h / pageNaturalHeight)));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNaturalHeight]);

  // ── Theme vars ─────────────────────────────────────────────────────────────
  const themeVars = themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--surface:#1a1714] [--surface2:#141210] [--gold:#d4b37b] [--gold2:#c9a96e] [--gold3:#8b6914] [--muted:#c8bfb4] [--faint:#8a7d6e] [--dim:#5a5248] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--border2:#3a332a] [--navBg:#1a1714] [--heroRight:#090908]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--surface:#ece8df] [--surface2:#e5e0d5] [--gold:#c9a96e] [--gold2:#8b6914] [--gold3:#6a4e10] [--muted:#6b6254] [--faint:#c4b8a4] [--dim:#a09585] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--border2:#c8baa0] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  // ── Zoom math ──────────────────────────────────────────────────────────────
  const zoomScale = zoom / 100;
  const actualVisualHeight = actualContentHeight * zoomScale;
  // Compensate for the gap that transform:scale leaves in the layout flow
  const marginCompensation = zoomScale < 1 ? -(actualContentHeight - actualVisualHeight) : 0;

  const handleInsert = useCallback((text: string) => {
    setMarkdown(prev => prev ? `${prev}\n\n${text}` : text);
  }, [setMarkdown]);

  const handleReplace = useCallback((text: string) => setMarkdown(text), [setMarkdown]);

  const handleModeChange = useCallback((newMode: AppMode) => {
    clearDefaultMarkdown();
    setMode(prev => prev === newMode ? null : newMode);
  }, [clearDefaultMarkdown]);

  const handleClosePanel = useCallback(() => setMode(null), []);

  useEffect(() => {
    setFullscreenSupported(typeof document !== 'undefined' && !!document.documentElement.requestFullscreen);
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (!fullscreenSupported) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }, [fullscreenSupported]);

  const showRightSidebar = !isMobile && mode !== null;

  // ── Physical page break gap ────────────────────────────────────────────────
  // Cobre a margem inferior (64px) + margem superior (64px) de cada par de páginas.
  // O texto que flui para essa zona fica oculto atrás do gap — exatamente como
  // o Word esconde texto nas margens ao renderizar em modo de impressão.
  const PAGE_GAP = 128; // = margem inferior + margem superior
  const PAGE_MARGIN = PAGE_GAP / 2; // 64px de cada lado da fronteira

  return (
    <main className={`${themeVars} flex h-dvh flex-col overflow-hidden bg-[var(--parchment)] text-[var(--ink)]`}>

      {/* ── Header bar (44px) ── */}
      <EditorHeader
        mode={mode}
        onModeChange={handleModeChange}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        themeMode={themeMode}
        onToggleTheme={toggleThemeMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        fullscreenSupported={fullscreenSupported}
      />

      {/* ── Tabs bar (30px) ── */}
      <nav
        className="flex h-[30px] shrink-0 items-stretch border-b border-[var(--border)] bg-[var(--surface2)] px-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setRibbonTab(tab.key)}
            className={`cursor-pointer whitespace-nowrap border-b-2 px-3 font-mono text-[10px] tracking-[.08em] transition ${
              ribbonTab === tab.key
                ? 'border-[var(--gold2)] text-[var(--gold2)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Ribbon (72px) ── */}
      <EditorRibbon editor={editorInstance} activeTab={ribbonTab} />

      {/* ── File toolbar (32px) ── */}
      <EditorFileToolbar
        filename={filename}
        onFilenameChange={setFilename}
        onImportFile={importTextFile}
      />

      {/* ── Workspace (flex:1) ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left gutter (40px) */}
        <aside className="flex w-10 shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--surface)] pt-4">
          <div className="h-10 w-0.5 rounded bg-[linear-gradient(to_bottom,transparent,var(--gold),transparent)]" />
        </aside>

        {/* Document area */}
        <div
          className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden bg-[var(--parchment)] px-5 pb-12 pt-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border2) transparent' }}
        >
          {/* Ruler */}
          <Ruler />

          {/* ── A4 page container ─────────────────────────────────────────
            Arquitectura de z-index:
              z-index: -1  → fundos brancos das páginas (atrás do texto)
              z-index: auto → texto do RichEditor (fluxo normal)
              z-index:  50  → separadores entre páginas (à frente do texto)
            O transform:scale no contentor cria um stacking context; dentro
            dele z-50 garante cobertura acima do ProseMirror em qualquer
            versão do TipTap.
          ──────────────────────────────────────────────────────────────── */}
          <div
            ref={pageContainerRef}
            className="relative w-full max-w-[620px] shrink-0"
            style={{
              minHeight: `${pageNaturalHeight}px`,
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top center',
              marginBottom: `${marginCompensation}px`,
            }}
          >
            {/* ── Fundos brancos (um por página) — atrás do texto ─────────
              z-index: -1 dentro do stacking context criado pelo transform:
              pinta após o background do contentor (transparente) mas antes
              do fluxo de texto (z-index: auto).
            ─────────────────────────────────────────────────────────────── */}
            {Array.from({ length: pageCount }, (_, i) => (
              <div
                key={`page-bg-${i}`}
                className="pointer-events-none absolute left-0 right-0"
                style={{
                  top: `${i * pageNaturalHeight}px`,
                  height: `${pageNaturalHeight}px`,
                  backgroundColor: 'white',
                  zIndex: -1,
                  boxShadow: '0 4px 28px rgba(0,0,0,0.50)',
                }}
              />
            ))}

            <RichEditor
              value={markdown}
              onChange={setMarkdown}
              isMobile={isMobile}
              onEditorReady={setEditorInstance}
            />

            {/* ── Separadores entre páginas — à frente do texto ───────────
              z-index: 50 garante cobertura acima do texto (z-index: auto).
              Cada separador tem 3 zonas:
                • BRANCO superior (57px) = margem inferior da pág. N visível
                • ESCURO central  (14px) = fronteira física entre folhas
                • BRANCO inferior (57px) = margem superior da pág. N+1 visível
              As zonas brancas cobrem texto que transborde para a zona de margem.
            ─────────────────────────────────────────────────────────────── */}
            {Array.from({ length: pageCount - 1 }, (_, i) => {
              const boundary = (i + 1) * pageNaturalHeight;
              const gapTop = boundary - PAGE_MARGIN; // y = 877n - 64
              const SEPARATOR_H = 14; // altura da tira escura
              const separatorTop = PAGE_MARGIN - SEPARATOR_H / 2; // 64 - 7 = 57px

              return (
                <div
                  key={`gap-${i}`}
                  className="pointer-events-none absolute left-0 right-0"
                  style={{ top: `${gapTop}px`, height: `${PAGE_GAP}px`, zIndex: 50 }}
                >
                  {/* Zona branca superior — margem inferior da página N */}
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: 0,
                      height: `${separatorTop}px`,
                      backgroundColor: 'white',
                    }}
                  />

                  {/* Tira escura — fronteira física entre as duas folhas */}
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: `${separatorTop}px`,
                      height: `${SEPARATOR_H}px`,
                      backgroundColor: themeMode === 'dark' ? '#111010' : '#b8ae9e',
                      boxShadow:
                        '0 2px 10px rgba(0,0,0,0.50), ' +
                        '0 -2px 10px rgba(0,0,0,0.40)',
                    }}
                  >
                    {/* Rótulo de página — centrado na tira escura */}
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '7px',
                        letterSpacing: '0.14em',
                        color: themeMode === 'dark' ? '#4a4440' : '#9a9080',
                      }}
                    >
                      — Pág. {i + 1} / {pageCount} —
                    </div>
                  </div>

                  {/* Zona branca inferior — margem superior da página N+1 */}
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top: `${separatorTop + SEPARATOR_H}px`,
                      bottom: 0,
                      backgroundColor: 'white',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar (240px) */}
        {showRightSidebar && (
          <aside
            className="flex w-60 shrink-0 flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border2) transparent' }}
          >
            {/* Styles panel — always visible */}
            <StylesPanel editor={editorInstance} />

            {/* Mode panel */}
            {mode === 'tcc' && (
              <div className="flex flex-1 flex-col border-t border-[var(--border)]">
                <TccPanel
                  onInsert={handleInsert}
                  onTopicChange={setFilenameFromTopic}
                  onClose={handleClosePanel}
                  isMobile={false}
                  editorMarkdown={markdown}
                />
              </div>
            )}

            {mode === 'trabalho' && (
              <div className="flex flex-1 flex-col border-t border-[var(--border)]">
                <WorkPanel
                  onInsert={handleInsert}
                  onTopicChange={setFilenameFromTopic}
                  onClose={handleClosePanel}
                  isMobile={false}
                  editorMarkdown={markdown}
                />
              </div>
            )}

            {mode === 'ia' && (
              <div className="border-t border-[var(--border)]">
                <IaMiniPanel
                  onInsert={handleInsert}
                  onReplace={handleReplace}
                  onOpenFullChat={() => setShowChatDrawer(true)}
                />
              </div>
            )}
          </aside>
        )}

        {/* Mobile panels */}
        {isMobile && mode === 'tcc' && (
          <div className="absolute inset-0 z-20 animate-[slideUp_0.25s_ease] bg-[var(--parchment)] shadow-2xl">
            <TccPanel
              onInsert={handleInsert}
              onTopicChange={setFilenameFromTopic}
              onClose={handleClosePanel}
              isMobile={true}
              editorMarkdown={markdown}
            />
          </div>
        )}

        {isMobile && mode === 'trabalho' && (
          <div className="absolute inset-0 z-20 animate-[slideUp_0.25s_ease] bg-[var(--parchment)] shadow-2xl">
            <WorkPanel
              onInsert={handleInsert}
              onTopicChange={setFilenameFromTopic}
              onClose={handleClosePanel}
              isMobile={true}
              editorMarkdown={markdown}
            />
          </div>
        )}
      </div>

      {/* ── Status bar (28px) ── */}
      <EditorStatusBar
        markdown={markdown}
        loading={loading}
        filename={filename}
        includeCover={includeCover}
        isMobile={isMobile}
        onExport={exportDocx}
        zoom={zoom}
        onZoomChange={setZoom}
        editor={editorInstance}
      />

      {/* ── Full AI Chat Drawer (overlay) ── */}
      <AiChatDrawer
        open={showChatDrawer || (isMobile && mode === 'ia')}
        onClose={() => {
          setShowChatDrawer(false);
          if (isMobile && mode === 'ia') setMode(null);
        }}
        onInsert={handleInsert}
        onReplace={handleReplace}
        isMobile={isMobile}
      />

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
