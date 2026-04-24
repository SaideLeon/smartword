import type { ReactNode } from 'react';

interface AffiliateDashboardLayoutProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AffiliateDashboardLayout({
  title,
  subtitle,
  actions,
  children,
}: AffiliateDashboardLayoutProps) {
  return (
    <main className="min-h-dvh bg-[var(--parchment)] px-4 py-8 text-[var(--ink)] [--ink:#f1e8da] [--parchment:#0f0e0d] [--surface:#1a1714] [--surface2:#141210] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--border:#2c2721] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Programa de Afiliados</p>
              <h1 className="mt-1 font-serif text-3xl text-[var(--ink)]">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{subtitle}</p>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
