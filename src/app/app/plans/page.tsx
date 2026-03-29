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
  const [selectedPlan, setSelectedPlan] = useState<PlanRow | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'mpesa' | 'emola' | 'card'>('bank_transfer');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  function openPaymentModal(plan: PlanRow) {
    setSelectedPlan(plan);
    setTransactionId('');
    setPaymentMethod('bank_transfer');
    setFeedback(null);
  }

  function closePaymentModal() {
    if (submitting) return;
    setSelectedPlan(null);
    setTransactionId('');
    setFeedback(null);
  }

  async function submitTransactionProof() {
    if (!selectedPlan) return;
    if (!transactionId.trim()) {
      setFeedback({ type: 'error', text: 'Insira o ID da transação para continuar.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_key: selectedPlan.key,
          transaction_id: transactionId.trim(),
          amount_mzn: selectedPlan.price_mzn,
          payment_method: paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível registar o comprovativo.');
      }

      setFeedback({
        type: 'success',
        text: 'Comprovativo enviado. O administrador irá comparar o ID da transação e aprovar manualmente o plano.',
      });
      setTransactionId('');
      setTimeout(() => {
        setSelectedPlan(null);
        setFeedback(null);
      }, 1400);
    } catch (error: any) {
      setFeedback({ type: 'error', text: error?.message || 'Ocorreu um erro inesperado.' });
    } finally {
      setSubmitting(false);
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
                <button
                  type="button"
                  onClick={() => openPaymentModal(plan)}
                  className="mt-4 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--bg-base)]"
                >
                  Enviar ID de transação
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Comprovativo de pagamento</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Plano: <strong>{selectedPlan.label}</strong> · {selectedPlan.price_mzn} MZN
              </p>
            </div>

            <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">ID da transação</label>
            <input
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Ex: TRX-2026-000123"
              className="mb-3 w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--text-primary)]"
            />

            <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Método de pagamento</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'bank_transfer' | 'mpesa' | 'emola' | 'card')}
              className="mb-3 w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-[var(--text-primary)]"
            >
              <option value="bank_transfer">Transferência bancária</option>
              <option value="mpesa">M-Pesa</option>
              <option value="emola">e-Mola</option>
              <option value="card">Cartão</option>
            </select>

            <p className="mb-3 text-xs text-[var(--text-muted)]">
              O administrador vai comparar este ID com o recebido na notificação bancária e, se coincidir, aprovar o plano manualmente.
            </p>

            {feedback && (
              <div
                className={`mb-3 rounded-md border px-3 py-2 text-xs ${
                  feedback.type === 'success'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/50 bg-red-500/10 text-red-300'
                }`}
              >
                {feedback.text}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closePaymentModal}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--bg-card)]"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitTransactionProof}
                className="rounded-md bg-[var(--text-primary)] px-3 py-2 text-sm text-[var(--bg-base)] transition disabled:opacity-70"
                disabled={submitting}
              >
                {submitting ? 'A enviar...' : 'Enviar para aprovação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
