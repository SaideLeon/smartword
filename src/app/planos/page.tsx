'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sun, Moon, ArrowDown, ChevronRight } from 'lucide-react';
import { supabaseClient, useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';

const EXCHANGE_RATE = 64.05;

interface PlanRow {
  key: string;
  label: string;
  price_usd: number;
  price_mzn: number;
  works_limit: number | null;
  edits_limit: number | null;
  duration_months: number;
  tcc_enabled: boolean;
  ai_chat_enabled: boolean;
  cover_enabled: boolean;
  export_full: boolean;
}

function formatUsd(value: number) {
  return value === 0 ? '—' : `$${Number(value).toFixed(2)}`;
}

function PlanosNav({
  themeMode,
  onToggleTheme,
}: {
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)]/80 bg-[var(--navBg)]/90 px-4 py-3 backdrop-blur md:px-12 md:py-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex items-center justify-between md:justify-start md:gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">
              ∂
            </div>
            <span className="font-serif text-xl italic text-[var(--gold2)]">Muneri</span>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
              aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {themeMode === 'dark' ? (
                <>
                  <Sun size={11} /> Claro
                </>
              ) : (
                <>
                  <Moon size={11} /> Escuro
                </>
              )}
            </button>
            <Link
              href="/app"
              className="flex items-center gap-1 rounded bg-[var(--ink)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]"
            >
              <ArrowDown size={11} /> Abrir
            </Link>
          </div>
        </div>

        <ul className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] md:flex">
          <li>
            <Link href="/#features" className="hover:text-[var(--gold2)]">
              Vantagens
            </Link>
          </li>
          <li>
            <Link href="/#modos" className="hover:text-[var(--gold2)]">
              Para quem é
            </Link>
          </li>
          <li>
            <Link href="/#resultado" className="hover:text-[var(--gold2)]">
              Resultado final
            </Link>
          </li>
          <li>
            <Link href="/planos" className="text-[var(--gold2)]">
              Planos
            </Link>
          </li>
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
            aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {themeMode === 'dark' ? (
              <>
                <Sun size={12} /> Claro
              </>
            ) : (
              <>
                <Moon size={12} /> Escuro
              </>
            )}
          </button>
          <Link
            href="/app"
            className="flex items-center gap-1.5 rounded bg-[var(--ink)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]"
          >
            <ArrowDown size={12} /> Abrir app
          </Link>
        </div>

        {/* Mobile nav links */}
        <ul className="flex w-full items-center gap-5 overflow-x-auto pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] md:hidden">
          <li>
            <Link href="/#features" className="whitespace-nowrap hover:text-[var(--gold2)]">
              Vantagens
            </Link>
          </li>
          <li>
            <Link href="/#modos" className="whitespace-nowrap hover:text-[var(--gold2)]">
              Para quem é
            </Link>
          </li>
          <li>
            <Link href="/#resultado" className="whitespace-nowrap hover:text-[var(--gold2)]">
              Resultado final
            </Link>
          </li>
          <li>
            <Link href="/planos" className="whitespace-nowrap text-[var(--gold2)]">
              Planos
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default function PlanosPage() {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const { profile } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<
    Record<string, 'mpesa' | 'emola' | 'card'>
  >({});
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
  const [feedbackByPlan, setFeedbackByPlan] = useState<
    Record<string, { type: 'success' | 'error'; text: string }>
  >({});

  const themeVars =
    themeMode === 'dark'
      ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
      : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  useEffect(() => {
    async function loadPlans() {
      const { data } = await supabaseClient
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price_mzn', { ascending: true });
      setPlans((data as PlanRow[]) ?? []);
      setLoadingPlans(false);
    }
    void loadPlans();
  }, []);

  async function startPayment(plan: PlanRow) {
    const paymentMethod = paymentMethods[plan.key] ?? 'mpesa';

    setSubmittingPlan(plan.key);
    setFeedbackByPlan((prev) => {
      const updated = { ...prev };
      delete updated[plan.key];
      return updated;
    });

    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_key: plan.key,
          payment_method: paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao iniciar pagamento.');
      if (typeof data?.checkout_url !== 'string' || !data.checkout_url) {
        throw new Error('Link de checkout não recebido da PaySuite.');
      }

      setFeedbackByPlan((prev) => ({
        ...prev,
        [plan.key]: {
          type: 'success',
          text: 'Pedido criado. A redireccionar para o checkout seguro...',
        },
      }));
      window.location.assign(data.checkout_url);
    } catch (error: any) {
      setFeedbackByPlan((prev) => ({
        ...prev,
        [plan.key]: { type: 'error', text: error?.message || 'Erro inesperado ao iniciar pagamento.' },
      }));
    } finally {
      setSubmittingPlan(null);
    }
  }

  return (
    <main className={`${themeVars} min-h-screen bg-[var(--parchment)] text-[var(--ink)]`}>
      <PlanosNav themeMode={themeMode} onToggleTheme={toggleThemeMode} />

      {/* ── HERO ── */}
      <section className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-6 md:px-12 md:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--green)]">
          Muneri · Planos e preçário
        </p>
        <h1 className="mt-3 font-serif text-[1.9rem] leading-[1.2] sm:text-4xl md:text-5xl md:leading-tight lg:text-6xl">
          Escolha o plano certo para{' '}
          <em className="text-[var(--gold2)]">o seu trabalho académico.</em>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Plano actual:{' '}
          <span className="font-mono text-[var(--gold2)]">{profile?.plan_key || 'free'}</span>
          . Escolha o plano e finalize automaticamente via checkout PaySuite.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/app"
            className="flex items-center gap-1 border-b border-[var(--border)] pb-0.5 font-mono text-xs uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Voltar ao editor <ChevronRight size={12} />
          </Link>
        </div>
      </section>

      {/* ── TABELA DE PREÇOS ── */}
      <section className="border-y border-[var(--border)] bg-[var(--parchment)] px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <div className="mx-auto w-full max-w-7xl">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">
            Preçário
          </p>
          <h2 className="font-serif text-2xl leading-snug sm:text-3xl md:text-4xl lg:text-5xl">
            Todos os planos,{' '}
            <em className="text-[var(--gold2)]">preços e condições.</em>
          </h2>

          <div className="mt-8 overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--heroRight)]">
                  {['Plano', 'Preço (MZN)', 'USD referência', 'Cobrança', 'Chave'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#c8bfb4]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingPlans ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-6 font-mono text-[11px] text-[var(--faint)]"
                    >
                      A carregar planos…
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr
                      key={plan.key}
                      className="border-b border-[var(--border)]/70 transition hover:bg-[var(--border)]/20"
                    >
                      <td className="px-5 py-3 font-serif text-base">{plan.label}</td>
                      <td className="px-5 py-3 font-mono text-sm text-[var(--gold2)]">
                        {Number(plan.price_mzn).toLocaleString('pt-BR')} MZN
                      </td>
                      <td className="px-5 py-3 font-mono text-sm text-[var(--muted)]">
                        {formatUsd(plan.price_usd)}
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--muted)]">
                        {plan.duration_months > 0
                          ? `Mensal (${plan.duration_months} mês(es))`
                          : 'Por obra'}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-[var(--faint)]">
                        {plan.key}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-xl border border-[var(--border)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)]">
              Pressupostos
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-[var(--muted)]">
              <li>
                • Taxa de câmbio de referência:{' '}
                <span className="font-mono text-[var(--gold2)]">1 USD = {EXCHANGE_RATE} MZN</span>.
              </li>
              <li>• Valores em meticais foram arredondados para facilitar cobrança local.</li>
              <li>• O plano Avulso é cobrado por obra entregue.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── CARDS DOS PLANOS ── */}
      <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">
          Comprar
        </p>
        <h2 className="font-serif text-2xl leading-snug sm:text-3xl md:text-4xl lg:text-5xl">
          Adquira o plano e{' '}
          <em className="text-[var(--gold2)]">comece a criar agora.</em>
        </h2>

        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-[var(--border)] sm:grid-cols-2 md:grid-cols-3">
          {loadingPlans ? (
            <p className="col-span-3 p-8 font-mono text-[11px] text-[var(--faint)]">
              A carregar planos…
            </p>
          ) : (
            plans.map((plan) => (
              <article
                key={plan.key}
                className="space-y-4 bg-[var(--parchment)] p-6 sm:p-8"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-2xl">{plan.label}</h3>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
                      {plan.key}
                    </p>
                  </div>
                  <span className="rounded border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {plan.duration_months > 0 ? `${plan.duration_months} mês` : 'Avulso'}
                  </span>
                </div>

                {/* Price */}
                <div className="rounded-lg border border-[var(--border)] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
                    Preço
                  </p>
                  <p className="mt-1 font-serif text-3xl text-[var(--gold2)]">
                    {Number(plan.price_mzn).toLocaleString('pt-BR')}{' '}
                    <span className="text-xl">MZN</span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-[var(--faint)]">
                    USD referência: {formatUsd(plan.price_usd)}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-1 text-sm text-[var(--muted)]">
                  <li>
                    • Trabalhos:{' '}
                    <span className="text-[var(--ink)]">
                      {plan.works_limit ?? 'ilimitados'}
                    </span>
                  </li>
                  <li>
                    • Edições:{' '}
                    <span className="text-[var(--ink)]">
                      {plan.edits_limit ?? 'ilimitadas'}
                    </span>
                  </li>
                  <li>
                    • Exportação completa:{' '}
                    <span className={plan.export_full ? 'text-[var(--green)]' : 'text-[var(--faint)]'}>
                      {plan.export_full ? 'Sim' : 'Não'}
                    </span>
                  </li>
                  <li>
                    • Modo TCC:{' '}
                    <span className={plan.tcc_enabled ? 'text-[var(--green)]' : 'text-[var(--faint)]'}>
                      {plan.tcc_enabled ? 'Sim' : 'Não'}
                    </span>
                  </li>
                  <li>
                    • IA Chat:{' '}
                    <span className={plan.ai_chat_enabled ? 'text-[var(--green)]' : 'text-[var(--faint)]'}>
                      {plan.ai_chat_enabled ? 'Sim' : 'Não'}
                    </span>
                  </li>
                  <li>
                    • Capa automática:{' '}
                    <span className={plan.cover_enabled ? 'text-[var(--green)]' : 'text-[var(--faint)]'}>
                      {plan.cover_enabled ? 'Sim' : 'Não'}
                    </span>
                  </li>
                </ul>

                {/* Payment form */}
                <div className="space-y-3 border-t border-[var(--border)] pt-4">
                  <div>
                    <label
                      htmlFor={`payment-method-${plan.key}`}
                      className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]"
                    >
                      Método de pagamento
                    </label>
                    <select
                      id={`payment-method-${plan.key}`}
                      value={paymentMethods[plan.key] ?? 'mpesa'}
                      onChange={(e) =>
                        setPaymentMethods((prev) => ({
                          ...prev,
                          [plan.key]: e.target.value as 'mpesa' | 'emola' | 'card',
                        }))
                      }
                      className="mt-1.5 w-full rounded border border-[var(--border)] bg-[var(--parchment)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]"
                    >
                      <option value="mpesa">M-Pesa</option>
                      <option value="emola">e-Mola</option>
                      <option value="card">Cartão</option>
                    </select>
                  </div>
                </div>

                {/* Feedback */}
                {feedbackByPlan[plan.key] && (
                  <div
                    className={`rounded border px-3 py-2 font-mono text-[11px] ${
                      feedbackByPlan[plan.key].type === 'success'
                        ? 'border-[var(--green)]/40 bg-[var(--green)]/10 text-[var(--green)]'
                        : 'border-red-500/40 bg-red-500/10 text-red-400'
                    }`}
                  >
                    {feedbackByPlan[plan.key].text}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="button"
                  onClick={() => startPayment(plan)}
                  disabled={submittingPlan === plan.key}
                  className="flex w-full items-center justify-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-5 py-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink)] shadow transition hover:opacity-90 disabled:opacity-50"
                >
                  <ArrowDown size={13} />
                  {submittingPlan === plan.key ? 'A iniciar…' : `Pagar ${plan.label}`}
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="border-y border-[var(--border)] px-5 py-12 text-center sm:px-6 md:px-12 md:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">
          Começa agora
        </p>
        <h2 className="mt-4 font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
          O teu próximo documento{' '}
          <em className="text-[var(--gold2)]">começa aqui.</em>
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Grátis. Simples. Feito para quem quer terminar o trabalho com tranquilidade.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/app"
            className="flex items-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-7 py-3 font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--ink)] sm:px-8 sm:py-[14px]"
          >
            <ArrowDown size={14} /> Começar agora — é grátis
          </Link>
        </div>
        <p className="mt-8 font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
          Muneri · Trabalhos acadêmicos automáticos · Quelimane, Moçambique
        </p>
      </section>

      <footer className="flex flex-col gap-2 px-5 py-6 text-center sm:px-6 md:flex-row md:items-center md:justify-between md:px-12 md:text-left">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
          Muneri · Gerador automático de trabalhos académicos · 2026
        </div>
        <div className="text-sm italic text-[var(--faint)]">feito com ∂ em Quelimane, Moçambique</div>
      </footer>
    </main>
  );
}
