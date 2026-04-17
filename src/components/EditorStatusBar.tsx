'use client';

import { useCallback, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ProcessingBars } from '@/components/ProcessingBars';

interface Props {
  markdown: string;
  loading: boolean;
  filename: string;
  includeCover: boolean;
  isMobile: boolean;
  onExport: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  editor?: Editor | null;
}

type ViewMode = 'read' | 'edit' | 'web';

export function EditorStatusBar({
  markdown, loading, filename, includeCover,
  isMobile, onExport, zoom, onZoomChange, editor,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('edit');

  const lineCount = markdown.split('\n').length;
  const charCount = markdown.length;
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;

  const handleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (editor) editor.setEditable(mode === 'edit');
  }, [editor]);

  const handleZoomChange = useCallback((delta: number) => {
    onZoomChange(Math.min(200, Math.max(25, zoom + delta)));
  }, [zoom, onZoomChange]);

  const zoomPct = (zoom - 25) / 175;

  const Stat = ({ children }: { children: React.ReactNode }) => (
    <span className="font-mono text-[10px] text-[var(--dim)] whitespace-nowrap">{children}</span>
  );

  const StatSep = () => <div className="h-3 w-px bg-[var(--border2)]" />;

  const ViewBtn = ({ mode, label }: { mode: ViewMode; label: string }) => (
    <button
      type="button"
      onClick={() => handleViewMode(mode)}
      className={`cursor-pointer rounded border px-1.5 py-0.5 font-mono text-[9px] transition ${
        viewMode === mode
          ? 'border-[var(--gold)] text-[var(--muted)]'
          : 'border-[var(--border2)] text-[var(--dim)] hover:border-[var(--gold)] hover:text-[var(--muted)]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-[28px] shrink-0 items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-3">
      {/* Stats */}
      <Stat>Página 1 de 1</Stat>
      <StatSep />
      <Stat>Palavras: {wordCount.toLocaleString('pt-BR')}</Stat>
      <StatSep />
      <Stat>Idioma: Português</Stat>
      <StatSep />
      <Stat>{lineCount} LINHAS · {charCount} CHARS</Stat>

      <div className="flex-1" />

      {/* View mode buttons */}
      <div className="flex items-center gap-1">
        <ViewBtn mode="read" label="Leitura" />
        <ViewBtn mode="edit" label="Edição" />
        <ViewBtn mode="web" label="Web" />
      </div>

      <StatSep />

      {/* Zoom control */}
      {!isMobile && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleZoomChange(-10)}
            className="flex h-4 w-4 cursor-pointer items-center justify-center rounded border border-[var(--border2)] text-[11px] text-[var(--dim)] transition hover:border-[var(--gold)] hover:text-[var(--muted)]"
          >
            −
          </button>

          {/* Zoom bar */}
          <div
            className="relative h-[3px] w-16 cursor-pointer rounded bg-[var(--border2)]"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              onZoomChange(Math.round(25 + pct * 175));
            }}
          >
            <div
              className="h-full rounded bg-[var(--gold2)] transition-all"
              style={{ width: `${zoomPct * 100}%` }}
            />
            <div
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--gold2)] transition-all"
              style={{ left: `${zoomPct * 100}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => handleZoomChange(10)}
            className="flex h-4 w-4 cursor-pointer items-center justify-center rounded border border-[var(--border2)] text-[11px] text-[var(--dim)] transition hover:border-[var(--gold)] hover:text-[var(--muted)]"
          >
            +
          </button>

          <span className="w-8 text-center font-mono text-[10px] text-[var(--dim)]">{zoom}%</span>
        </div>
      )}

      {/* Export button */}
      <button
        type="button"
        onClick={onExport}
        disabled={loading}
        className="flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-3 py-1 font-mono text-[10px] font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ml-2"
      >
        {loading ? (
          <>
            <ProcessingBars height={11} barColor="#000" />
            A gerar…
          </>
        ) : (
          <>
            <span className="text-[11px]">↗</span>
            Exportar {filename}
          </>
        )}
      </button>
    </div>
  );
}
