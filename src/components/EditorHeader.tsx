'use client';

import { cn } from '@/lib/utils';

interface Props {
  sidePanel: 'none' | 'work' | 'tcc' | 'chat';
  canUndo: boolean;
  canRedo: boolean;
  onTogglePanel: (panel: 'work' | 'tcc' | 'chat') => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function EditorHeader({ sidePanel, canUndo, canRedo, onTogglePanel, onUndo, onRedo }: Props) {
  return (
    <header className="relative z-10 flex min-h-16 flex-shrink-0 flex-col items-start justify-between gap-3 border-b border-[#2a2520] bg-[rgba(15,14,13,0.85)] px-4 py-3 backdrop-blur md:flex-row md:items-center md:px-10 md:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-[#c9a96e] to-[#8b6914] font-mono text-[13px] font-bold text-[#0f0e0d]">
          ∂
        </span>
        <span className="font-serif text-[15px] italic tracking-[0.06em] text-[#c9a96e]">
          Muneri
          <span className="not-italic text-[#5a5248]"> · </span>
          <span className="text-[13px] not-italic text-[#8a7d6e]">Markdown para Word com Equações Nativas</span>
        </span>
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-2 md:w-auto md:justify-end md:gap-3">
        <PanelToggleButton active={sidePanel === 'work'} icon="📚" label="Trabalhos" closeLabel="Fechar Trabalhos" onClick={() => onTogglePanel('work')} />
        <PanelToggleButton active={sidePanel === 'tcc'} icon="📝" label="TCC" closeLabel="Fechar TCC" onClick={() => onTogglePanel('tcc')} />
        <PanelToggleButton active={sidePanel === 'chat'} icon="✦" label="IA" closeLabel="Fechar IA" onClick={() => onTogglePanel('chat')} />

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <button aria-label="Desfazer" className="press-feedback rounded border border-[#2a2520] bg-[#1a1714] px-2 py-1 font-mono text-[11px] text-[#8a7d6e] disabled:opacity-40" disabled={!canUndo} onClick={onUndo}>
            ↶
          </button>
          <button aria-label="Refazer" className="press-feedback rounded border border-[#2a2520] bg-[#1a1714] px-2 py-1 font-mono text-[11px] text-[#8a7d6e] disabled:opacity-40" disabled={!canRedo} onClick={onRedo}>
            ↷
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#4a4440]">LaTeX → OMML</span>
          <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#4a7c59] shadow-[0_0_6px_#4a7c59]" />
        </div>
      </div>
    </header>
  );
}

function PanelToggleButton({
  active,
  icon,
  label,
  closeLabel,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  closeLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'press-feedback flex items-center gap-1 rounded border px-3 py-1.5 font-mono text-[12px] tracking-[0.05em] transition-colors',
        active ? 'border-[#c9a96e55] bg-[#c9a96e22] text-[#c9a96e]' : 'border-[#2a2520] bg-[#1a1714] text-[#8a7d6e]',
      )}
      onClick={onClick}
      aria-label={active ? closeLabel : label}
    >
      <span>{icon}</span>
      <span>{active ? closeLabel : label}</span>
    </button>
  );
}
