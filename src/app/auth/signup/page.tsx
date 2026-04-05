'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';
import { ProcessingBars } from '@/components/ProcessingBars';

export default function SignupPage() {
  const router = useRouter();

  const { themeMode, toggleThemeMode } = useThemeMode();
  const { isLoggedIn, signUp, loading, error } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const themeVars =
    themeMode === 'dark'
      ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
      : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/app');
    }
  }, [isLoggedIn, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setLocalError('As palavras-passe não coincidem.');
      return;
    }

    setSubmitting(true);
    const ok = await signUp(email, password, fullName || undefined);
    setSubmitting(false);

    if (ok) {
      setSuccessMessage('Conta criada com sucesso. Já pode entrar.');
      router.push('/auth/login');
    }
  }

  return (
    <main className={`${themeVars} flex min-h-screen flex-col bg-[var(--parchment)] text-[var(--ink)]`}>

      {/* Cabeçalho mínimo */}
      <header className="flex items-center justify-between border-b border-[var(--border)]/80 bg-[var(--navBg)]/90 px-5 py-3 backdrop-blur md:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">
            ∂
          </div>
          <span className="font-serif text-lg italic text-[var(--gold2)]">Muneri</span>
        </Link>

        <button
          type="button"
          onClick={toggleThemeMode}
          className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
          aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {themeMode === 'dark' ? <><Sun size={11} /> Claro</> : <><Moon size={11} /> Escuro</>}
        </button>
      </header>

      {/* Conteúdo centrado */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-7 shadow-2xl">

          {/* Cabeçalho do card */}
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)]">
            Muneri · Nova conta
          </p>
          <h1 className="mt-2 font-serif text-[1.9rem] leading-[1.2]">
            Criar <em className="text-[var(--gold2)]">conta.</em>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Registe-se para começar a gerar os seus trabalhos académicos.
          </p>

          {/* Formulário */}
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
                Nome completo
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="mt-1.5 w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] placeholder-[var(--faint)] outline-none transition focus:border-[var(--gold2)]"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teuemail@exemplo.com"
                className="mt-1.5 w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] placeholder-[var(--faint)] outline-none transition focus:border-[var(--gold2)]"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
                Palavra-passe
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] placeholder-[var(--faint)] outline-none transition focus:border-[var(--gold2)]"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
                Confirmar palavra-passe
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] placeholder-[var(--faint)] outline-none transition focus:border-[var(--gold2)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || submitting}
              className="flex w-full items-center justify-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--parchment)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <ProcessingBars height={13} />
                  A criar conta…
                </>
              ) : 'Criar conta'}
            </button>
          </form>

          {/* Feedback */}
          {(localError || error) && (
            <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
              {localError ?? error}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 rounded border border-[var(--green)]/40 bg-[var(--green)]/10 px-3 py-2 font-mono text-[11px] text-[var(--green)]">
              {successMessage}
            </div>
          )}

          {/* Links */}
          <div className="mt-6 space-y-2 text-center font-mono text-[11px] text-[var(--faint)]">
            <p>
              Já tem conta?{' '}
              <Link href="/auth/login" className="text-[var(--muted)] underline underline-offset-2 hover:text-[var(--gold2)]">
                Entrar
              </Link>
            </p>
            <p>
              <Link href="/" className="underline underline-offset-2 hover:text-[var(--gold2)]">
                Voltar para a página inicial
              </Link>
            </p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-5 py-5 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)] md:px-12">
        Muneri · Gerador automático de trabalhos académicos · 2026
      </footer>
    </main>
  );
}
