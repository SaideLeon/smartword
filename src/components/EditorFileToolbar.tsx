'use client';

import type { ChangeEvent } from 'react';

interface Props {
  filename: string;
  onFilenameChange: (value: string) => void;
  onImportFile: (file: File) => void;
}

export function EditorFileToolbar({ filename, onFilenameChange, onImportFile }: Props) {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportFile(file);
    e.target.value = '';
  };

  const FtBtn = ({ children, onClick, className = '' }: {
    children: React.ReactNode; onClick?: () => void; className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded border border-[var(--border2)] bg-transparent px-2 py-1 font-mono text-[10px] font-bold tracking-[.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)] ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex h-[32px] shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface2)] px-3">
      {/* Small logo */}
      <div className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-serif text-[11px] font-bold text-black">
        ∂
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
        <FtBtn>IMPORTAR</FtBtn>
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Importar ficheiro"
        />
      </label>

      <FtBtn>AVANÇADO</FtBtn>
      <FtBtn>PRÉ-VISUALIZAÇÃO</FtBtn>
    </div>
  );
}
