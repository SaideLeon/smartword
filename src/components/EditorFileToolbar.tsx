'use client';

interface Props {
  filename: string;
  onFilenameChange: (value: string) => void;
}

export function EditorFileToolbar({ filename, onFilenameChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-[linear-gradient(135deg,#1e3a5f,#2d5a8e)] text-sm">📄</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="mono text-[11px] font-bold text-[var(--text-primary)]">Workspace</span>
        <div className="relative mt-1">
          <input
            type="text"
            value={filename}
            onChange={(e) => onFilenameChange(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 pr-14 text-[11px] text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--accent-amber)]"
            aria-label="Nome do ficheiro"
          />
          <span className="mono pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">.docx</span>
        </div>
      </div>
    </div>
  );
}
