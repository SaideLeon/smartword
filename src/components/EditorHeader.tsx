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
    <header className="relative z-20 flex h-[52px] flex-shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3">
      <div className="flex items-center gap-[9px]">
        <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-[linear-gradient(135deg,#f59e0b,#f97316)] text-[15px] font-extrabold text-black">∂</span>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold leading-none text-[var(--text-primary)]">Muneri</span>
          <span className="mono max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-[var(--text-muted)]">Markdown para Word com equações nativas</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <PanelToggleButton active={sidePanel === 'work'} label="Trabalho" onClick={() => onTogglePanel('work')} />
        <PanelToggleButton active={sidePanel === 'tcc'} label="TCC" onClick={() => onTogglePanel('tcc')} />
        <PanelToggleButton active={sidePanel === 'chat'} label="IA" onClick={() => onTogglePanel('chat')} highlight />

        <div className="ml-1.5 flex items-center gap-1 border-l border-[var(--border)] pl-2">
          <button aria-label="Desfazer" className="press-feedback grid h-[30px] w-[30px] place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-secondary)] disabled:opacity-40" disabled={!canUndo} onClick={onUndo}>↶</button>
          <button aria-label="Refazer" className="press-feedback grid h-[30px] w-[30px] place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-secondary)] disabled:opacity-40" disabled={!canRedo} onClick={onRedo}>↷</button>
        </div>

        <div className="ml-1.5 flex items-center gap-1.5 border-l border-[var(--border)] pl-2">
          <span className="mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]">LaTeX → OMML</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-teal)] shadow-[0_0_6px_var(--accent-teal)]" />
        </div>
      </div>
    </header>
  );
}

function PanelToggleButton({ active, label, onClick, highlight = false }: { active: boolean; label: string; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      className={cn(
        'press-feedback mono rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
        highlight
          ? active
            ? 'border-transparent bg-[var(--accent-amber)] text-black'
            : 'border-transparent bg-[var(--accent-amber)] text-black hover:brightness-110'
          : active
            ? 'border-[var(--border)] bg-[var(--bg-active)] text-[var(--text-primary)]'
            : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
