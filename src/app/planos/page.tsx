/* eslint-disable react/no-array-index-key */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabaseClient, useAuth } from '@/hooks/useAuth';

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

export default function PlanosPage() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [transactionIds, setTransactionIds] = useState<Record<string, string>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<string, 'bank_transfer' | 'mpesa' | 'emola' | 'card'>>({});
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
  const [feedbackByPlan, setFeedbackByPlan] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  useEffect(() => {
    async function loadPlans() {
      const { data } = await supabaseClient.from('plans').select('*').eq('is_active', true).order('price_mzn', { ascending: true });
      setPlans((data as PlanRow[]) ?? []);
      setLoadingPlans(false);
    }

    void loadPlans();
  }, []);

  async function submitTransactionProof(plan: PlanRow) {
    const transactionId = transactionIds[plan.key] ?? '';
    const paymentMethod = paymentMethods[plan.key] ?? 'bank_transfer';

    if (!transactionId.trim()) {
      setFeedbackByPlan((previous) => ({
        ...previous,
        [plan.key]: { type: 'error', text: 'Insira o ID de confirmação da transação.' },
      }));
      return;
    }

    setSubmittingPlan(plan.key);
    setFeedbackByPlan((previous) => {
      const updated = { ...previous };
      delete updated[plan.key];
      return updated;
    });

    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_key: plan.key,
          transaction_id: transactionId.trim(),
          amount_mzn: plan.price_mzn,
          payment_method: paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao registar comprovativo.');
      }

      setFeedbackByPlan((previous) => ({
        ...previous,
        [plan.key]: {
          type: 'success',
          text: 'Pedido enviado e pendente de validação do administrador.',
        },
      }));
      setTransactionIds((previous) => ({ ...previous, [plan.key]: '' }));
    } catch (error: any) {
      setFeedbackByPlan((previous) => ({
        ...previous,
        [plan.key]: { type: 'error', text: error?.message || 'Erro inesperado ao enviar comprovativo.' },
      }));
    } finally {
      setSubmittingPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-4 py-10 text-[var(--text-primary)]" data-theme="dark">
      <section className="mx-auto w-full max-w-6xl">
        <header className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <p className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Muneri · Precificação SaaS</p>
          <h1 className="mt-2 text-3xl font-semibold">Preçário completo dos planos</h1>
          <p className="mt-3 max-w-3xl text-sm text-[var(--text-muted)]">
            Escolha o plano, informe o ID da transação e envie para validação manual do administrador.
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Plano actual: <strong>{profile?.plan_key || 'free'}</strong>
          </p>
          <Link href="/app" className="mt-4 inline-block rounded-md border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--bg-card)]">
            Voltar ao editor
          </Link>
        </header>

        <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <h2 className="text-lg font-semibold">Tabela de preços (preçário)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <th className="px-3 py-2 font-medium">Plano</th>
                  <th className="px-3 py-2 font-medium">Preço (MZN)</th>
                  <th className="px-3 py-2 font-medium">USD referência</th>
                  <th className="px-3 py-2 font-medium">Cobrança</th>
                  <th className="px-3 py-2 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.key} className="border-b border-[var(--border)]/70">
                    <td className="px-3 py-3 font-medium">{plan.label}</td>
                    <td className="px-3 py-3">{Number(plan.price_mzn).toLocaleString('pt-BR')} MZN</td>
                    <td className="px-3 py-3">{formatUsd(plan.price_usd)}</td>
                    <td className="px-3 py-3">{plan.duration_months > 0 ? `Mensal (${plan.duration_months} mês(es))` : 'Por obra'}</td>
                    <td className="px-3 py-3 text-[var(--text-muted)]">{plan.key}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <h2 className="text-lg font-semibold">Pressupostos usados na precificação</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            <li>• Taxa de câmbio de referência: <strong>1 USD = {EXCHANGE_RATE} MZN</strong>.</li>
            <li>• Valores em meticais foram arredondados para facilitar cobrança local.</li>
            <li>• O plano Avulso permanece como cobrança por obra.</li>
          </ul>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loadingPlans ? (
            <p className="text-sm text-[var(--text-muted)]">A carregar planos...</p>
          ) : (
            plans.map((plan) => (
              <article key={plan.key} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{plan.label}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{plan.key}</p>
                  </div>
                  <span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]">
                    {plan.duration_months > 0 ? `${plan.duration_months} mês(es)` : 'Avulso'}
                  </span>
                </div>

                <div className="mt-4 rounded-lg bg-[var(--bg-card)] p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Preço</p>
                  <p className="mt-1 text-2xl font-semibold">{Number(plan.price_mzn).toLocaleString('pt-BR')} MZN</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">USD referência: {formatUsd(plan.price_usd)}</p>
                </div>

                <ul className="mt-4 space-y-1.5 text-sm text-[var(--text-secondary)]">
                  <li>• Trabalhos: {plan.works_limit ?? 'ilimitados'}</li>
                  <li>• Edições: {plan.edits_limit ?? 'ilimitadas'}</li>
                  <li>• Exportação completa: {plan.export_full ? 'Sim' : 'Não'}</li>
                  <li>• Modo TCC: {plan.tcc_enabled ? 'Sim' : 'Não'}</li>
                  <li>• IA Chat: {plan.ai_chat_enabled ? 'Sim' : 'Não'}</li>
                  <li>• Capa automática: {plan.cover_enabled ? 'Sim' : 'Não'}</li>
                </ul>

                <label className="mt-4 block text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">ID da transação</label>
                <input
                  id={`transaction-id-${plan.key}`}
                  value={transactionIds[plan.key] ?? ''}
                  onChange={(event) => setTransactionIds((previous) => ({ ...previous, [plan.key]: event.target.value }))}
                  placeholder={`Ex: ${plan.key.toUpperCase()}-TRX-000123`}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--text-primary)]"
                />

                <label className="mt-3 block text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Método de pagamento</label>
                <select
                  value={paymentMethods[plan.key] ?? 'bank_transfer'}
                  onChange={(event) => setPaymentMethods((previous) => ({ ...previous, [plan.key]: event.target.value as 'bank_transfer' | 'mpesa' | 'emola' | 'card' }))}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--text-primary)]"
                >
                  <option value="bank_transfer">Transferência bancária</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="emola">e-Mola</option>
                  <option value="card">Cartão</option>
                </select>

                {feedbackByPlan[plan.key] && (
                  <div
                    className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                      feedbackByPlan[plan.key].type === 'success'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-red-500/50 bg-red-500/10 text-red-300'
                    }`}
                  >
                    {feedbackByPlan[plan.key].text}
                  </div>
                )}

                <button
                  id={`submit-plan-${plan.key}`}
                  type="button"
                  onClick={() => submitTransactionProof(plan)}
                  disabled={submittingPlan === plan.key}
                  className="mt-4 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--bg-base)] disabled:opacity-70"
                >
                  {submittingPlan === plan.key ? 'A enviar...' : `Comprar plano ${plan.label}`}
                </button>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
