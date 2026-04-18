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

type RibbonTab = 'inicio' | 'inserir' | 'design' | 'layout' | 'referencias' | 'revisao';

const TABS: { key: RibbonTab; label: string }[] = [
  { key: 'inicio',     label: 'PÁGINA INICIAL' },
  { key: 'inserir',    label: 'INSERIR' },
  { key: 'design',     label: 'DESIGN' },
  { key: 'layout',     label: 'LAYOUT' },
  { key: 'referencias',label: 'REFERÊNCIAS' },
  { key: 'revisao',    label: 'REVISÃO' },
];

// ── Régua ──────────────────────────────────────────────────────────────────────
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

// ── Constantes de página A4 ────────────────────────────────────────────────────
//
// Altura total da página A4 renderizada (877 px ≈ 297 mm a 96 dpi).
// Margens: 64 px topo + 64 px base → área de conteúdo = 749 px.
// Os separadores têm 128 px de altura total (64 + 14 + 50 px).
//
// NOTA SOBRE O TRANSBORDAMENTO:
// O texto que flui para a zona de margem (64 px acima/abaixo do conteúdo)
// é coberto pelas zonas brancas do separador, que usam position:absolute
// com z-index superior ao do editor. Isto impede visualmente o texto de
// "aparecer" entre páginas sem precisar de clipar o editor.
//
const PAGE_H        = 877;   // altura total A4 em px
const MARGIN_V      = 64;    // margem vertical (topo e base) em px
const CONTENT_H     = PAGE_H - MARGIN_V * 2; // 749 px de conteúdo útil
const SEP_COVER     = 57;    // px de zona branca que cobre cada margem
const SEP_BAR       = 14;    // px da tira escura entre páginas
const SEP_TOTAL     = SEP_COVER * 2 + SEP_BAR; // 128 px total do separador

// ── Componente principal ───────────────────────────────────────────────────────
export default function Home() {
  const {
    markdown, setMarkdown, filename, includeCover,
    setFilename, loading, exportDocx, importTextFile,
    clearDefaultMarkdown, setFilenameFromTopic,
  } = useDocumentEditor();

  const { canRedo, canUndo } = useEditorMeta();
  const { redo, undo }       = useEditorActions();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const isMobile = useIsMobile();

  const [mode, setMode]               = useState<AppMode>('tcc');
  const [ribbonTab, setRibbonTab]     = useState<RibbonTab>('inicio');
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [zoom, setZoom]               = useState(90);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  // ── Rastreamento de páginas ────────────────────────────────────────────────
  // pageCount é calculado medindo a altura real do conteúdo do editor
  // e dividindo pelo tamanho de uma página A4 (877 px).
  const [pageCount, setPageCount]           = useState(1);
  const [actualContentHeight, setActualContentHeight] = useState(PAGE_H);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  // ResizeObserver — atualiza pageCount sempre que o conteúdo cresce ou encolhe.
  // Usa a altura do wrapper interno do editor (não do contentor da página)
  // para ter a medida exata do texto renderizado.
  useEffect(() => {
    const el = editorWrapperRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      setActualContentHeight(h);
      setPageCount(Math.max(1, Math.ceil(h / PAGE_H)));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Tema ───────────────────────────────────────────────────────────────────
  const themeVars = themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--surface:#1a1714] [--surface2:#141210] [--gold:#d4b37b] [--gold2:#c9a96e] [--gold3:#8b6914] [--muted:#c8bfb4] [--faint:#8a7d6e] [--dim:#5a5248] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--border2:#3a332a] [--navBg:#1a1714] [--heroRight:#090908]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--surface:#ece8df] [--surface2:#e5e0d5] [--gold:#c9a96e] [--gold2:#8b6914] [--gold3:#6a4e10] [--muted:#6b6254] [--faint:#c4b8a4] [--dim:#a09585] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--border2:#c8baa0] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  // Cor de fundo do separador entre páginas
  const sepBarColor = themeMode === 'dark' ? '#111010' : '#b8ae9e';

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

  // ── Zoom ───────────────────────────────────────────────────────────────────
  // Usamos a propriedade CSS `zoom` em vez de `transform: scale`.
  //
  // Diferença crítica:
  //   transform:scale → não afeta o espaço ocupado no layout, requer
  //                     compensação manual com marginBottom negativo
  //                     e cria um stacking context que interfere com z-index.
  //
  //   zoom            → afeta o espaço ocupado no layout corretamente,
  //                     não requer compensação, não cria stacking context.
  //
  // Com zoom CSS, o contentor cresce/encolhe proporcionalmente e os
  // separadores posicionados com `position:absolute` seguem automaticamente.
  const zoomFactor = zoom / 100;

  return (
    <main className={`${themeVars} flex h-dvh flex-col overflow-hidden bg-[var(--parchment)] text-[var(--ink)]`}>

      {/* ── Cabeçalho (44 px) ── */}
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

      {/* ── Separador de tabs (30 px) ── */}
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

      {/* ── Ribbon (72 px) ── */}
      <EditorRibbon editor={editorInstance} activeTab={ribbonTab} />

      {/* ── Barra de ficheiro (32 px) ── */}
      <EditorFileToolbar
        filename={filename}
        onFilenameChange={setFilename}
        onImportFile={importTextFile}
      />

      {/* ── Área de trabalho principal ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Calha lateral esquerda (40 px) */}
        <aside className="flex w-10 shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--surface)] pt-4">
          <div className="h-10 w-0.5 rounded bg-[linear-gradient(to_bottom,transparent,var(--gold),transparent)]" />
        </aside>

        {/* ── Área de documento ── */}
        <div
          className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden bg-[var(--parchment)] px-5 pb-12 pt-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border2) transparent' }}
        >
          {/* Régua */}
          <Ruler />

          {/*
           * ── Contentor principal do documento ──────────────────────────────
           *
           * ARQUITECTURA DE PÁGINAS:
           *
           *  ┌─────────────────────────────────┐  ← contentor (posição relativa)
           *  │  fundo branco A4 (absoluto, z=0)│  ← cresce com o conteúdo
           *  │  ┌───────────────────────────┐  │
           *  │  │  editor TipTap (z=1)      │  │  ← texto flui livremente
           *  │  └───────────────────────────┘  │
           *  │  separador pág 1→2 (abs, z=10)  │  ← COBRE o texto nas margens
           *  │  separador pág 2→3 (abs, z=10)  │
           *  │  ...                            │
           *  └─────────────────────────────────┘
           *
           * Os separadores têm z-index superior ao editor e cobrem a zona
           * de margem (64 px em cima + 64 px em baixo de cada fronteira),
           * impedindo que o texto apareça visualmente entre páginas.
           *
           * O texto NÃO é clipado — continua a fluir normalmente no TipTap.
           * O efeito visual de "páginas separadas" é obtido por cobertura,
           * não por clipping, o que mantém o editor 100% funcional.
           *
           * ZOOM: aplicado via propriedade CSS `zoom` no contentor.
           * Ao contrário de transform:scale, o zoom CSS afeta o espaço
           * ocupado no layout, pelo que não é necessária nenhuma compensação.
           ──────────────────────────────────────────────────────────────────── */}
          <div
            className="relative w-full max-w-[620px] shrink-0"
            style={{
              // zoom CSS: escala o conteúdo E o espaço ocupado no layout
              zoom: zoomFactor,

              // Altura mínima de uma página A4
              minHeight: `${PAGE_H}px`,
            }}
          >
            {/*
             * Fundo branco — simula a folha de papel.
             * Cresce com o conteúdo do editor graças ao position:absolute + inset:0.
             * z-index: 0 — fica atrás de tudo, incluindo o editor.
             */}
            <div
              style={{
                position:        'absolute',
                inset:           0,
                backgroundColor: 'white',
                boxShadow:       '0 4px 28px rgba(0,0,0,0.50)',
                zIndex:          0,
                // Altura mínima garante que a primeira página tem sempre 877 px
                minHeight:       `${PAGE_H}px`,
              }}
            />

            {/*
             * Wrapper do editor — z-index: 1, acima do fundo branco.
             * É este elemento que o ResizeObserver mede para calcular pageCount.
             */}
            <div
              ref={editorWrapperRef}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <RichEditor
                value={markdown}
                onChange={setMarkdown}
                isMobile={isMobile}
                onEditorReady={setEditorInstance}
              />
            </div>

            {/*
             * ── Separadores entre páginas ──────────────────────────────────
             *
             * Existe um separador por cada fronteira entre páginas.
             * (pageCount - 1) separadores no total.
             *
             * Cada separador é composto por 3 zonas verticais:
             *
             *   ┌────────────────────────────────────────┐
             *   │  BRANCO SUPERIOR (SEP_COVER = 57 px)   │ ← cobre margem inf. da pág. N
             *   ├────────────────────────────────────────┤
             *   │  BARRA ESCURA    (SEP_BAR   = 14 px)   │ ← fronteira visual
             *   ├────────────────────────────────────────┤
             *   │  BRANCO INFERIOR (SEP_COVER = 57 px)   │ ← cobre margem sup. da pág. N+1
             *   └────────────────────────────────────────┘
             *
             * Posicionamento:
             *   top = (i+1) * PAGE_H - SEP_COVER
             *   (i+1)*PAGE_H é a fronteira entre as páginas i e i+1)
             *   Subtraímos SEP_COVER para que a zona branca superior comece
             *   64 px antes da fronteira, cobrindo a margem inferior da pág. N.
             *
             * z-index: 10 — acima do editor (z=1) e do fundo (z=0).
             * pointer-events: none — não interfere com a edição de texto.
             ──────────────────────────────────────────────────────────────── */}
            {Array.from({ length: pageCount - 1 }, (_, i) => {
              const boundaryY = (i + 1) * PAGE_H;
              const sepTop    = boundaryY - SEP_COVER;

              return (
                <div
                  key={`sep-${i}`}
                  aria-hidden="true"
                  style={{
                    position:      'absolute',
                    left:          0,
                    right:         0,
                    top:           `${sepTop}px`,
                    height:        `${SEP_TOTAL}px`,
                    zIndex:        10,
                    pointerEvents: 'none',
                    display:       'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Zona branca superior — cobre margem inferior da página N */}
                  <div style={{ height: `${SEP_COVER}px`, backgroundColor: 'white' }} />

                  {/* Tira escura — fronteira física entre as duas folhas */}
                  <div
                    style={{
                      height:          `${SEP_BAR}px`,
                      backgroundColor: sepBarColor,
                      boxShadow:       '0 2px 10px rgba(0,0,0,0.50), 0 -2px 10px rgba(0,0,0,0.40)',
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      flexShrink:      0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily:    '"JetBrains Mono", monospace',
                        fontSize:      '7px',
                        letterSpacing: '0.14em',
                        color:         themeMode === 'dark' ? '#4a4440' : '#9a9080',
                        userSelect:    'none',
                        whiteSpace:    'nowrap',
                      }}
                    >
                      — Pág. {i + 1} / {pageCount} —
                    </span>
                  </div>

                  {/* Zona branca inferior — cobre margem superior da página N+1 */}
                  <div style={{ height: `${SEP_COVER}px`, backgroundColor: 'white' }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sidebar direita (340 px) ── */}
        {showRightSidebar && (
          <aside
            className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border2) transparent' }}
          >
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

        {/* ── Painéis mobile ── */}
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

      {/* ── Barra de estado (28 px) ── */}
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

      {/* ── Drawer de chat IA ── */}
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
