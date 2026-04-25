'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useThemeMode } from '@/hooks/useThemeMode';

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'user' | 'admin';
};

export default function AdminPremiumLinksPage() {
  const { themeMode } = useThemeMode();
  const dark = themeMode === 'dark';

  const themeVars = dark
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--surface:#141210] [--surface2:#1a1714] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--border:#2c2721] [--ok:#6ea886] [--danger:#f87171]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--surface:#ece8df] [--surface2:#e5e0d5] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#a09585] [--border:#d8ceb8] [--ok:#4a7c59] [--danger:#b91c1c]';

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [emailSubject, setEmailSubject] = useState('Muneri · Link de acesso Premium');
  const [emailBody, setEmailBody] = useState('Olá! Usa este link para ativar o teu acesso premium no Muneri:');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

        const rows = Array.isArray(data) ? (data as AdminUser[]) : [];
        setUsers(rows);
      } catch {
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const handleCreate = async () => {
    if (!selectedUserId) {
      setIsError(true);
      setMessage('Seleccione um utilizador pelo e-mail.');
      return;
    }

    setLoading(true);
    setMessage('');
    setGeneratedLink('');

    try {
      const payload = {
        target_user_id: selectedUserId,
        max_uses: maxUses,
        expires_at: expiresAt.trim() ? new Date(expiresAt).toISOString() : null,
        email_subject: emailSubject,
        email_body: emailBody,
      };

      const res = await fetch('/api/admin/premium-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setIsError(false);
      setMessage(`Link premium criado e enviado por e-mail para ${data?.target_user_email ?? 'o utilizador'}.`);
      setGeneratedLink(data.redeem_link ?? '');
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message ?? 'Não foi possível gerar/enviar o link premium.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`${themeVars} min-h-screen bg-[var(--parchment)] text-[var(--ink)]`}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Muneri · Administração</p>
              <h1 className="mt-1.5 font-serif text-2xl sm:text-3xl">Gerar links <em className="text-[var(--gold2)]">premium</em></h1>
              <p className="mt-1 text-sm text-[var(--muted)]">Filtre por e-mail, selecione o utilizador e envie o link premium automaticamente.</p>
            </div>
            <Link href="/admin" className="rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]">← Painel</Link>
          </div>
        </header>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="grid gap-4">
            <label>
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">Filtrar utilizadores por e-mail</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" placeholder="ex: aluno@universidade.edu" />
            </label>

            <label>
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">Seleccionar utilizador</span>
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]">
                <option value="">{loadingUsers ? 'A carregar utilizadores...' : 'Seleccione um utilizador'}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {(user.email ?? 'Sem e-mail')} · {(user.full_name ?? 'Sem nome')} · {user.id}
                  </option>
                ))}
              </select>
            </label>

            {selectedUser && (
              <p className="rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[11px] text-[var(--muted)]">
                Utilizador escolhido: <strong>{selectedUser.email ?? 'Sem e-mail'}</strong> ({selectedUser.id})
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">Expiração (opcional)</span>
                <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" />
              </label>

              <label>
                <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">Máx. utilizações</span>
                <input type="number" min={1} max={10} value={maxUses} onChange={(e) => setMaxUses(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" />
              </label>
            </div>

            <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" placeholder="Assunto do e-mail" />
            <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={3} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" />

            <button onClick={handleCreate} disabled={loading} className="mt-1 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-black disabled:opacity-60">
              {loading ? 'A gerar e enviar...' : 'Gerar e enviar link premium'}
            </button>
          </div>
        </section>

        {message && (
          <section className={`rounded-lg border px-4 py-3 font-mono text-[11px] ${isError ? 'border-[var(--danger)]/40 text-[var(--danger)]' : 'border-[var(--ok)]/40 text-[var(--ok)]'}`}>
            {message}
          </section>
        )}

        {generatedLink && (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">Link gerado</p>
            <p className="mt-2 break-all rounded border border-[var(--border)] bg-[var(--surface2)] p-3 font-mono text-[12px]">{generatedLink}</p>
          </section>
        )}
      </div>
    </main>
  );
}
