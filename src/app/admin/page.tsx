'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseClient } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';

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
  groq_api:  'API Groq',
  supabase:  'Supabase',
  hosting:   'Hosting / Vercel',
  domain:    'Domínio',
  other:     'Outros',
};

const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-PT', { month: 'long' });

const toCurrency = (value: number) =>
  `${Math.round(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} MT`;

export default function AdminPage() {
  const today = new Date();
  const { themeMode } = useThemeMode();

  const themeVars =
    themeMode === 'dark'
      ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
      : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  const [tab, setTab] = useState<AdminTab>('payments');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [expForm, setExpForm] = useState({
    category:     'groq_api',
    description:  '',
    amount_mzn:   '',
    period_month: today.getMonth() + 1,
    period_year:  today.getFullYear(),
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const totalExpenses   = useMemo(() => expenses.reduce((t, i) => t + i.amount_mzn, 0), [expenses]);
  const pendingPayments = useMemo(() => payments.filter(p => p.status === 'pending'), [payments]);

  const flash = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3200);
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const res  = await fetch('/api/payment');
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Erro ao carregar pagamentos: ${data?.error ?? `HTTP ${res.status}`}`);
        setPayments([]);
        return;
      }
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setMessage('Falha de rede ao carregar pagamentos.');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    const { data } = await supabaseClient
      .from('expense_items')
      .select('*')
      .order('created_at', { ascending: false });
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
    if (tab === 'payments') { void loadPayments(); return; }
    if (tab === 'expenses') { void loadExpenses(); return; }
    void loadExpenses();
    void loadReport(expForm.period_month, expForm.period_year);
  }, [expForm.period_month, expForm.period_year, loadExpenses, loadPayments, loadReport, tab]);

  const handlePaymentAction = async (paymentId: string, action: 'confirm' | 'reject') => {
    const res = await fetch('/api/payment', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ payment_id: paymentId, action }),
    });
    if (!res.ok) { flash('Erro ao processar pagamento.'); return; }
    flash(action === 'confirm' ? 'Pagamento confirmado com sucesso.' : 'Pagamento rejeitado.');
    void loadPayments();
  };

  const resetExpenseForm = () => {
    setExpForm(p => ({ ...p, category: 'groq_api', description: '', amount_mzn: '' }));
    setEditingExpenseId(null);
  };

  const handleSaveExpense = async () => {
    if (!expForm.description || !expForm.amount_mzn) {
      flash('Preenche descrição e valor da despesa.');
      return;
    }
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { flash('Sessão inválida. Faça login novamente.'); return; }

    const payload = {
      category:     expForm.category,
      description:  expForm.description.trim(),
      amount_mzn:   Number(expForm.amount_mzn),
      period_month: expForm.period_month,
      period_year:  expForm.period_year,
    };

    const { error } = editingExpenseId
      ? await supabaseClient.from('expense_items').update(payload).eq('id', editingExpenseId)
      : await supabaseClient.from('expense_items').insert({ created_by: user.id, ...payload });

    if (error) {
      flash(editingExpenseId ? 'Não foi possível atualizar.' : 'Não foi possível registar.');
      return;
    }
    flash(editingExpenseId ? 'Despesa atualizada.' : 'Despesa adicionada.');
    resetExpenseForm();
    void loadExpenses();
  };

  const handleEditExpense = (e: ExpenseItem) => {
    setEditingExpenseId(e.id);
    setExpForm({
      category:     e.category,
      description:  e.description,
      amount_mzn:   String(e.amount_mzn),
      period_month: e.period_month,
      period_year:  e.period_year,
    });
  };

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabaseClient.from('expense_items').delete().eq('id', id);
    if (error) { flash('Não foi possível eliminar.'); return; }
    if (editingExpenseId === id) resetExpenseForm();
    flash('Despesa eliminada.');
    void loadExpenses();
  };

  const handleGenerateReport = async () => {
    const { error } = await supabaseClient.rpc('generate_monthly_report', {
      p_month: expForm.period_month,
      p_year:  expForm.period_year,
      p_rate:  64.05,
    });
    if (error) { flash('Falha ao gerar relatório.'); return; }
    flash('Relatório mensal gerado.');
    void loadReport(expForm.period_month, expForm.period_year);
  };

  return (
    <main className={`${themeVars} min-h-screen bg-[var(--parchment)] text-[var(--ink)]`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6">

        {/* ── Cabeçalho ── */}
        <header className="rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">
            Muneri · Administração
          </p>
          <h1 className="mt-2 font-serif text-2xl leading-snug sm:text-3xl">
            Painel <em className="text-[var(--gold2)]">administrativo</em>
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            Acompanhe pagamentos, custos operacionais e margem mensal da plataforma.
          </p>
        </header>

        {/* ── Feedback flash ── */}
        {message && (
          <div className="rounded border border-[var(--green)]/40 bg-[var(--green)]/10 px-4 py-2 font-mono text-[11px] text-[var(--green)]">
            {message}
          </div>
        )}

        {/* ── Tabs de navegação ── */}
        <nav className="flex flex-wrap gap-2">
          {([
            { key: 'payments', label: 'Pagamentos' },
            { key: 'expenses', label: 'Despesas' },
            { key: 'report',   label: 'Relatório' },
          ] as const).map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.06em] transition ${
                tab === item.key
                  ? 'border-transparent bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* ── TAB: Pagamentos ── */}
        {tab === 'payments' && (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-4">
            <p className="mb-4 text-sm text-[var(--muted)]">
              Contas com compra de plano pendente de validação manual.
            </p>

            {loading && (
              <p className="font-mono text-[11px] text-[var(--faint)]">A carregar pagamentos…</p>
            )}

            <div className="space-y-3">
              {pendingPayments.map(p => (
                <article key={p.id} className="rounded-lg border border-[var(--border)] bg-[var(--heroRight)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="font-serif text-base text-[#f1e8da]">
                        {p.profiles?.full_name ?? 'Utilizador'}
                      </h2>
                      <p className="font-mono text-[11px] text-[#c8bfb4]">
                        {p.profiles?.email ?? 'Sem e-mail'}
                      </p>
                      <p className="font-mono text-[11px] text-[#c8bfb4]">
                        Plano <strong className="text-[var(--gold)]">{p.plans?.label ?? p.plan_key}</strong>{' '}
                        · {toCurrency(p.amount_mzn)} · {p.payment_method.toUpperCase()}
                        {p.plans && p.amount_mzn !== p.plans.price_mzn && (
                          <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">
                            ⚠ Divergência: {toCurrency(p.plans.price_mzn)}
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[10px] text-[#8a7d6e]">
                        Transação: {p.transaction_id}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handlePaymentAction(p.id, 'confirm')}
                        className="rounded border border-[var(--green)]/40 bg-[var(--green)]/10 px-3 py-1.5 font-mono text-[11px] text-[var(--green)] transition hover:bg-[var(--green)]/20"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentAction(p.id, 'reject')}
                        className="rounded border border-red-500/40 bg-red-500/10 px-3 py-1.5 font-mono text-[11px] text-red-400 transition hover:bg-red-500/20"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {!loading && pendingPayments.length === 0 && (
              <p className="py-6 text-center font-mono text-[11px] text-[var(--faint)]">
                Não há pagamentos pendentes de validação.
              </p>
            )}
          </section>
        )}

        {/* ── TAB: Despesas ── */}
        {tab === 'expenses' && (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-4">
            <p className="mb-4 text-sm text-[var(--muted)]">
              Registe custos mensais para acompanhar o resultado financeiro da operação.
            </p>

            {/* Formulário */}
            <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto_auto]">
              <label className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Categoria</span>
                <select
                  value={expForm.category}
                  onChange={e => setExpForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full rounded border border-[var(--border)] bg-[var(--parchment)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Descrição</span>
                <input
                  type="text"
                  value={expForm.description}
                  onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Ex: API Groq — Março"
                  className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition placeholder-[var(--faint)] focus:border-[var(--gold2)]"
                />
              </label>

              <label className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Valor (MT)</span>
                <input
                  type="number"
                  min="0"
                  value={expForm.amount_mzn}
                  onChange={e => setExpForm(p => ({ ...p, amount_mzn: e.target.value }))}
                  className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition placeholder-[var(--faint)] focus:border-[var(--gold2)]"
                />
              </label>

              <button
                type="button"
                onClick={handleSaveExpense}
                className="self-end rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-black transition hover:brightness-110"
              >
                {editingExpenseId ? 'Guardar' : 'Adicionar'}
              </button>

              {editingExpenseId && (
                <button
                  type="button"
                  onClick={resetExpenseForm}
                  className="self-end rounded border border-[var(--border)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
                >
                  Cancelar
                </button>
              )}
            </div>

            {/* Lista */}
            <div className="mt-5 space-y-2">
              {expenses.map(e => (
                <article key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[var(--border)] bg-[var(--border)]/30 px-2 py-0.5 font-mono text-[10px] text-[var(--muted)]">
                      {CATEGORY_LABELS[e.category] ?? e.category}
                    </span>
                    <span className="text-sm text-[var(--ink)]">{e.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-red-400">−{toCurrency(e.amount_mzn)}</span>
                    <button
                      type="button"
                      onClick={() => handleEditExpense(e)}
                      className="rounded border border-[var(--border)] px-2 py-1 font-mono text-[10px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(e.id)}
                      className="rounded border border-red-500/40 px-2 py-1 font-mono text-[10px] text-red-400 transition hover:bg-red-500/10"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {expenses.length > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--faint)]">
                  Total de despesas
                </span>
                <strong className="font-mono text-base text-red-400">
                  −{toCurrency(totalExpenses)}
                </strong>
              </div>
            )}
          </section>
        )}

        {/* ── TAB: Relatório ── */}
        {tab === 'report' && (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-4">
            {/* Filtros */}
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <label className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Mês</span>
                <select
                  value={expForm.period_month}
                  onChange={e => setExpForm(p => ({ ...p, period_month: Number(e.target.value) }))}
                  className="w-full rounded border border-[var(--border)] bg-[var(--parchment)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const n = i + 1;
                    return (
                      <option key={n} value={n}>
                        {MONTH_FORMATTER.format(new Date(expForm.period_year, i))}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Ano</span>
                <input
                  type="number"
                  value={expForm.period_year}
                  onChange={e => setExpForm(p => ({ ...p, period_year: Number(e.target.value) }))}
                  className="w-28 rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]"
                />
              </label>

              <button
                type="button"
                onClick={handleGenerateReport}
                className="rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-black transition hover:brightness-110"
              >
                Gerar relatório
              </button>
            </div>

            {/* Cards de métricas */}
            {report ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: 'Utilizadores totais',  value: report.total_subscribers.toString(),   tone: 'text-[var(--teal)]' },
                  { label: 'Assinantes ativos',     value: report.active_subscribers.toString(), tone: 'text-[var(--green)]' },
                  { label: 'Receita bruta',         value: toCurrency(report.revenue_mzn),       tone: 'text-[var(--green)]' },
                  { label: 'Despesas totais',       value: toCurrency(report.total_expenses_mzn),tone: 'text-red-400' },
                  {
                    label: 'Lucro líquido',
                    value: toCurrency(report.net_margin_mzn),
                    tone: report.net_margin_mzn >= 0 ? 'text-[var(--green)]' : 'text-red-400',
                  },
                  {
                    label: 'Margem',
                    value: `${report.margin_pct.toFixed(1)}%`,
                    tone: report.margin_pct >= 50 ? 'text-[var(--green)]' : 'text-[var(--gold)]',
                  },
                ].map(item => (
                  <article key={item.label} className="rounded-lg border border-[var(--border)] bg-[var(--heroRight)] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8a7d6e]">
                      {item.label}
                    </p>
                    <p className={`font-mono mt-2 text-xl font-semibold ${item.tone}`}>
                      {item.value}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center font-mono text-[11px] text-[var(--faint)]">
                Seleccione o período e clique em "Gerar relatório".
              </p>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
