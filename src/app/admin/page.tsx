// src/app/admin/page.tsx
// Painel de administração: pagamentos pendentes, despesas, relatório mensal.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabaseClient } from '@/hooks/useAuth';

interface Payment {
  id: string;
  created_at: string;
  user_id: string;
  plan_key: string;
  transaction_id: string;
  amount_mzn: number;
  payment_method: string;
  status: 'pending' | 'confirmed' | 'rejected';
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
  other:     'Outro',
};

export default function AdminPage() {
  const [tab, setTab] = useState<'payments' | 'expenses' | 'report'>('payments');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Formulário de despesa
  const [expForm, setExpForm] = useState({ category: 'groq_api', description: '', amount_mzn: '', period_month: new Date().getMonth() + 1, period_year: new Date().getFullYear() });

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3500); };

  // ── Carregar pagamentos ─────────────────────────────────────────────────────
  const loadPayments = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/payment');
    const data = await res.json();
    setPayments(data ?? []);
    setLoading(false);
  }, []);

  // ── Carregar despesas ───────────────────────────────────────────────────────
  const loadExpenses = useCallback(async () => {
    const { data } = await supabaseClient.from('expense_items').select('*').order('created_at', { ascending: false });
    setExpenses((data as ExpenseItem[]) ?? []);
  }, []);

  // ── Carregar relatório ──────────────────────────────────────────────────────
  const loadReport = useCallback(async () => {
    const month = new Date().getMonth() + 1;
    const year  = new Date().getFullYear();
    const { data } = await supabaseClient
      .from('monthly_reports')
      .select('*')
      .eq('period_month', month)
      .eq('period_year', year)
      .single();
    setReport(data as Report ?? null);
  }, []);

  useEffect(() => {
    if (tab === 'payments') loadPayments();
    if (tab === 'expenses') loadExpenses();
    if (tab === 'report')   { loadExpenses(); loadReport(); }
  }, [tab, loadPayments, loadExpenses, loadReport]);

  // ── Confirmar / Rejeitar pagamento ─────────────────────────────────────────
  const handlePaymentAction = async (payment_id: string, action: 'confirm' | 'reject') => {
    const res = await fetch('/api/payment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id, action }),
    });
    if (res.ok) {
      flash(action === 'confirm' ? '✓ Pagamento confirmado — plano activado' : '✗ Pagamento rejeitado');
      loadPayments();
    } else {
      flash('Erro ao processar o pagamento');
    }
  };

  // ── Adicionar despesa ───────────────────────────────────────────────────────
  const handleAddExpense = async () => {
    if (!expForm.description || !expForm.amount_mzn) return;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { error } = await supabaseClient.from('expense_items').insert({
      created_by:   user.id,
      category:     expForm.category,
      description:  expForm.description,
      amount_mzn:   parseFloat(expForm.amount_mzn),
      period_month: expForm.period_month,
      period_year:  expForm.period_year,
    });

    if (!error) {
      flash('✓ Despesa adicionada');
      setExpForm(f => ({ ...f, description: '', amount_mzn: '' }));
      loadExpenses();
    }
  };

  // ── Gerar relatório ─────────────────────────────────────────────────────────
  const handleGenerateReport = async () => {
    const month = expForm.period_month;
    const year  = expForm.period_year;
    const { error } = await supabaseClient.rpc('generate_monthly_report', {
      p_month: month,
      p_year:  year,
      p_rate:  64.05,
    });
    if (!error) {
      flash('✓ Relatório gerado com sucesso');
      loadReport();
    }
  };

  const fmt = (v: number) => Math.round(v).toLocaleString('pt-BR') + ' MT';

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Painel de Administração</h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 24 }}>Muneri · Gestão de utilizadores, pagamentos e custos</p>

      {msg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--color-background-success)', color: 'var(--color-text-success)', fontSize: 13, marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {(['payments', 'expenses', 'report'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid',
            borderColor: tab === t ? 'transparent' : 'var(--color-border-tertiary)',
            background: tab === t ? 'var(--color-text-primary)' : 'transparent',
            color: tab === t ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
            fontSize: 13, cursor: 'pointer', fontWeight: tab === t ? 500 : 400,
          }}>
            {t === 'payments' ? 'Pagamentos' : t === 'expenses' ? 'Despesas' : 'Relatório'}
          </button>
        ))}
      </div>

      {/* ── TAB: PAGAMENTOS ───────────────────────────────────────────────────── */}
      {tab === 'payments' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Pagamentos pendentes de confirmação. Após confirmar, o plano é activado automaticamente.
          </p>
          {loading && <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>A carregar…</p>}
          {payments.map(p => (
            <div key={p.id} style={{
              border: '1px solid var(--color-border-tertiary)', borderRadius: 10,
              padding: '14px 16px', marginBottom: 10,
              borderLeft: p.status === 'pending' ? '3px solid var(--color-text-warning)' : p.status === 'confirmed' ? '3px solid var(--color-text-success)' : '3px solid var(--color-text-danger)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.profiles?.full_name ?? '—'} · {p.profiles?.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                    Plano: <strong>{p.plans?.label}</strong> · {fmt(p.amount_mzn)} · {p.payment_method?.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                    ID: {p.transaction_id}
                  </div>
                </div>
                {p.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => handlePaymentAction(p.id, 'confirm')} style={{
                      padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: 'var(--color-background-success)', color: 'var(--color-text-success)', fontSize: 12,
                    }}>✓ Confirmar</button>
                    <button onClick={() => handlePaymentAction(p.id, 'reject')} style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-border-tertiary)', cursor: 'pointer',
                      background: 'transparent', color: 'var(--color-text-danger)', fontSize: 12,
                    }}>✗ Rejeitar</button>
                  </div>
                )}
                {p.status !== 'pending' && (
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: p.status === 'confirmed' ? 'var(--color-background-success)' : 'var(--color-background-danger)', color: p.status === 'confirmed' ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
                    {p.status === 'confirmed' ? 'Confirmado' : 'Rejeitado'}
                  </span>
                )}
              </div>
            </div>
          ))}
          {!loading && payments.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Nenhum pagamento encontrado.</p>
          )}
        </div>
      )}

      {/* ── TAB: DESPESAS ─────────────────────────────────────────────────────── */}
      {tab === 'expenses' && (
        <div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Define os custos operacionais mensais. Usado para calcular a margem líquida no relatório.
          </p>

          {/* Formulário */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, marginBottom: 20, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Categoria</label>
              <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontSize: 13 }}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Descrição</label>
              <input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: API Groq — Março 2026" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Valor (MT)</label>
              <input type="number" value={expForm.amount_mzn} onChange={e => setExpForm(f => ({ ...f, amount_mzn: e.target.value }))} placeholder="0" min="0" style={{ width: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)' }} />
            </div>
            <button onClick={handleAddExpense} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', fontSize: 13, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}>
              + Adicionar
            </button>
          </div>

          {/* Lista de despesas */}
          {expenses.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--color-border-tertiary)', borderRadius: 8, marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 12, padding: '2px 7px', borderRadius: 20, background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', marginRight: 8 }}>{CATEGORY_LABELS[e.category] ?? e.category}</span>
                <span style={{ fontSize: 13 }}>{e.description}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-danger)' }}>−{fmt(e.amount_mzn)}</span>
            </div>
          ))}

          {expenses.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid var(--color-border-tertiary)', marginTop: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Total despesas</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--color-text-danger)' }}>
                −{fmt(expenses.reduce((s, e) => s + e.amount_mzn, 0))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: RELATÓRIO ────────────────────────────────────────────────────── */}
      {tab === 'report' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
            <select value={expForm.period_month} onChange={e => setExpForm(f => ({ ...f, period_month: +e.target.value }))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontSize: 13 }}>
              {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(2026, i).toLocaleString('pt-PT', { month: 'long' })}</option>)}
            </select>
            <input type="number" value={expForm.period_year} onChange={e => setExpForm(f => ({ ...f, period_year: +e.target.value }))} style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)' }} />
            <button onClick={handleGenerateReport} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              ↻ Gerar relatório
            </button>
          </div>

          {report ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Utilizadores totais',  value: report.total_subscribers,  color: 'var(--color-text-info)' },
                { label: 'Assinantes activos',   value: report.active_subscribers, color: 'var(--color-text-success)' },
                { label: 'Receita bruta',         value: fmt(report.revenue_mzn),  color: 'var(--color-text-success)' },
                { label: 'Total despesas',        value: fmt(report.total_expenses_mzn), color: 'var(--color-text-danger)' },
                { label: 'Lucro líquido',         value: fmt(report.net_margin_mzn), color: report.net_margin_mzn >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' },
                { label: 'Margem',                value: report.margin_pct.toFixed(1) + '%', color: report.margin_pct > 50 ? 'var(--color-text-success)' : 'var(--color-text-warning)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '16px', border: '1px solid var(--color-border-tertiary)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 500, fontFamily: 'var(--font-mono)', color }}>{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
              Clique em "Gerar relatório" para calcular o resultado do mês seleccionado.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
