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

        <button
          type="button"
          onClick={() => signInGoogle()}
          disabled={loading || submitting}
          className="mt-3 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm transition hover:bg-[var(--bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continuar com Google
        </button>

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
