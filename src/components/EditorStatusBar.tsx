'use client';

import { ExportButton } from '@/components/ExportButton';

interface Props {
  markdown: string;
  loading: boolean;
  filename: string;
  isMobile: boolean;
  onExport: () => void;
}

export function EditorStatusBar({ markdown, loading, filename, isMobile, onExport }: Props) {
  return (
    <div className="relative z-20 flex flex-shrink-0 flex-col items-stretch justify-between gap-3 border-t border-[#2a2520] bg-[rgba(15,14,13,0.95)] px-4 py-3 backdrop-blur md:flex-row md:items-center md:px-8">
      <div className="font-mono text-[11px] tracking-[0.05em] text-[#3a3530]">
        {markdown.split('\n').length} linhas · {markdown.length} caracteres
      </div>
      <ExportButton onClick={onExport} loading={loading} filename={filename} fullWidth={isMobile} />
    </div>
  );
}
