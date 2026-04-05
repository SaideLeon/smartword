'use client';

import type { ChangeEvent } from 'react';

interface Props {
  filename: string;
  onFilenameChange: (value: string) => void;
  onImportFile: (file: File) => void;
}

export function EditorFileToolbar({ filename, onFilenameChange, onImportFile }: Props) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onImportFile(file);
    event.target.value = '';
  };

  return (
    <div className="flex items-center gap-2">
      {/* Ícone de documento */}
      <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">
        ∂
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">
          Workspace
        </span>

        <div className="relative mt-1 flex items-center gap-2">
          {/* Input do nome do ficheiro */}
          <input
            type="text"
            value={filename}
            onChange={e => onFilenameChange(e.target.value)}
            className="w-full rounded border border-[var(--border)] bg-transparent px-2.5 py-1.5 pr-14 font-mono text-[11px] text-[var(--muted)] outline-none transition focus:border-[var(--gold2)] placeholder-[var(--faint)]"
            aria-label="Nome do ficheiro"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[var(--faint)]">
            .docx
          </span>

          {/* Botão importar */}
          <label className="cursor-pointer rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
            Importar
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Importar ficheiro TXT ou Markdown"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
