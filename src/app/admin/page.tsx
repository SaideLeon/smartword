'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useThemeMode } from '@/hooks/useThemeMode';
import Image from 'next/image';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Link2,
  Mail,
  Moon,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

/* ─── Tipos ─── */
type AdminTab = 'payments' | 'expenses' | 'report' | 'users';
type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

interface Payment {
  id: string; user_id: string; created_at: string; plan_key: string;
  transaction_id: string; amount_mzn: number; payment_method: string;
  status: PaymentStatus;
  profiles: { email: string; full_name: string } | null;
  plans: { label: string; price_mzn: number } | null;
}
interface ExpenseItem {
  id: string; category: string; description: string;
  amount_mzn: number; period_month: number; period_year: number;
}
interface Report {
  period_month: number; period_year: number; total_subscribers: number;
  active_subscribers: number; revenue_mzn: number; total_expenses_mzn: number;
  net_margin_mzn: number; margin_pct: number;
}
interface AdminUser {
  id: string; email: string | null; full_name: string | null;
  role: 'user' | 'admin'; plan_key: string | null;
  payment_status: string | null; created_at: string;
}

/* ─── Constantes ─── */
const CATEGORY_LABELS: Record<string, string> = {
  groq_api: 'API Groq', supabase: 'Supabase',
  hosting: 'Hosting / Vercel', domain: 'Domínio', other: 'Outros',
};
const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-PT', { month: 'long' });
const toCurrency = (v: number) => `${Math.round(v).toLocaleString('pt-BR')} MT`;

/* ─── Sidebar ─── */
const NAV_ITEMS: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: 'payments', label: 'Pagamentos',    icon: <CircleDollarSign size={15} /> },
  { key: 'expenses', label: 'Despesas',      icon: <ReceiptText size={15} /> },
  { key: 'report',   label: 'Relatório',     icon: <BarChart3 size={15} /> },
  { key: 'users',    label: 'Utilizadores',  icon: <Users size={15} /> },
];

function Sidebar({
  tab, setTab, themeMode, onToggleTheme,
}: { tab: AdminTab; setTab: (t: AdminTab) => void; themeMode: 'dark' | 'light'; onToggleTheme: () => void }) {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--navBg)]">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)]">
          <Image src="/icon.svg" alt="Muneri" width={18} height={18} />
        </div>
        <div>
          <span className="font-serif text-base italic text-[var(--gold2)]">Muneri</span>
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--faint)]">Admin</p>
        </div>
      </div>

      {/* Nav principal */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--faint)]">Gestão</p>
        {NAV_ITEMS.map(({ key, label, icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] transition text-left w-full ${
              tab === key
                ? 'bg-gradient-to-r from-[var(--gold)]/15 to-transparent text-[var(--gold2)] font-semibold'
                : 'text-[var(--muted)] hover:bg-[var(--border)]/40 hover:text-[var(--ink)]'
            }`}>
            {icon} {label}
          </button>
        ))}

        <div className="my-3 border-t border-[var(--border)]" />
        <p className="mb-2 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--faint)]">Ferramentas</p>

        <Link href="/admin/invite"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--green)] transition hover:bg-[var(--green)]/10">
          <Mail size={14} /> Convidar
        </Link>
        <Link href="/admin/premium-links"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--gold2)] transition hover:bg-[var(--gold)]/10">
          <Link2 size={14} /> Links premium
        </Link>
      </nav>

      {/* Rodapé da sidebar */}
      <div className="border-t border-[var(--border)] px-3 py-3">
        <button type="button" onClick={onToggleTheme}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:bg-[var(--border)]/40 hover:text-[var(--ink)]">
          {themeMode === 'dark' ? <><Sun size={13} /> Modo claro</> : <><Moon size={13} /> Modo escuro</>}
        </button>
        <Link href="/app"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:bg-[var(--border)]/40 hover:text-[var(--ink)]">
          <ChevronRight size={13} /> Voltar ao app
        </Link>
      </div>
    </aside>
  );
}

/* ─── KPI card ─── */
function KpiCard({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">{label}</p>
        <span className="text-[var(--faint)]">{icon}</span>
      </div>
      <p className={`mt-3 font-serif text-2xl ${tone}`}>{value}</p>
    </article>
  );
}

/* ─── Flash ─── */
function Flash({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--green)]/30 bg-[var(--green)]/10 px-4 py-2.5 font-mono text-[11px] text-[var(--green)]">
      <CheckCircle2 size={13} /> {message}
    </div>
  );
}

/* ══════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════ */
export default function AdminPage() {
  const today = new Date();
  const { themeMode, toggleThemeMode } = useThemeMode();

  const themeVars = themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908] [--surface:#141210]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14] [--surface:#ece8df]';

  const [tab, setTab] = useState<AdminTab>('payments');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [expForm, setExpForm] = useState({
    category: 'groq_api', description: '', amount_mzn: '',
    period_month: today.getMonth() + 1, period_year: today.getFullYear(),
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
    try {
      const res = await fetch('/api/payment');
      const data = await res.json();
      setPayments(!res.ok ? [] : Array.isArray(data) ? data : []);
      if (!res.ok) flash(`Erro: ${data?.error ?? `HTTP ${res.status}`}`);
    } catch { flash('Falha de rede.'); setPayments([]); }
    finally { setLoading(false); }
  }, [flash]);

  const loadExpenses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/expenses');
      const data = await res.json();
      setExpenses(!res.ok ? [] : Array.isArray(data) ? data : []);
      if (!res.ok) flash(`Erro: ${data?.error ?? `HTTP ${res.status}`}`);
    } catch { flash('Falha de rede.'); setExpenses([]); }
  }, [flash]);

  const loadReport = useCallback(async (month: number, year: number) => {
    try {
      const res = await fetch(`/api/admin/report?month=${month}&year=${year}`);
      const data = await res.json();
      setReport(!res.ok ? null : (data as Report) ?? null);
      if (!res.ok) flash(`Erro: ${data?.error ?? `HTTP ${res.status}`}`);
    } catch { flash('Falha de rede.'); setReport(null); }
  }, [flash]);

  const loadUsers = useCallback(async (query = '') => {
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) { flash(`Erro: ${data?.error ?? `HTTP ${res.status}`}`); setUsers([]); return; }
      const rows = Array.isArray(data) ? (data as AdminUser[]) : [];
      setUsers(rows);
      setSelectedUserIds(cur => cur.filter(id => rows.some(r => r.id === id)));
    } catch { flash('Falha de rede.'); setUsers([]); }
  }, [flash]);

  useEffect(() => {
    if (tab === 'payments') { void loadPayments(); return; }
    if (tab === 'expenses') { void loadExpenses(); return; }
    if (tab === 'users')    { void loadUsers(userQuery); return; }
    void loadExpenses();
    void loadReport(expForm.period_month, expForm.period_year);
  }, [expForm.period_month, expForm.period_year, loadExpenses, loadPayments, loadReport, loadUsers, tab, userQuery]);

  const handlePaymentAction = async (id: string, action: 'confirm' | 'reject') => {
    const res = await fetch('/api/payment', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: id, action }),
    });
    if (!res.ok) { flash('Erro ao processar pagamento.'); return; }
    flash(action === 'confirm' ? 'Pagamento confirmado.' : 'Pagamento rejeitado.');
    void loadPayments();
  };

  const resetExpenseForm = () => {
    setExpForm(p => ({ ...p, category: 'groq_api', description: '', amount_mzn: '' }));
    setEditingExpenseId(null);
  };

  const handleSaveExpense = async () => {
    if (!expForm.description || !expForm.amount_mzn) { flash('Preenche descrição e valor.'); return; }
    const payload = { category: expForm.category, description: expForm.description.trim(), amount_mzn: Number(expForm.amount_mzn), period_month: expForm.period_month, period_year: expForm.period_year };
    const res = await fetch(editingExpenseId ? `/api/admin/expenses?id=${editingExpenseId}` : '/api/admin/expenses', {
      method: editingExpenseId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) { flash(editingExpenseId ? 'Não foi possível atualizar.' : 'Não foi possível registar.'); return; }
    flash(editingExpenseId ? 'Despesa atualizada.' : 'Despesa adicionada.');
    resetExpenseForm(); void loadExpenses();
  };

  const handleDeleteExpense = async (id: string) => {
    const res = await fetch(`/api/admin/expenses?id=${id}`, { method: 'DELETE' });
    if (!res.ok) { flash('Não foi possível eliminar.'); return; }
    if (editingExpenseId === id) resetExpenseForm();
    flash('Despesa eliminada.'); void loadExpenses();
  };

  const handleGenerateReport = async () => {
    const res = await fetch('/api/admin/report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: expForm.period_month, year: expForm.period_year }),
    });
    if (!res.ok) { flash('Falha ao gerar relatório.'); return; }
    flash('Relatório gerado.'); void loadReport(expForm.period_month, expForm.period_year);
  };

  const toggleSelectedUser = (userId: string) =>
    setSelectedUserIds(cur => cur.includes(userId) ? cur.filter(id => id !== userId) : [...cur, userId]);

  const toggleSelectAllUsers = () =>
    setSelectedUserIds(selectedUserIds.length === users.length ? [] : users.map(u => u.id));

  const handleDeleteSelectedUsers = async () => {
    if (selectedUserIds.length < 1) { flash('Seleccione pelo menos um utilizador.'); return; }
    if (!window.confirm(`Confirma eliminar ${selectedUserIds.length} utilizador(es)?`)) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: selectedUserIds }),
    });
    const payload = await res.json();
    if (!res.ok && res.status !== 207) { flash(`Falha: ${payload?.error ?? `HTTP ${res.status}`}`); return; }
    if (res.status === 207) {
      flash(`Parcial: ${payload.deleted_ids?.length ?? 0} eliminado(s), ${payload.failures?.length ?? 0} com falha.`);
    } else { flash(`${selectedUserIds.length} utilizador(es) eliminado(s).`); }
    setSelectedUserIds([]); void loadUsers(userQuery);
  };

  /* Tab titles */
  const tabTitle: Record<AdminTab, string> = {
    payments: 'Pagamentos pendentes',
    expenses: 'Despesas operacionais',
    report:   'Relatório financeiro',
    users:    'Gestão de utilizadores',
  };

  return (
    <div className={`${themeVars} flex h-screen overflow-hidden bg-[var(--heroRight)] text-[var(--ink)]`}>

      {/* ── Sidebar desktop ── */}
      <div className="hidden md:block">
        <Sidebar tab={tab} setTab={setTab} themeMode={themeMode} onToggleTheme={toggleThemeMode} />
      </div>

      {/* ── Área principal ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Topbar */}
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--navBg)] px-5 py-3 md:px-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Muneri · Administração</p>
            <h1 className="font-serif text-xl text-[var(--ink)]">{tabTitle[tab]}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Tema mobile */}
            <button type="button" onClick={toggleThemeMode}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)] md:hidden">
              {themeMode === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>

            {/* Tabs mobile */}
            <div className="flex gap-1 md:hidden">
              {NAV_ITEMS.map(({ key, icon }) => (
                <button key={key} type="button" onClick={() => setTab(key)}
                  className={`grid h-8 w-8 place-items-center rounded-lg border text-[11px] transition ${
                    tab === key ? 'border-[var(--gold2)] bg-[var(--gold)]/10 text-[var(--gold2)]' : 'border-[var(--border)] text-[var(--muted)]'
                  }`}>
                  {icon}
                </button>
              ))}
            </div>

            {loading && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--faint)]">
                <RefreshCw size={11} className="animate-spin" /> A carregar…
              </span>
            )}
          </div>
        </header>

        {/* Conteúdo scrollável */}
        <main className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
          <Flash message={message} />

          {/* ══ TAB: PAGAMENTOS ══ */}
          {tab === 'payments' && (
            <div className="space-y-4">
              {/* KPI rápido */}
              <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard label="Pendentes" value={String(pendingPayments.length)} tone="text-[var(--gold2)]" icon={<CircleDollarSign size={16} />} />
                <KpiCard label="Total recebido" value={toCurrency(payments.filter(p => p.status === 'confirmed').reduce((t, p) => t + p.amount_mzn, 0))} tone="text-[var(--green)]" icon={<TrendingUp size={16} />} />
                <KpiCard label="Rejeitados" value={String(payments.filter(p => p.status === 'rejected').length)} tone="text-red-400" icon={<XCircle size={16} />} />
              </div>

              {/* Lista de pendentes */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h2 className="font-serif text-lg text-[var(--ink)]">Aguardando validação</h2>
                  <p className="font-mono text-[10px] text-[var(--faint)]">{pendingPayments.length} pagamento(s) pendente(s)</p>
                </div>

                {pendingPayments.length === 0 && !loading && (
                  <div className="flex flex-col items-center gap-2 py-14 text-center">
                    <CheckCircle2 size={32} className="text-[var(--green)] opacity-40" />
                    <p className="font-serif text-lg text-[var(--ink)]">Tudo em dia</p>
                    <p className="font-mono text-[11px] text-[var(--faint)]">Sem pagamentos pendentes de validação.</p>
                  </div>
                )}

                <div className="divide-y divide-[var(--border)]">
                  {pendingPayments.map(p => (
                    <div key={p.id} className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
                      <div className="space-y-1">
                        <p className="font-serif text-base text-[var(--ink)]">{p.profiles?.full_name ?? 'Utilizador'}</p>
                        <p className="font-mono text-[11px] text-[var(--muted)]">{p.profiles?.email ?? '—'}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-2.5 py-0.5 font-mono text-[10px] uppercase text-[var(--gold2)]">
                            {p.plans?.label ?? p.plan_key}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--muted)]">{toCurrency(p.amount_mzn)} · {p.payment_method.toUpperCase()}</span>
                          {p.plans && p.amount_mzn !== p.plans.price_mzn && (
                            <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-400">
                              <AlertTriangle size={9} /> Divergência: {toCurrency(p.plans.price_mzn)}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-[var(--faint)]">ID: {p.transaction_id}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handlePaymentAction(p.id, 'confirm')}
                          className="flex items-center gap-1.5 rounded-lg border border-[var(--green)]/40 bg-[var(--green)]/10 px-3 py-2 font-mono text-[11px] text-[var(--green)] transition hover:bg-[var(--green)]/20">
                          <CheckCircle2 size={12} /> Confirmar
                        </button>
                        <button type="button" onClick={() => handlePaymentAction(p.id, 'reject')}
                          className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400 transition hover:bg-red-500/20">
                          <XCircle size={12} /> Rejeitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB: DESPESAS ══ */}
          {tab === 'expenses' && (
            <div className="space-y-5">
              {/* Formulário */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="mb-4 font-serif text-lg text-[var(--ink)]">
                  {editingExpenseId ? 'Editar despesa' : 'Adicionar despesa'}
                </h2>
                <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">Categoria</label>
                    <select value={expForm.category} onChange={e => setExpForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]">
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">Descrição</label>
                    <input type="text" value={expForm.description} onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Ex: API Groq — Março"
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none placeholder-[var(--faint)] transition focus:border-[var(--gold2)]" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">Valor (MT)</label>
                    <input type="number" min="0" value={expForm.amount_mzn} onChange={e => setExpForm(p => ({ ...p, amount_mzn: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]" />
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="button" onClick={handleSaveExpense}
                      className="rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-black transition hover:brightness-110">
                      {editingExpenseId ? 'Guardar' : 'Adicionar'}
                    </button>
                    {editingExpenseId && (
                      <button type="button" onClick={resetExpenseForm}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-[11px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                  <h2 className="font-serif text-lg text-[var(--ink)]">Despesas registadas</h2>
                  {expenses.length > 0 && (
                    <span className="font-mono text-sm font-semibold text-red-400">−{toCurrency(totalExpenses)}</span>
                  )}
                </div>

                {expenses.length === 0 ? (
                  <div className="py-14 text-center">
                    <p className="font-mono text-[11px] text-[var(--faint)]">Sem despesas registadas para este período.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {expenses.map(e => (
                      <div key={e.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-[var(--border)] bg-[var(--border)]/30 px-2.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">
                            {CATEGORY_LABELS[e.category] ?? e.category}
                          </span>
                          <span className="text-sm text-[var(--ink)]">{e.description}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-red-400">−{toCurrency(e.amount_mzn)}</span>
                          <button type="button" onClick={() => { setEditingExpenseId(e.id); setExpForm(p => ({ ...p, category: e.category, description: e.description, amount_mzn: String(e.amount_mzn), period_month: e.period_month, period_year: e.period_year })); }}
                            className="rounded-lg border border-[var(--border)] px-2.5 py-1 font-mono text-[10px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                            Editar
                          </button>
                          <button type="button" onClick={() => handleDeleteExpense(e.id)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-red-500/30 text-red-400 transition hover:bg-red-500/10">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ TAB: RELATÓRIO ══ */}
          {tab === 'report' && (
            <div className="space-y-5">
              {/* Filtros */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="mb-4 font-serif text-lg text-[var(--ink)]">Seleccionar período</h2>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">Mês</label>
                    <select value={expForm.period_month} onChange={e => setExpForm(p => ({ ...p, period_month: Number(e.target.value) }))}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]">
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{MONTH_FORMATTER.format(new Date(expForm.period_year, i))}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">Ano</label>
                    <input type="number" value={expForm.period_year} onChange={e => setExpForm(p => ({ ...p, period_year: Number(e.target.value) }))}
                      className="w-24 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]" />
                  </div>
                  <button type="button" onClick={handleGenerateReport}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-black transition hover:brightness-110">
                    <BarChart3 size={13} /> Gerar relatório
                  </button>
                </div>
              </div>

              {/* Métricas */}
              {report ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: 'Utilizadores totais',  value: String(report.total_subscribers),             tone: 'text-[var(--teal)]',  icon: <Users size={16} /> },
                    { label: 'Assinantes activos',    value: String(report.active_subscribers),            tone: 'text-[var(--green)]', icon: <ShieldCheck size={16} /> },
                    { label: 'Receita bruta',         value: toCurrency(report.revenue_mzn),               tone: 'text-[var(--green)]', icon: <TrendingUp size={16} /> },
                    { label: 'Despesas totais',       value: toCurrency(report.total_expenses_mzn),        tone: 'text-red-400',        icon: <ReceiptText size={16} /> },
                    { label: 'Lucro líquido',         value: toCurrency(report.net_margin_mzn),            tone: report.net_margin_mzn >= 0 ? 'text-[var(--green)]' : 'text-red-400', icon: <CircleDollarSign size={16} /> },
                    { label: 'Margem',                value: `${report.margin_pct.toFixed(1)}%`,           tone: report.margin_pct >= 50 ? 'text-[var(--green)]' : 'text-[var(--gold)]', icon: <BarChart3 size={16} /> },
                  ].map(item => <KpiCard key={item.label} {...item} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
                  <FileText size={32} className="text-[var(--faint)] opacity-40" />
                  <p className="font-serif text-lg text-[var(--ink)]">Nenhum relatório gerado</p>
                  <p className="font-mono text-[11px] text-[var(--faint)]">Seleccione o período e clique em "Gerar relatório".</p>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB: UTILIZADORES ══ */}
          {tab === 'users' && (
            <div className="space-y-4">
              {/* Barra de controlo */}
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <input type="text" value={userQuery} onChange={e => setUserQuery(e.target.value)}
                  placeholder="Pesquisar por nome ou e-mail…"
                  className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none placeholder-[var(--faint)] transition focus:border-[var(--gold2)]" />
                <button type="button" onClick={() => void loadUsers(userQuery)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                  <RefreshCw size={11} /> Filtrar
                </button>
                {selectedUserIds.length > 0 && (
                  <button type="button" onClick={handleDeleteSelectedUsers}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-red-400 transition hover:bg-red-500/20">
                    <Trash2 size={11} /> Eliminar ({selectedUserIds.length})
                  </button>
                )}
              </div>

              {/* Tabela */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h2 className="font-serif text-lg text-[var(--ink)]">Contas registadas</h2>
                  <p className="font-mono text-[10px] text-[var(--faint)]">{users.length} utilizador(es) encontrado(s)</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-5 py-3 text-left">
                          <input type="checkbox" checked={users.length > 0 && selectedUserIds.length === users.length}
                            onChange={toggleSelectAllUsers} aria-label="Seleccionar todos" />
                        </th>
                        {['Utilizador', 'Plano', 'Pagamento', 'Criado em'].map(col => (
                          <th key={col} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {users.map(user => (
                        <tr key={user.id} className="transition hover:bg-[var(--border)]/20">
                          <td className="px-5 py-3.5">
                            <input type="checkbox" checked={selectedUserIds.includes(user.id)}
                              onChange={() => toggleSelectedUser(user.id)}
                              aria-label={`Seleccionar ${user.email ?? user.id}`} />
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-[var(--ink)]">{user.full_name || 'Sem nome'}</p>
                            <p className="font-mono text-[11px] text-[var(--faint)]">{user.email || '—'}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            {user.plan_key
                              ? <span className="rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-2.5 py-0.5 font-mono text-[10px] uppercase text-[var(--gold2)]">{user.plan_key}</span>
                              : <span className="font-mono text-[11px] text-[var(--faint)]">—</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            {user.payment_status
                              ? <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase ${
                                  user.payment_status === 'confirmed'
                                    ? 'border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]'
                                    : user.payment_status === 'pending'
                                      ? 'border-[var(--gold)]/30 bg-[var(--gold)]/10 text-[var(--gold2)]'
                                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                                }`}>{user.payment_status}</span>
                              : <span className="font-mono text-[11px] text-[var(--faint)]">—</span>}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-[var(--muted)]">
                            {new Date(user.created_at).toLocaleDateString('pt-PT')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {users.length === 0 && (
                    <div className="py-14 text-center">
                      <p className="font-mono text-[11px] text-[var(--faint)]">Nenhum utilizador encontrado.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
