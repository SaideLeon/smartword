'use client';

import Link from 'next/link';
import { Menu, Moon, Settings, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { ThemeMode } from '@/hooks/useThemeMode';

interface Props {
  sidePanel: 'none' | 'work' | 'tcc' | 'chat';
  canUndo: boolean;
  canRedo: boolean;
  onTogglePanel: (panel: 'work' | 'tcc' | 'chat') => void;
  onUndo: () => void;
  onRedo: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

export function EditorHeader({ sidePanel, canUndo, canRedo, onTogglePanel, onUndo, onRedo, themeMode, onToggleTheme }: Props) {
  const { user, profile, plan, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const userName = profile?.full_name || user?.email || 'Utilizador';

  return (
    <header className="relative z-20 flex h-[52px] flex-shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--parchment)] px-3">

      {/* ── Logo ── */}
      <div className="flex items-center gap-[9px]">
        <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">
          ∂
        </div>
        <div className="flex flex-col">
          <span className="font-serif text-[15px] italic leading-none text-[var(--gold2)]">Muneri</span>
          <span className="font-mono max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-[var(--faint)]">
            Markdown para Word com equações nativas
          </span>
        </div>
      </div>

      {/* ── Desktop controls ── */}
      <div className="ml-auto hidden items-center gap-1.5 md:flex">

        {/* Painéis */}
        <PanelToggleButton active={sidePanel === 'work'} label="Trabalho" onClick={() => onTogglePanel('work')} />
        <PanelToggleButton active={sidePanel === 'tcc'}  label="TCC"      onClick={() => onTogglePanel('tcc')} />
        <PanelToggleButton active={sidePanel === 'chat'} label="Chat" onClick={() => onTogglePanel('chat')} />

        {/* Undo / Redo */}
        <div className="ml-1.5 flex items-center gap-1 border-l border-[var(--border)] pl-2">
          <IconBtn aria-label="Desfazer" disabled={!canUndo} onClick={onUndo}>↶</IconBtn>
          <IconBtn aria-label="Refazer"  disabled={!canRedo} onClick={onRedo}>↷</IconBtn>
        </div>

        {/* Tema + status */}
        <div className="ml-1.5 flex items-center gap-1.5 border-l border-[var(--border)] pl-2">
          <button
            type="button"
            aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            onClick={onToggleTheme}
            className="press-feedback flex h-[30px] w-[30px] items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
          >
            {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--faint)]">LaTeX → OMML</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)] shadow-[0_0_6px_var(--teal)]" />
        </div>

        {/* Conta / Settings */}
        <div className="relative ml-1.5 border-l border-[var(--border)] pl-2">
          <button
            type="button"
            aria-label="Abrir informações da conta"
            onClick={() => setShowUserMenu(v => !v)}
            className="press-feedback flex h-[30px] w-[30px] items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
          >
            <Settings className="h-4 w-4" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-[38px] z-50 w-72 rounded-lg border border-[var(--border)] bg-[var(--parchment)] p-3 shadow-2xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Conta</p>
              <p className="mt-1 font-serif text-sm text-[var(--ink)]">{userName}</p>
              <p className="text-xs text-[var(--muted)]">{profile?.email || user?.email || 'Sem email'}</p>

              <div className="mt-3 space-y-1 rounded border border-[var(--border)] bg-[var(--border)]/20 p-2 text-xs">
                <p className="text-[var(--muted)]">
                  Plano actual:{' '}
                  <span className="font-semibold text-[var(--ink)]">{plan?.label || profile?.plan_key || 'Grátis'}</span>
                </p>
                <p className="text-[var(--muted)]">
                  Trabalhos usados:{' '}
                  <span className="font-semibold text-[var(--ink)]">{profile?.works_used ?? 0}</span>
                </p>
              </div>

              <Link
                href="/planos"
                className="mt-3 block rounded border border-[var(--border)] px-2.5 py-2 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
              >
                Ver todos os planos
              </Link>

              {profile?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="mt-2 block rounded border border-[var(--border)] px-2.5 py-2 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
                >
                  Área administrativa
                </Link>
              )}

              <button
                type="button"
                onClick={() => signOut()}
                className="mt-2 w-full rounded border border-red-500/40 bg-red-500/10 px-2.5 py-2 font-mono text-[11px] text-red-400 transition hover:bg-red-500/20"
              >
                Terminar sessão
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: botão de menu ── */}
      <div className="ml-auto md:hidden">
        <button
          type="button"
          aria-label={showMobileMenu ? 'Fechar menu principal' : 'Abrir menu principal'}
          onClick={() => setShowMobileMenu(v => !v)}
          className="press-feedback flex h-[34px] w-[34px] items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
        >
          {showMobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Mobile: menu dropdown ── */}
      {showMobileMenu && (
        <div className="absolute left-2 right-2 top-[58px] z-50 rounded-lg border border-[var(--border)] bg-[var(--parchment)] p-3 shadow-2xl md:hidden">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Menu principal</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <PanelToggleButton active={sidePanel === 'work'} label="Trabalho" onClick={() => { onTogglePanel('work'); setShowMobileMenu(false); }} />
            <PanelToggleButton active={sidePanel === 'tcc'}  label="TCC"      onClick={() => { onTogglePanel('tcc');  setShowMobileMenu(false); }} />
            <PanelToggleButton active={sidePanel === 'chat'} label="Chat"     onClick={() => { onTogglePanel('chat'); setShowMobileMenu(false); }} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <IconBtn aria-label="Desfazer" disabled={!canUndo} onClick={onUndo}>↶</IconBtn>
            <IconBtn aria-label="Refazer"  disabled={!canRedo} onClick={onRedo}>↷</IconBtn>
            <button
              type="button"
              aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
              onClick={onToggleTheme}
              className="press-feedback flex h-[30px] w-[30px] items-center justify-center rounded border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
            >
              {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-3 rounded border border-[var(--border)] bg-[var(--border)]/20 p-2 text-xs">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Conta</p>
            <p className="mt-1 font-serif text-sm text-[var(--ink)]">{userName}</p>
            <p className="text-[var(--muted)]">{profile?.email || user?.email || 'Sem email'}</p>
            <p className="mt-2 text-[var(--muted)]">
              Plano actual:{' '}
              <span className="font-semibold text-[var(--ink)]">{plan?.label || profile?.plan_key || 'Grátis'}</span>
            </p>
            <p className="text-[var(--muted)]">
              Trabalhos usados:{' '}
              <span className="font-semibold text-[var(--ink)]">{profile?.works_used ?? 0}</span>
            </p>
          </div>

          <Link
            href="/planos"
            onClick={() => setShowMobileMenu(false)}
            className="mt-3 block rounded border border-[var(--border)] px-2.5 py-2 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
          >
            Ver todos os planos
          </Link>

          {profile?.role === 'admin' && (
            <Link
              href="/admin"
              onClick={() => setShowMobileMenu(false)}
              className="mt-2 block rounded border border-[var(--border)] px-2.5 py-2 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
            >
              Área administrativa
            </Link>
          )}

          <button
            type="button"
            onClick={() => signOut()}
            className="mt-2 w-full rounded border border-red-500/40 bg-red-500/10 px-2.5 py-2 font-mono text-[11px] text-red-400 transition hover:bg-red-500/20"
          >
            Terminar sessão
          </button>
        </div>
      )}
    </header>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function PanelToggleButton({
  active,
  label,
  onClick,
  highlight = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      className={cn(
        'press-feedback font-mono rounded border px-2.5 py-1 text-[11px] uppercase tracking-[0.06em] transition-all',
        highlight
          ? 'border-transparent bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black hover:brightness-110'
          : active
            ? 'border-[var(--gold2)] bg-[var(--gold2)]/10 text-[var(--gold2)]'
            : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  'aria-label': string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="press-feedback flex h-[30px] w-[30px] items-center justify-center rounded border border-[var(--border)] text-xs text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)] disabled:opacity-30 disabled:pointer-events-none"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
