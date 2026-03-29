'use client';

import Link from 'next/link';
import { Menu, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
  const { user, profile, plan, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const userName = profile?.full_name || user?.email || 'Utilizador';

  return (
    <header className="relative z-20 flex h-[52px] flex-shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3">
      <div className="flex items-center gap-[9px]">
        <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-[linear-gradient(135deg,#f59e0b,#f97316)] text-[15px] font-extrabold text-black">∂</span>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold leading-none text-[var(--text-primary)]">Muneri</span>
          <span className="mono max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-[var(--text-muted)]">Markdown para Word com equações nativas</span>
        </div>
      </div>

      <div className="ml-auto hidden items-center gap-1.5 md:flex">
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

        <div className="relative ml-1.5 border-l border-[var(--border)] pl-2">
          <button
            type="button"
            aria-label="Abrir informações da conta"
            onClick={() => setShowUserMenu((current) => !current)}
            className="press-feedback grid h-[30px] w-[30px] place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            <Settings className="h-4 w-4" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-[38px] z-50 w-72 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-2xl">
              <p className="mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Conta</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{userName}</p>
              <p className="text-xs text-[var(--text-muted)]">{profile?.email || user?.email || 'Sem email'}</p>

              <div className="mt-3 space-y-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2 text-xs">
                <p className="text-[var(--text-muted)]">
                  Plano actual: <span className="font-semibold text-[var(--text-primary)]">{plan?.label || profile?.plan_key || 'Grátis'}</span>
                </p>
                <p className="text-[var(--text-muted)]">
                  Trabalhos usados: <span className="font-semibold text-[var(--text-primary)]">{profile?.works_used ?? 0}</span>
                </p>
              </div>

              <Link
                href="/planos"
                className="mt-3 block rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-2 text-center text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-card-hover)]"
              >
                Ver todos os planos
              </Link>

              <button
                type="button"
                onClick={() => signOut()}
                className="mt-2 w-full rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                Terminar sessão
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ml-auto md:hidden">
        <button
          type="button"
          aria-label={showMobileMenu ? 'Fechar menu principal' : 'Abrir menu principal'}
          onClick={() => setShowMobileMenu((current) => !current)}
          className="press-feedback grid h-[34px] w-[34px] place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
        >
          {showMobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {showMobileMenu && (
        <div className="absolute left-2 right-2 top-[58px] z-50 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-2xl md:hidden">
          <p className="mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Menu principal</p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <PanelToggleButton active={sidePanel === 'work'} label="Trabalho" onClick={() => { onTogglePanel('work'); setShowMobileMenu(false); }} />
            <PanelToggleButton active={sidePanel === 'tcc'} label="TCC" onClick={() => { onTogglePanel('tcc'); setShowMobileMenu(false); }} />
            <PanelToggleButton active={sidePanel === 'chat'} label="IA" onClick={() => { onTogglePanel('chat'); setShowMobileMenu(false); }} highlight />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button aria-label="Desfazer" className="press-feedback grid h-[30px] w-[30px] place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-secondary)] disabled:opacity-40" disabled={!canUndo} onClick={onUndo}>↶</button>
            <button aria-label="Refazer" className="press-feedback grid h-[30px] w-[30px] place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-secondary)] disabled:opacity-40" disabled={!canRedo} onClick={onRedo}>↷</button>
          </div>

          <div className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2 text-xs">
            <p className="mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Conta</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{userName}</p>
            <p className="text-[var(--text-muted)]">{profile?.email || user?.email || 'Sem email'}</p>
            <p className="mt-2 text-[var(--text-muted)]">
              Plano actual: <span className="font-semibold text-[var(--text-primary)]">{plan?.label || profile?.plan_key || 'Grátis'}</span>
            </p>
            <p className="text-[var(--text-muted)]">
              Trabalhos usados: <span className="font-semibold text-[var(--text-primary)]">{profile?.works_used ?? 0}</span>
            </p>
          </div>

          <Link
            href="/planos"
            onClick={() => setShowMobileMenu(false)}
            className="mt-3 block rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-2 text-center text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-card-hover)]"
          >
            Ver todos os planos
          </Link>

          <button
            type="button"
            onClick={() => signOut()}
            className="mt-2 w-full rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            Terminar sessão
          </button>
        </div>
      )}
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
