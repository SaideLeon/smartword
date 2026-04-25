'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useThemeMode } from '@/hooks/useThemeMode';

export default function AdminPremiumLinksPage() {
  const { themeMode } = useThemeMode();
  const dark = themeMode === 'dark';

  const themeVars = dark
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--surface:#141210] [--surface2:#1a1714] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--border:#2c2721] [--ok:#6ea886] [--danger:#f87171]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--surface:#ece8df] [--surface2:#e5e0d5] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#a09585] [--border:#d8ceb8] [--ok:#4a7c59] [--danger:#b91c1c]';

  const [targetUserId, setTargetUserId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [sendEmail, setSendEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('Muneri · Link de acesso Premium');
  const [emailBody, setEmailBody] = useState('Olá! Usa este link para ativar o teu acesso premium no Muneri:');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const handleCreate = async () => {
    if (!targetUserId.trim()) {
      setIsError(true);
      setMessage('Informe o UUID do utilizador alvo.');
      return;
    }

    setLoading(true);
    setMessage('');
    setGeneratedLink('');

    try {
      const payload = {
        target_user_id: targetUserId.trim(),
        max_uses: maxUses,
        expires_at: expiresAt.trim() ? new Date(expiresAt).toISOString() : null,
        send_email: sendEmail,
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
      setMessage('Link premium criado com sucesso.');
      setGeneratedLink(data.redeem_link ?? '');
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message ?? 'Não foi possível gerar o link premium.');
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
              <p className="mt-1 text-sm text-[var(--muted)]">Cria um link seguro para ativar premium para um utilizador específico (sem privilégios admin).</p>
            </div>
            <Link href="/admin" className="rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]">← Painel</Link>
          </div>
        </header>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">UUID do utilizador</span>
              <input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </label>

            <label>
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">Expiração (opcional)</span>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" />
            </label>

            <label>
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">Máx. utilizações</span>
              <input type="number" min={1} max={10} value={maxUses} onChange={(e) => setMaxUses(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" />
            </label>
          </div>

          <label className="mt-4 flex items-center gap-2 font-mono text-[12px] text-[var(--muted)]">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Enviar o link por e-mail automaticamente
          </label>

          {sendEmail && (
            <div className="mt-3 grid gap-3">
              <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" placeholder="Assunto do e-mail" />
              <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={3} className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px]" />
            </div>
          )}

          <button onClick={handleCreate} disabled={loading} className="mt-4 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-black disabled:opacity-60">
            {loading ? 'A gerar...' : 'Gerar link premium'}
          </button>
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
