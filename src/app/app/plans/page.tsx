'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabaseClient, useAuth } from '@/hooks/useAuth';

interface PlanRow {
  key: string;
  label: string;
  price_mzn: number;
  works_limit: number | null;
  edits_limit: number | null;
  duration_months: number;
  tcc_enabled: boolean;
  ai_chat_enabled: boolean;
  cover_enabled: boolean;
  export_full: boolean;
}

export default function PlansPage() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionIds, setTransactionIds] = useState<Record<string, string>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<string, 'bank_transfer' | 'mpesa' | 'emola' | 'card'>>({});
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
  const [feedbackByPlan, setFeedbackByPlan] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  useEffect(() => {
    async function loadPlans() {
      const { data } = await supabaseClient
        .from('plans')
        .select('*')
        .order('price_mzn', { ascending: true });

      setPlans((data as PlanRow[]) ?? []);
      setLoading(false);
    }

    loadPlans();
  }, []);

  async function submitTransactionProof(plan: PlanRow) {
    const transactionId = transactionIds[plan.key] ?? '';
    const paymentMethod = paymentMethods[plan.key] ?? 'bank_transfer';

    if (!transactionId.trim()) {
      setFeedbackByPlan((previous) => ({
        ...previous,
        [plan.key]: { type: 'error', text: 'Insira o ID da transação para continuar.' },
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
        throw new Error(data?.error || 'Não foi possível registar o comprovativo.');
      }

      setFeedbackByPlan((previous) => ({
        ...previous,
        [plan.key]: {
          type: 'success',
          text: 'Comprovativo enviado. O administrador irá comparar o ID da transação e aprovar manualmente o plano.',
        },
      }));
      setTransactionIds((previous) => ({ ...previous, [plan.key]: '' }));
    } catch (error: any) {
      setFeedbackByPlan((previous) => ({
        ...previous,
        [plan.key]: { type: 'error', text: error?.message || 'Ocorreu um erro inesperado.' },
      }));
    } finally {
      setSubmittingPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-4 py-8 text-[var(--text-primary)]" data-theme="dark">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Muneri</p>
            <h1 className="text-2xl font-semibold">Planos da plataforma</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Plano actual: <strong>{profile?.plan_key || 'free'}</strong>
            </p>
          </div>
          <Link href="/app" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--bg-card)]">
            Voltar ao editor
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">A carregar planos...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.key} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold">{plan.label}</h2>
                  <p className="text-sm text-[var(--text-muted)]">{plan.price_mzn} MZN</p>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Duração: {plan.duration_months > 0 ? `${plan.duration_months} mês(es)` : 'sem validade'}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
                  <li>• Trabalhos: {plan.works_limit ?? 'ilimitados'}</li>
                  <li>• Edições: {plan.edits_limit ?? 'ilimitadas'}</li>
                  <li>• Exportação completa: {plan.export_full ? 'Sim' : 'Não'}</li>
                  <li>• Modo TCC: {plan.tcc_enabled ? 'Sim' : 'Não'}</li>
                  <li>• IA chat: {plan.ai_chat_enabled ? 'Sim' : 'Não'}</li>
                  <li>• Capa automática: {plan.cover_enabled ? 'Sim' : 'Não'}</li>
                </ul>

                <label className="mt-4 block text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  ID da transação
                </label>
                <input
                  id={`transaction-id-${plan.key}`}
                  value={transactionIds[plan.key] ?? ''}
                  onChange={(e) => setTransactionIds((previous) => ({ ...previous, [plan.key]: e.target.value }))}
                  placeholder={`Ex: ${plan.key.toUpperCase()}-TRX-000123`}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--text-primary)]"
                />

                <label className="mt-3 block text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Método de pagamento
                </label>
                <select
                  value={paymentMethods[plan.key] ?? 'bank_transfer'}
                  onChange={(e) => setPaymentMethods((previous) => ({ ...previous, [plan.key]: e.target.value as 'bank_transfer' | 'mpesa' | 'emola' | 'card' }))}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--text-primary)]"
                >
                  <option value="bank_transfer">Transferência bancária</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="emola">e-Mola</option>
                  <option value="card">Cartão</option>
                </select>

                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Depois do envio, o comprovativo fica pendente até validação manual do administrador.
                </p>

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
                  className="mt-4 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--bg-base)]"
                >
                  {submittingPlan === plan.key ? 'A enviar...' : `Comprar plano ${plan.label}`}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
