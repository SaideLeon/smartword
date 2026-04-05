'use client';

import { ExportButton } from '@/components/ExportButton';

interface Props {
  markdown: string;
  loading: boolean;
  filename: string;
  includeCover: boolean;
  isMobile: boolean;
  onExport: () => void;
}

export function EditorStatusBar({ markdown, loading, filename, includeCover, isMobile, onExport }: Props) {
  return (
    <div className="relative z-20 flex flex-shrink-0 flex-col items-stretch gap-3 border-t border-[var(--border)] bg-[var(--parchment)] px-3 py-2 md:flex-row md:items-center md:justify-between md:px-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {markdown.split('\n').length} linhas
        </span>
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {markdown.length} caracteres
        </span>
      </div>
      <ExportButton
        onClick={onExport}
        loading={loading}
        filename={filename}
        includeCover={includeCover}
        fullWidth={isMobile}
      />
    </div>
  );
}
