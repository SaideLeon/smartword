'use client';

import Link from 'next/link';
import { Maximize, Minimize, Moon, Settings, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { ThemeMode } from '@/hooks/useThemeMode';

export type AppMode = 'trabalho' | 'tcc' | 'ia' | null;

interface Props {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  fullscreenSupported: boolean;
}

export function EditorHeader({
  mode, onModeChange,
  canUndo, canRedo, onUndo, onRedo,
  themeMode, onToggleTheme,
  isFullscreen, onToggleFullscreen, fullscreenSupported,
}: Props) {
  const { user, profile, plan, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userName = profile?.full_name || user?.email || 'Utilizador';

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current) return;
      if (userMenuRef.current.contains(event.target as Node)) return;
      setShowUserMenu(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const ModeBtn = ({ id, label, highlight = false }: { id: AppMode & string; label: string; highlight?: boolean }) => {
    const isActive = mode === id;
    return (
      <button
        type="button"
        onClick={() => onModeChange(isActive ? null : id)}
        className={`cursor-pointer rounded border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[.06em] transition-all ${
          highlight
            ? 'border-transparent bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black'
            : isActive
              ? 'border-transparent bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black'
              : 'border-[var(--border2)] bg-transparent text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
        }`}
      >
        {label}
      </button>
    );
  };

  const IconBtn = ({ children, onClick, disabled, title, label }: {
    children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; label?: string;
  }) => (
    <button
      type="button"
      title={title}
      aria-label={label ?? title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-[var(--border)] text-[13px] text-[var(--faint)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)] disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );

  const Sep = () => <div className="mx-1 h-5 w-px bg-[var(--border)]" />;

  return (
    <header className="relative z-20 flex h-[44px] shrink-0 items-center border-b border-[var(--border)] bg-[var(--surface)] px-2.5">

      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="grid h-[26px] w-[26px] place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-serif text-sm font-bold text-black">
          ∂
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-serif text-[15px] italic text-[var(--gold2)]">Muneri</span>
          <span className="hidden max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] text-[var(--dim)] sm:inline">
            Markdown para Word com equações nativas
          </span>
        </div>
      </div>

      <div
        className="flex flex-1 items-center gap-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex-1" />

        {/* Mode buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <ModeBtn id="trabalho" label="TRABALHO" />
          <ModeBtn id="tcc" label="TCC" />
          <ModeBtn id="ia" label="IA ✦" highlight />
        </div>

        <Sep />

        {/* Undo / Redo */}
        <IconBtn title="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>↶</IconBtn>
        <IconBtn title="Refazer (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}>↷</IconBtn>

        <Sep />

        {/* Status indicators */}
        <span className="shrink-0 font-mono text-[9px] tracking-[.06em] text-[var(--dim)]">LATEX → OMML</span>
        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--teal)] shadow-[0_0_5px_var(--teal)]" />

        <Sep />

        {/* Theme toggle */}
        <IconBtn title={themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'} onClick={onToggleTheme}>
          {themeMode === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </IconBtn>

        {/* Fullscreen */}
        {fullscreenSupported && (
          <IconBtn title={isFullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'} onClick={onToggleFullscreen}>
            {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </IconBtn>
        )}

        {/* User settings */}
        <div ref={userMenuRef} className="relative shrink-0">
          <IconBtn title="Configurações" onClick={() => setShowUserMenu(v => !v)}>
            <Settings size={13} />
          </IconBtn>

          {showUserMenu && (
            <div className="absolute right-0 top-[38px] z-50 w-72 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[.1em] text-[var(--faint)]">Conta</p>
                <button type="button" onClick={() => setShowUserMenu(false)} className="text-[var(--faint)] hover:text-[var(--muted)]">
                  <X size={12} />
                </button>
              </div>
              <p className="font-serif text-sm text-[var(--ink)]">{userName}</p>
              <p className="text-xs text-[var(--muted)]">{profile?.email || user?.email || ''}</p>

              <div className="mt-3 space-y-1 rounded border border-[var(--border)] bg-[var(--border)]/20 p-2 text-xs">
                <p className="text-[var(--muted)]">
                  Plano: <span className="font-semibold text-[var(--ink)]">{plan?.label || profile?.plan_key || 'Grátis'}</span>
                </p>
                <p className="text-[var(--muted)]">
                  Trabalhos usados: <span className="font-semibold text-[var(--ink)]">{profile?.works_used ?? 0}</span>
                </p>
              </div>

              <Link href="/planos" onClick={() => setShowUserMenu(false)} className="mt-2 block rounded border border-[var(--border)] px-2.5 py-2 text-center font-mono text-[11px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                Ver todos os planos
              </Link>

              <Link href="/app/afiliados" onClick={() => setShowUserMenu(false)} className="mt-1.5 block rounded border border-[var(--border)] px-2.5 py-2 text-center font-mono text-[11px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                Dashboard de afiliado
              </Link>

              {profile?.role === 'admin' && (
                <Link href="/admin" onClick={() => setShowUserMenu(false)} className="mt-1.5 block rounded border border-[var(--border)] px-2.5 py-2 text-center font-mono text-[11px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                  Área administrativa
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  signOut();
                }}
                className="mt-2 w-full rounded border border-red-500/40 bg-red-500/10 px-2.5 py-2 font-mono text-[11px] text-red-400 transition hover:bg-red-500/20"
              >
                Terminar sessão
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
