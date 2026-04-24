'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sun, Moon, GraduationCap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';
import { ProcessingBars } from '@/components/ProcessingBars';
import { isEduEmailDomain } from '@/lib/edu-domain';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') || '/app';

  const { themeMode, toggleThemeMode } = useThemeMode();
  const { isLoggedIn, signInGoogle, signInEmail, loading, error } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detectar se o e-mail digitado é de domínio educativo
  const isEduEmail = isEduEmailDomain(email);

  const themeVars =
    themeMode === 'dark'
      ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
      : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  useEffect(() => {
    if (isLoggedIn) {
      router.refresh();
      router.replace(redirectTo);
    }
  }, [isLoggedIn, redirectTo, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const ok = await signInEmail(email, password);
    setSubmitting(false);
    if (ok) {
      router.refresh();
      router.replace(redirectTo);
    }
  }

  return (
    <main className={`${themeVars} flex min-h-screen flex-col bg-[var(--parchment)] text-[var(--ink)]`}>

      {/* Cabeçalho mínimo */}
      <header className="flex items-center justify-between border-b border-[var(--border)]/80 bg-[var(--navBg)]/90 px-5 py-3 backdrop-blur md:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">
            <Image src="/icon.svg" alt="Muneri logo" width={18} height={18} className="h-[18px] w-[18px]" />
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
            Muneri · Acesso
          </p>
          <h1 className="mt-2 font-serif text-[1.9rem] leading-[1.2]">
            Entrar na <em className="text-[var(--gold2)]">plataforma.</em>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Inicia sessão para continuar no editor de trabalhos académicos.
          </p>

          {/* Banner edu — aparece quando o e-mail digitado é de domínio educativo */}
          {isEduEmail && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-[var(--green)]/50 bg-[var(--green)]/10 px-4 py-3">
              <GraduationCap size={18} className="mt-0.5 shrink-0 text-[var(--green)]" />
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--green)]">
                  Conta educativa detectada
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                  Estudantes e docentes com conta institucional (domínio{' '}
                  <span className="font-mono text-[var(--green)]">.edu</span>) que entrem
                  com o Google recebem{' '}
                  <strong className="text-[var(--ink)]">30 dias do plano Premium grátis</strong>{' '}
                  no primeiro acesso.
                </p>
                <p className="mt-2 font-mono text-[10px] text-[var(--faint)]">
                  ↳ Use o botão "Continuar com Google" abaixo para activar o benefício.
                </p>
              </div>
            </div>
          )}

          {/* Google OAuth */}
          <button
            type="button"
            onClick={() => signInGoogle()}
            disabled={loading || submitting}
            className={`mt-5 flex w-full items-center justify-center gap-2 rounded border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isEduEmail
                ? 'border-[var(--green)]/60 bg-[var(--green)]/10 text-[var(--green)] hover:bg-[var(--green)]/20'
                : 'border-[var(--border)] bg-transparent text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
            }`}
          >
            {loading || submitting ? (
              <>
                <ProcessingBars height={13} />
                A autenticar…
              </>
            ) : (
              <>
                <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.15 3.58-8.63Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.86-3A7.2 7.2 0 0 1 12 19.31a7.16 7.16 0 0 1-6.7-4.94H1.31v3.09A12 12 0 0 0 12 24Z" />
                  <path fill="#FBBC05" d="M5.3 14.37A7.2 7.2 0 0 1 4.92 12c0-.82.14-1.62.38-2.37V6.54H1.31A12 12 0 0 0 0 12c0 1.94.46 3.77 1.31 5.46l3.99-3.09Z" />
                  <path fill="#EA4335" d="M12 4.69c1.76 0 3.35.61 4.6 1.81l3.45-3.45C17.95 1.09 15.24 0 12 0A12 12 0 0 0 1.31 6.54L5.3 9.63A7.16 7.16 0 0 1 12 4.69Z" />
                </svg>
                {isEduEmail ? 'Continuar com Google · Activar 30 dias grátis' : 'Continuar com Google'}
              </>
            )}
          </button>

          {/* Divisor */}
          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">ou</span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          {/* Formulário email/senha */}
          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] placeholder-[var(--faint)] outline-none transition focus:border-[var(--gold2)]"
              />
            </div>

            {/* Aviso quando é conta edu mas tenta fazer login por email/senha */}
            {isEduEmail && (
              <p className="rounded border border-[var(--faint)]/30 bg-[var(--border)]/20 px-3 py-2 font-mono text-[10px] leading-relaxed text-[var(--faint)]">
                ℹ️ O login por email/senha não activa o período gratuito de 30 dias.
                Use o Google para aproveitar o benefício da conta educativa.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || submitting}
              className="flex w-full items-center justify-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--parchment)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <ProcessingBars height={13} />
                  A entrar…
                </>
              ) : 'Entrar com email'}
            </button>
          </form>

          {/* Feedback de erro */}
          {error && (
            <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
              {error}
            </div>
          )}

          {/* Links */}
          <div className="mt-6 space-y-2 text-center font-mono text-[11px] text-[var(--faint)]">
            <p>
              Não tem conta?{' '}
              <Link href="/auth/signup" className="text-[var(--muted)] underline underline-offset-2 hover:text-[var(--gold2)]">
                Inscreva-se
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
