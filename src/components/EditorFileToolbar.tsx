'use client';

interface Props {
  filename: string;
  onFilenameChange: (value: string) => void;
}

export function EditorFileToolbar({ filename, onFilenameChange }: Props) {
  return (
    <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
      <label className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em] text-[#5a5248]">
        Nome do ficheiro
      </label>
      <div className="relative w-full md:w-auto">
        <input
          type="text"
          value={filename}
          onChange={(e) => onFilenameChange(e.target.value)}
          className="w-full rounded border border-[#2a2520] bg-[#1a1714] px-2.5 py-1.5 pr-12 font-mono text-[13px] tracking-[0.02em] text-[#c9a96e] outline-none transition-colors focus:border-[#c9a96e55] md:w-[220px]"
          aria-label="Nome do ficheiro"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[#4a4440]">
          .docx
        </span>
      </div>
    </div>
  );
}
