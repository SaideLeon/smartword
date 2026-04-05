'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProcessingBars } from '@/components/ProcessingBars';

export default function SignupPage() {
  const router = useRouter();
  const { isLoggedIn, signUp, loading, error } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4 text-[var(--text-primary)]" data-theme="dark">
      <section className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl">
        <p className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Muneri</p>
        <h1 className="mt-1 text-2xl font-semibold">Inscrição</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Crie a sua conta para começar.</p>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm">
            Nome completo
            <input
              type="text"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-amber)]"
              placeholder="Seu nome"
            />
          </label>

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
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-amber)]"
              placeholder="••••••••"
            />
          </label>

          <label className="block text-sm">
            Confirmar palavra-passe
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-amber)]"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={loading || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent-amber)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <ProcessingBars height={14} />
                A criar conta...
              </>
            ) : 'Criar conta'}
          </button>
        </form>

        {localError && <p className="mt-3 text-sm text-red-400">{localError}</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {successMessage && <p className="mt-3 text-sm text-emerald-400">{successMessage}</p>}

        <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
          Já tem conta?{' '}
          <Link href="/auth/login" className="underline underline-offset-2 hover:text-[var(--text-primary)]">Entrar</Link>
        </p>

        <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
          <Link href="/" className="underline underline-offset-2 hover:text-[var(--text-primary)]">Voltar para a página inicial</Link>
        </p>
      </section>
    </main>
  );
}
