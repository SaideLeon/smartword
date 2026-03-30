'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') || '/app';

  const { isLoggedIn, signInGoogle, signInEmail, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4 text-[var(--text-primary)]" data-theme="dark">
      <section className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl">
        <p className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Muneri</p>
        <h1 className="mt-1 text-2xl font-semibold">Entrar</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Inicia sessão para continuar no editor.</p>

        <button
          type="button"
          onClick={() => signInGoogle()}
          disabled={loading || submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm transition hover:bg-[var(--bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.15 3.58-8.63Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.86-3A7.2 7.2 0 0 1 12 19.31a7.16 7.16 0 0 1-6.7-4.94H1.31v3.09A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.3 14.37A7.2 7.2 0 0 1 4.92 12c0-.82.14-1.62.38-2.37V6.54H1.31A12 12 0 0 0 0 12c0 1.94.46 3.77 1.31 5.46l3.99-3.09Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.69c1.76 0 3.35.61 4.6 1.81l3.45-3.45C17.95 1.09 15.24 0 12 0A12 12 0 0 0 1.31 6.54L5.3 9.63A7.16 7.16 0 0 1 12 4.69Z"
            />
          </svg>
          Continuar com Google
        </button>

        <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          <span className="h-px flex-1 bg-[var(--border)]" />
          <span>ou</span>
          <span className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-amber)]"
              placeholder="teuemail@exemplo.com"
            />
          </label>

          <label className="block text-sm">
            Palavra-passe
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-amber)]"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={loading || submitting}
            className="w-full rounded-md bg-[var(--accent-amber)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'A entrar...' : 'Entrar com email'}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
          Não tem conta?{' '}
          <Link href="/auth/signup" className="underline underline-offset-2 hover:text-[var(--text-primary)]">Inscreva-se</Link>
        </p>

        <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
          <Link href="/" className="underline underline-offset-2 hover:text-[var(--text-primary)]">Voltar para a página inicial</Link>
        </p>
      </section>
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
