'use client';

import type { ChangeEvent } from 'react';
import Image from 'next/image';

interface Props {
  filename: string;
  onFilenameChange: (value: string) => void;
  onImportFile: (file: File) => void;
  advancedMode?: boolean;
  onToggleAdvancedMode?: () => void;
}


interface FileToolbarButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  active?: boolean;
  title?: string;
}

function FileToolbarButton({ children, onClick, className = '', active = false, title }: FileToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`cursor-pointer rounded border px-2 py-1 font-mono text-[10px] font-bold tracking-[.06em] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)] ${
        active
          ? 'border-transparent bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black'
          : 'border-[var(--border2)] bg-transparent text-[var(--muted)]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function EditorFileToolbar({
  filename, onFilenameChange, onImportFile,
  advancedMode = false, onToggleAdvancedMode,
}: Props) {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportFile(file);
    e.target.value = '';
  };

  return (
    <div className="flex h-[32px] shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface2)] px-3">
      {/* Small logo */}
      <div className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-serif text-[11px] font-bold text-black">
        <Image src="/icon.svg" alt="Muneri logo" width={15} height={15} className="h-[15px] w-[15px]" />
      </div>

      {/* Filename input */}
      <div className="relative max-w-[240px] flex-1">
        <input
          type="text"
          value={filename}
          onChange={e => onFilenameChange(e.target.value)}
          className="w-full rounded border border-[var(--border2)] bg-transparent px-2 py-0.5 pr-10 font-mono text-[11px] text-[var(--muted)] outline-none transition focus:border-[var(--gold2)]"
          aria-label="Nome do ficheiro"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[var(--dim)]">
          .docx
        </span>
      </div>

      {/* File action buttons */}
      <label className="cursor-pointer">
        <FileToolbarButton>IMPORTAR</FileToolbarButton>
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Importar ficheiro"
        />
      </label>

      <FileToolbarButton
        onClick={onToggleAdvancedMode}
        active={advancedMode}
        title="Alterna entre o editor visual e o editor Markdown/LaTeX bruto"
      >
        {advancedMode ? 'VISUAL' : 'AVANÇADO'}
      </FileToolbarButton>
      <FileToolbarButton>PRÉ-VISUALIZAÇÃO</FileToolbarButton>
    </div>
  );
}
