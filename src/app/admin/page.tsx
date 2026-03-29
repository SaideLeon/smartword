'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseClient } from '@/hooks/useAuth';

type AdminTab = 'payments' | 'expenses' | 'report';

type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

interface Payment {
  id: string;
  user_id: string;
  created_at: string;
  plan_key: string;
  transaction_id: string;
  amount_mzn: number;
  payment_method: string;
  status: PaymentStatus;
  profiles: { email: string; full_name: string } | null;
  plans: { label: string; price_mzn: number } | null;
}

interface ExpenseItem {
  id: string;
  category: string;
  description: string;
  amount_mzn: number;
  period_month: number;
  period_year: number;
}

interface Report {
  period_month: number;
  period_year: number;
  total_subscribers: number;
  active_subscribers: number;
  revenue_mzn: number;
  total_expenses_mzn: number;
  net_margin_mzn: number;
  margin_pct: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  groq_api: 'API Groq',
  supabase: 'Supabase',
  hosting: 'Hosting / Vercel',
  domain: 'Domínio',
  other: 'Outros',
};

const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-PT', { month: 'long' });

const toCurrency = (value: number) =>
  `${Math.round(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} MT`;

export default function AdminPage() {
  const today = new Date();
  const [tab, setTab] = useState<AdminTab>('payments');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [expForm, setExpForm] = useState({
    category: 'groq_api',
    description: '',
    amount_mzn: '',
    period_month: today.getMonth() + 1,
    period_year: today.getFullYear(),
  });

  const totalExpenses = useMemo(() => expenses.reduce((total, item) => total + item.amount_mzn, 0), [expenses]);

  const flash = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3200);
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payment');
      const data = await response.json();
      setPayments(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    const { data } = await supabaseClient.from('expense_items').select('*').order('created_at', { ascending: false });
    setExpenses((data as ExpenseItem[]) ?? []);
  }, []);

  const loadReport = useCallback(async (month: number, year: number) => {
    const { data } = await supabaseClient
      .from('monthly_reports')
      .select('*')
      .eq('period_month', month)
      .eq('period_year', year)
      .single();

    setReport((data as Report) ?? null);
  }, []);

  useEffect(() => {
    if (tab === 'payments') {
      void loadPayments();
      return;
    }

    if (tab === 'expenses') {
      void loadExpenses();
      return;
    }

    void loadExpenses();
    void loadReport(expForm.period_month, expForm.period_year);
  }, [expForm.period_month, expForm.period_year, loadExpenses, loadPayments, loadReport, tab]);

  const handlePaymentAction = async (paymentId: string, action: 'confirm' | 'reject') => {
    const response = await fetch('/api/payment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId, action }),
    });

    if (!response.ok) {
      flash('Erro ao processar pagamento.');
      return;
    }

    flash(action === 'confirm' ? 'Pagamento confirmado com sucesso.' : 'Pagamento rejeitado.');
    void loadPayments();
  };

  const handleAddExpense = async () => {
    if (!expForm.description || !expForm.amount_mzn) {
      flash('Preenche descrição e valor da despesa.');
      return;
    }

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      flash('Sessão inválida. Faça login novamente.');
      return;
    }

    const { error } = await supabaseClient.from('expense_items').insert({
      created_by: user.id,
      category: expForm.category,
      description: expForm.description,
      amount_mzn: Number(expForm.amount_mzn),
      period_month: expForm.period_month,
      period_year: expForm.period_year,
    });

    if (error) {
      flash('Não foi possível registar a despesa.');
      return;
    }

    flash('Despesa adicionada.');
    setExpForm((previous) => ({ ...previous, description: '', amount_mzn: '' }));
    void loadExpenses();
  };

  const handleGenerateReport = async () => {
    const { error } = await supabaseClient.rpc('generate_monthly_report', {
      p_month: expForm.period_month,
      p_year: expForm.period_year,
      p_rate: 64.05,
    });

    if (error) {
      flash('Falha ao gerar relatório.');
      return;
    }

    flash('Relatório mensal gerado.');
    void loadReport(expForm.period_month, expForm.period_year);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 text-[var(--text-primary)] sm:px-6">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <h1 className="text-xl font-semibold">Painel administrativo</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Acompanhe pagamentos, custos operacionais e margem mensal da plataforma.</p>
      </header>

      {message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">{message}</div>
      )}

      <nav className="flex flex-wrap gap-2">
        {([
          { key: 'payments', label: 'Pagamentos' },
          { key: 'expenses', label: 'Despesas' },
          { key: 'report', label: 'Relatório' },
        ] as const).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              tab === item.key
                ? 'border-transparent bg-[var(--text-primary)] text-[var(--bg-base)]'
                : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'payments' && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="mb-4 text-sm text-[var(--text-secondary)]">Pagamentos pendentes aguardando validação manual da equipe.</p>

          {loading && <p className="text-sm text-[var(--text-tertiary)]">A carregar pagamentos...</p>}

          <div className="space-y-3">
            {payments.map((payment) => (
              <article key={payment.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">{payment.profiles?.full_name ?? 'Utilizador'}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">{payment.profiles?.email ?? 'Sem e-mail'}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Plano <strong>{payment.plans?.label ?? payment.plan_key}</strong> · {toCurrency(payment.amount_mzn)} ·{' '}
                      {payment.payment_method.toUpperCase()}
                    </p>
                    <p className="mono text-[11px] text-[var(--text-tertiary)]">Transação: {payment.transaction_id}</p>
                  </div>

                  {payment.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handlePaymentAction(payment.id, 'confirm')}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentAction(payment.id, 'reject')}
                        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10"
                      >
                        Rejeitar
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        payment.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {payment.status === 'confirmed' ? 'Confirmado' : 'Rejeitado'}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>

          {!loading && payments.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">Nenhum pagamento registado.</p>
          )}
        </section>
      )}

      {tab === 'expenses' && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="mb-4 text-sm text-[var(--text-secondary)]">Registre custos mensais para acompanhar o resultado financeiro da operação.</p>

          <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto_auto]">
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Categoria</span>
              <select
                value={expForm.category}
                onChange={(event) => setExpForm((previous) => ({ ...previous, category: event.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                {Object.entries(CATEGORY_LABELS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Descrição</span>
              <input
                type="text"
                value={expForm.description}
                onChange={(event) => setExpForm((previous) => ({ ...previous, description: event.target.value }))}
                placeholder="Ex: API Groq — Março"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>

            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Valor (MT)</span>
              <input
                type="number"
                min="0"
                value={expForm.amount_mzn}
                onChange={(event) => setExpForm((previous) => ({ ...previous, amount_mzn: event.target.value }))}
                className="mono w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>

            <button
              type="button"
              onClick={handleAddExpense}
              className="self-end rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)]"
            >
              Adicionar
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {expenses.map((expense) => (
              <article key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                    {CATEGORY_LABELS[expense.category] ?? expense.category}
                  </span>
                  <span className="text-sm">{expense.description}</span>
                </div>
                <span className="mono text-sm text-rose-300">-{toCurrency(expense.amount_mzn)}</span>
              </article>
            ))}
          </div>

          {expenses.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
              <strong className="text-sm">Total de despesas</strong>
              <strong className="mono text-base text-rose-300">-{toCurrency(totalExpenses)}</strong>
            </div>
          )}
        </section>
      )}

      {tab === 'report' && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Mês</span>
              <select
                value={expForm.period_month}
                onChange={(event) => setExpForm((previous) => ({ ...previous, period_month: Number(event.target.value) }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, index) => {
                  const monthNumber = index + 1;
                  return (
                    <option key={monthNumber} value={monthNumber}>
                      {MONTH_FORMATTER.format(new Date(expForm.period_year, index))}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Ano</span>
              <input
                type="number"
                value={expForm.period_year}
                onChange={(event) => setExpForm((previous) => ({ ...previous, period_year: Number(event.target.value) }))}
                className="mono w-28 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm"
              />
            </label>

            <button
              type="button"
              onClick={handleGenerateReport}
              className="rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)]"
            >
              Gerar relatório
            </button>
          </div>

          {report ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Utilizadores totais', value: report.total_subscribers.toString(), tone: 'text-sky-300' },
                { label: 'Assinantes ativos', value: report.active_subscribers.toString(), tone: 'text-emerald-300' },
                { label: 'Receita bruta', value: toCurrency(report.revenue_mzn), tone: 'text-emerald-300' },
                { label: 'Despesas totais', value: toCurrency(report.total_expenses_mzn), tone: 'text-rose-300' },
                {
                  label: 'Lucro líquido',
                  value: toCurrency(report.net_margin_mzn),
                  tone: report.net_margin_mzn >= 0 ? 'text-emerald-300' : 'text-rose-300',
                },
                {
                  label: 'Margem',
                  value: `${report.margin_pct.toFixed(1)}%`,
                  tone: report.margin_pct >= 50 ? 'text-emerald-300' : 'text-amber-300',
                },
              ].map((item) => (
                <article key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">{item.label}</p>
                  <p className={`mono mt-2 text-xl font-semibold ${item.tone}`}>{item.value}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">Selecione o período e clique em “Gerar relatório”.</p>
          )}
        </section>
      )}
    </main>
  );
}
