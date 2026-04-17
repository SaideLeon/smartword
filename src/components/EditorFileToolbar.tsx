'use client';

import type { ChangeEvent } from 'react';

interface Props {
  filename: string;
  onFilenameChange: (value: string) => void;
  onImportFile: (file: File) => void;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
  showPreview?: boolean;
  onTogglePreview?: () => void;
}

export function EditorFileToolbar({
  filename,
  onFilenameChange,
  onImportFile,
  showAdvanced = false,
  onToggleAdvanced,
  showPreview = false,
  onTogglePreview,
}: Props) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onImportFile(file);
    event.target.value = '';
  };

  return (
    <div className="flex items-center gap-2">
      {/* Ícone de documento — mais pequeno, sem destaque */}
      <div className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-xs font-bold text-black">
        ∂
      </div>

      {/* Input do nome do ficheiro — ocupa o espaço disponível */}
      <div className="relative min-w-0 flex-1">
        <input
          type="text"
          value={filename}
          onChange={e => onFilenameChange(e.target.value)}
          className="w-full rounded border border-[var(--border)] bg-transparent px-2.5 py-1 pr-12 font-mono text-[11px] text-[var(--muted)] outline-none transition focus:border-[var(--gold2)] placeholder-[var(--faint)]"
          aria-label="Nome do ficheiro"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[var(--faint)]">
          .docx
        </span>
      </div>

      {/* Botão importar */}
      <label className="cursor-pointer rounded border border-[var(--border)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)] whitespace-nowrap">
        Importar
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Importar ficheiro TXT ou Markdown"
        />
      </label>

      {/* Toggle modo avançado — integrado na mesma linha */}
      {onToggleAdvanced && (
        <button
          type="button"
          onClick={onToggleAdvanced}
          className={`whitespace-nowrap rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition ${
            showAdvanced
              ? 'border-[var(--gold2)] bg-[var(--gold2)]/10 text-[var(--gold2)]'
              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
          }`}
          title="Modo avançado"
        >
          {showAdvanced ? 'Ocultar' : 'Avançado'}
        </button>
      )}

      {onTogglePreview && (
        <button
          type="button"
          onClick={onTogglePreview}
          className={`whitespace-nowrap rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition ${
            showPreview
              ? 'border-[var(--gold2)] bg-[var(--gold2)]/10 text-[var(--gold2)]'
              : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
          }`}
          title="Pré-visualização DOCX"
        >
          {showPreview ? 'Ocultar pré-vis.' : 'Pré-visualização'}
        </button>
      )}
    </div>
  );
}
