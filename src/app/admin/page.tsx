'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useThemeMode } from '@/hooks/useThemeMode';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Mail,
  Moon,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  Star,
  Sun,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

/* ════════════════════════════════════════════
   TIPOS
════════════════════════════════════════════ */
type AdminTab = 'payments' | 'expenses' | 'report' | 'users' | 'invite' | 'premium-links';
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
interface AdminWork {
  id: string; topic: string; work_type: 'academic' | 'project' | null;
  status: string | null; created_at: string; updated_at: string;
}

/* ════════════════════════════════════════════
   CONSTANTES
════════════════════════════════════════════ */
const CATEGORY_LABELS: Record<string, string> = {
  groq_api: 'API Groq', supabase: 'Supabase',
  hosting: 'Hosting / Vercel', domain: 'Domínio', other: 'Outros',
};
const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-PT', { month: 'long' });
const toCurrency = (v: number) => `${Math.round(v).toLocaleString('pt-BR')} MT`;

/* ════════════════════════════════════════════
   NAV ITEMS
════════════════════════════════════════════ */
const NAV_MAIN: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: 'payments',      label: 'Pagamentos',    icon: <CircleDollarSign size={14} /> },
  { key: 'expenses',      label: 'Despesas',      icon: <ReceiptText size={14} /> },
  { key: 'report',        label: 'Relatório',     icon: <BarChart3 size={14} /> },
  { key: 'users',         label: 'Utilizadores',  icon: <Users size={14} /> },
];
const NAV_TOOLS: { key: AdminTab; label: string; icon: React.ReactNode; accent: string }[] = [
  { key: 'invite',        label: 'Convidar',      icon: <Mail size={14} />,  accent: 'text-[var(--green)]  hover:bg-[var(--green)]/10' },
  { key: 'premium-links', label: 'Links premium', icon: <Star size={14} />,  accent: 'text-[var(--gold2)]  hover:bg-[var(--gold)]/10' },
];

/* ════════════════════════════════════════════
   COMPONENTES PARTILHADOS
════════════════════════════════════════════ */
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

function Flash({ message, isError }: { message: string; isError?: boolean }) {
  if (!message) return null;
  return (
    <div className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-[11px] ${
      isError
        ? 'border-red-500/30 bg-red-500/10 text-red-400'
        : 'border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]'
    }`}>
      {isError ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
      {message}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">{children}</span>;
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px] text-[var(--ink)] outline-none placeholder-[var(--faint)] transition focus:border-[var(--gold2)] ${className}`} />
  );
}

function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props}
      className={`w-full rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px] text-[var(--ink)] outline-none placeholder-[var(--faint)] transition focus:border-[var(--gold2)] resize-none ${className}`} />
  );
}

function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className={`w-full rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-[12px] text-[var(--ink)] outline-none transition focus:border-[var(--gold2)] ${className}`}>
      {children}
    </select>
  );
}

/* ════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════ */
function Sidebar({ tab, setTab, themeMode, onToggleTheme }:
  { tab: AdminTab; setTab: (t: AdminTab) => void; themeMode: 'dark' | 'light'; onToggleTheme: () => void }) {
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

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--faint)]">Gestão</p>
        {NAV_MAIN.map(({ key, label, icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-mono text-[11px] uppercase tracking-[0.06em] transition ${
              tab === key
                ? 'bg-gradient-to-r from-[var(--gold)]/15 to-transparent font-semibold text-[var(--gold2)]'
                : 'text-[var(--muted)] hover:bg-[var(--border)]/40 hover:text-[var(--ink)]'
            }`}>
            {icon} {label}
          </button>
        ))}

        <div className="my-3 border-t border-[var(--border)]" />
        <p className="mb-2 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--faint)]">Ferramentas</p>
        {NAV_TOOLS.map(({ key, label, icon, accent }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-mono text-[11px] uppercase tracking-[0.06em] transition ${
              tab === key ? 'ring-1 ring-inset ring-[var(--border)] bg-[var(--border)]/30 font-semibold' : ''
            } ${accent}`}>
            {icon} {label}
          </button>
        ))}
      </nav>

      {/* Rodapé */}
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

/* ════════════════════════════════════════════
   TAB: CONVIDAR ESTUDANTES
════════════════════════════════════════════ */
function TabInvite() {
  const [emails, setEmails] = useState('');
  const [subject, setSubject] = useState('Convite para o Muneri — plataforma académica gratuita');
  const [body, setBody] = useState(
    'Olá!\n\nFui convidado(a) a partilhar contigo o Muneri, uma plataforma que ajuda estudantes a criar trabalhos académicos completos — com capa, índice, desenvolvimento e referências — em minutos.\n\nPodes criar a tua conta gratuitamente usando o link abaixo:\n\n{{link}}\n\nBom estudo!'
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSend = async () => {
    const rawEmails = emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    if (rawEmails.length === 0) { setIsError(true); setMessage('Insere pelo menos um e-mail.'); return; }

    setLoading(true); setMessage('');
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: rawEmails, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setIsError(false);
      setMessage(`${rawEmails.length} convite(s) enviado(s) com sucesso.`);
      setEmails('');
    } catch (e: any) {
      setIsError(true);
      setMessage(e?.message ?? 'Falha ao enviar convites.');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <Flash message={message} isError={isError} />

      <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
        {/* Coluna esquerda — destinatários */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-1 font-serif text-lg text-[var(--ink)]">Destinatários</h2>
          <p className="mb-4 font-mono text-[10px] text-[var(--faint)]">Um e-mail por linha, ou separados por vírgula / ponto e vírgula</p>

          <div className="space-y-1">
            <FieldLabel>E-mails</FieldLabel>
            <Textarea
              rows={8}
              value={emails}
              onChange={e => setEmails(e.target.value)}
              placeholder={'aluno@universidade.ac.mz\ncolega@exemplo.com\n...'}
            />
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2">
            <span className="font-mono text-[11px] text-[var(--faint)]">E-mails detectados</span>
            <span className="font-mono text-sm font-semibold text-[var(--gold2)]">
              {emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean).length}
            </span>
          </div>
        </div>

        {/* Coluna direita — mensagem */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-1 font-serif text-lg text-[var(--ink)]">Mensagem</h2>
          <p className="mb-4 font-mono text-[10px] text-[var(--faint)]">Use {'{{link}}'} para inserir o link de registo automaticamente</p>

          <div className="space-y-3">
            <div className="space-y-1">
              <FieldLabel>Assunto</FieldLabel>
              <Input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <FieldLabel>Corpo do e-mail</FieldLabel>
              <Textarea rows={8} value={body} onChange={e => setBody(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={handleSend} disabled={loading}
          className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-black shadow-lg transition hover:brightness-110 disabled:opacity-60">
          {loading
            ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" /> A enviar…</>
            : <><Send size={14} /> Enviar convites</>}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   TAB: LINKS PREMIUM
════════════════════════════════════════════ */
function TabPremiumLinks() {
  type PremiumUser = { id: string; email: string | null; full_name: string | null; role: 'user' | 'admin' };

  const [query, setQuery]               = useState('');
  const [users, setUsers]               = useState<PremiumUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [expiresAt, setExpiresAt]       = useState('');
  const [maxUses, setMaxUses]           = useState(1);
  const [emailSubject, setEmailSubject] = useState('Muneri · Link de acesso Premium');
  const [emailBody, setEmailBody]       = useState('Olá! Usa este link para ativar o teu acesso premium no Muneri:');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [message, setMessage]           = useState('');
  const [isError, setIsError]           = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied]             = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setUsers(Array.isArray(data) ? (data as PremiumUser[]) : []);
      } catch { setUsers([]); }
      finally { setLoadingUsers(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId) ?? null, [users, selectedUserId]);

  const handleCreate = async () => {
    if (!selectedUserId) { setIsError(true); setMessage('Seleccione um utilizador.'); return; }
    setLoading(true); setMessage(''); setGeneratedLink('');
    try {
      const res = await fetch('/api/admin/premium-links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: selectedUserId, max_uses: maxUses,
          expires_at: expiresAt.trim() ? new Date(expiresAt).toISOString() : null,
          email_subject: emailSubject, email_body: emailBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setIsError(false);
      setMessage(`Link criado e enviado para ${data?.target_user_email ?? 'o utilizador'}.`);
      setGeneratedLink(data.redeem_link ?? '');
    } catch (e: any) {
      setIsError(true);
      setMessage(e?.message ?? 'Não foi possível gerar o link.');
    } finally { setLoading(false); }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <Flash message={message} isError={isError} />

      <div className="grid gap-5 md:grid-cols-2">
        {/* Configuração do link */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-4 font-serif text-lg text-[var(--ink)]">Configurar link</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <FieldLabel>Pesquisar utilizador</FieldLabel>
              <div className="relative">
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="ex: aluno@universidade.edu"
                />
                {loadingUsers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-3 w-3 animate-spin rounded-full border border-[var(--gold2)] border-t-transparent" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <FieldLabel>Seleccionar utilizador</FieldLabel>
              <Select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                <option value="">{loadingUsers ? 'A carregar…' : 'Escolha um utilizador'}</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.email ?? 'Sem e-mail'} · {u.full_name ?? 'Sem nome'}
                  </option>
                ))}
              </Select>
            </div>

            {selectedUser && (
              <div className="rounded-lg border border-[var(--gold)]/20 bg-[var(--gold)]/5 px-3 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">Selecionado</p>
                <p className="mt-0.5 font-mono text-[12px] text-[var(--ink)]">{selectedUser.email ?? '—'}</p>
                <p className="font-mono text-[11px] text-[var(--faint)]">{selectedUser.full_name ?? '—'} · {selectedUser.id.slice(0, 12)}…</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel>Expiração (opcional)</FieldLabel>
                <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <FieldLabel>Máx. utilizações</FieldLabel>
                <Input type="number" min={1} max={10} value={maxUses}
                  onChange={e => setMaxUses(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
              </div>
            </div>
          </div>
        </div>

        {/* Mensagem de e-mail */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-4 font-serif text-lg text-[var(--ink)]">E-mail de notificação</h2>
          <div className="space-y-3">
            <div className="space-y-1">
              <FieldLabel>Assunto</FieldLabel>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <FieldLabel>Corpo</FieldLabel>
              <Textarea rows={6} value={emailBody} onChange={e => setEmailBody(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Acção */}
      <div className="flex justify-end">
        <button type="button" onClick={handleCreate} disabled={loading}
          className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-black shadow-lg transition hover:brightness-110 disabled:opacity-60">
          {loading
            ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" /> A gerar…</>
            : <><Link2 size={14} /> Gerar e enviar link</>}
        </button>
      </div>

      {/* Link gerado */}
      {generatedLink && (
        <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">Link gerado</p>
              <p className="mt-1 font-mono text-[12px] break-all text-[var(--ink)]">{generatedLink}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={copyLink}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] transition ${
                  copied ? 'border-[var(--green)]/40 bg-[var(--green)]/10 text-[var(--green)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
                }`}>
                <Copy size={11} /> {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <a href={generatedLink} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                <ExternalLink size={11} /> Abrir
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   PÁGINA PRINCIPAL
════════════════════════════════════════════ */
export default function AdminPage() {
  const today = new Date();
  const { themeMode, toggleThemeMode } = useThemeMode();

  const themeVars = themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908] [--surface:#141210] [--surface2:#1a1714]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14] [--surface:#ece8df] [--surface2:#e5e0d5]';

  const [tab, setTab] = useState<AdminTab>('payments');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userWorks, setUserWorks] = useState<Record<string, AdminWork[]>>({});
  const [loadingWorksUserId, setLoadingWorksUserId] = useState<string | null>(null);
  const [expForm, setExpForm] = useState({
    category: 'groq_api', description: '', amount_mzn: '',
    period_month: today.getMonth() + 1, period_year: today.getFullYear(),
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const totalExpenses   = useMemo(() => expenses.reduce((t, i) => t + i.amount_mzn, 0), [expenses]);
  const pendingPayments = useMemo(() => payments.filter(p => p.status === 'pending'), [payments]);

  const flash = useCallback((text: string) => {
    setMessage(text); setTimeout(() => setMessage(''), 3200);
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
      setExpandedUserId(cur => cur && rows.some(r => r.id === cur) ? cur : null);
    } catch { flash('Falha de rede.'); setUsers([]); }
  }, [flash]);

  useEffect(() => {
    if (tab === 'payments')      { void loadPayments(); return; }
    if (tab === 'expenses')      { void loadExpenses(); return; }
    if (tab === 'users')         { void loadUsers(userQuery); return; }
    if (tab === 'report')        { void loadExpenses(); void loadReport(expForm.period_month, expForm.period_year); return; }
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

  const loadUserWorks = useCallback(async (userId: string, force = false) => {
    if (!force && userWorks[userId]) {
      setExpandedUserId(cur => cur === userId ? null : userId);
      return;
    }

    setLoadingWorksUserId(userId);
    try {
      const res = await fetch(`/api/admin/users?works_user_id=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) { flash(`Erro: ${data?.error ?? `HTTP ${res.status}`}`); return; }
      setUserWorks(cur => ({ ...cur, [userId]: Array.isArray(data) ? (data as AdminWork[]) : [] }));
      setExpandedUserId(userId);
    } catch { flash('Falha ao carregar trabalhos do utilizador.'); }
    finally { setLoadingWorksUserId(null); }
  }, [flash, userWorks]);

  const toggleSelectedUser = (id: string) =>
    setSelectedUserIds(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  const toggleSelectAllUsers = () =>
    setSelectedUserIds(selectedUserIds.length === users.length ? [] : users.map(u => u.id));

  const handleDeleteSelectedUsers = async () => {
    if (selectedUserIds.length < 1) { flash('Seleccione pelo menos um utilizador.'); return; }
    if (!window.confirm(`Confirma eliminar ${selectedUserIds.length} utilizador(es)?`)) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: selectedUserIds }),
    });
    const data = await res.json();
    if (!res.ok && res.status !== 207) { flash(`Falha: ${data?.error ?? `HTTP ${res.status}`}`); return; }
    flash(res.status === 207
      ? `Parcial: ${data.deleted_ids?.length ?? 0} eliminado(s), ${data.failures?.length ?? 0} com falha.`
      : `${selectedUserIds.length} utilizador(es) eliminado(s).`);
    setSelectedUserIds([]); void loadUsers(userQuery);
  };

  const tabTitle: Record<AdminTab, string> = {
    payments:       'Pagamentos pendentes',
    expenses:       'Despesas operacionais',
    report:         'Relatório financeiro',
    users:          'Gestão de utilizadores',
    invite:         'Convidar estudantes',
    'premium-links':'Links premium',
  };

  /* ── Render ── */
  return (
    <div className={`${themeVars} flex h-screen overflow-hidden bg-[var(--heroRight)] text-[var(--ink)]`}>

      {/* Sidebar desktop */}
      <div className="hidden md:block">
        <Sidebar tab={tab} setTab={setTab} themeMode={themeMode} onToggleTheme={toggleThemeMode} />
      </div>

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
            {/* Tabs ícone mobile */}
            <div className="flex gap-1 md:hidden">
              {[...NAV_MAIN, ...NAV_TOOLS].map(({ key, icon }) => (
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

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
          <Flash message={message} />

          {/* ══ INVITE ══ */}
          {tab === 'invite' && <TabInvite />}

          {/* ══ PREMIUM LINKS ══ */}
          {tab === 'premium-links' && <TabPremiumLinks />}

          {/* ══ PAGAMENTOS ══ */}
          {tab === 'payments' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard label="Pendentes" value={String(pendingPayments.length)} tone="text-[var(--gold2)]" icon={<CircleDollarSign size={16} />} />
                <KpiCard label="Total recebido" value={toCurrency(payments.filter(p => p.status === 'confirmed').reduce((t, p) => t + p.amount_mzn, 0))} tone="text-[var(--green)]" icon={<TrendingUp size={16} />} />
                <KpiCard label="Rejeitados" value={String(payments.filter(p => p.status === 'rejected').length)} tone="text-red-400" icon={<XCircle size={16} />} />
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h2 className="font-serif text-lg text-[var(--ink)]">Aguardando validação</h2>
                  <p className="font-mono text-[10px] text-[var(--faint)]">{pendingPayments.length} pagamento(s) pendente(s)</p>
                </div>
                {pendingPayments.length === 0 && !loading ? (
                  <div className="flex flex-col items-center gap-2 py-14 text-center">
                    <CheckCircle2 size={32} className="text-[var(--green)] opacity-40" />
                    <p className="font-serif text-lg">Tudo em dia</p>
                    <p className="font-mono text-[11px] text-[var(--faint)]">Sem pagamentos pendentes.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {pendingPayments.map(p => (
                      <div key={p.id} className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-serif text-base text-[var(--ink)]">{p.profiles?.full_name ?? 'Utilizador'}</p>
                          <p className="font-mono text-[11px] text-[var(--muted)]">{p.profiles?.email ?? '—'}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-2.5 py-0.5 font-mono text-[10px] uppercase text-[var(--gold2)]">{p.plans?.label ?? p.plan_key}</span>
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
                )}
              </div>
            </div>
          )}

          {/* ══ DESPESAS ══ */}
          {tab === 'expenses' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="mb-4 font-serif text-lg text-[var(--ink)]">{editingExpenseId ? 'Editar despesa' : 'Adicionar despesa'}</h2>
                <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
                  <div className="space-y-1">
                    <FieldLabel>Categoria</FieldLabel>
                    <select value={expForm.category} onChange={e => setExpForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]">
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <FieldLabel>Descrição</FieldLabel>
                    <input type="text" value={expForm.description} onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Ex: API Groq — Março"
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none placeholder-[var(--faint)] transition focus:border-[var(--gold2)]" />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel>Valor (MT)</FieldLabel>
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

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                  <h2 className="font-serif text-lg text-[var(--ink)]">Despesas registadas</h2>
                  {expenses.length > 0 && <span className="font-mono text-sm font-semibold text-red-400">−{toCurrency(totalExpenses)}</span>}
                </div>
                {expenses.length === 0 ? (
                  <div className="py-14 text-center font-mono text-[11px] text-[var(--faint)]">Sem despesas registadas.</div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {expenses.map(e => (
                      <div key={e.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-[var(--border)] bg-[var(--border)]/30 px-2.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">{CATEGORY_LABELS[e.category] ?? e.category}</span>
                          <span className="text-sm text-[var(--ink)]">{e.description}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-red-400">−{toCurrency(e.amount_mzn)}</span>
                          <button type="button" onClick={() => { setEditingExpenseId(e.id); setExpForm(p => ({ ...p, category: e.category, description: e.description, amount_mzn: String(e.amount_mzn), period_month: e.period_month, period_year: e.period_year })); }}
                            className="rounded-lg border border-[var(--border)] px-2.5 py-1 font-mono text-[10px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">Editar</button>
                          <button type="button" onClick={() => handleDeleteExpense(e.id)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-red-500/30 text-red-400 transition hover:bg-red-500/10"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ RELATÓRIO ══ */}
          {tab === 'report' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="mb-4 font-serif text-lg text-[var(--ink)]">Seleccionar período</h2>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <FieldLabel>Mês</FieldLabel>
                    <select value={expForm.period_month} onChange={e => setExpForm(p => ({ ...p, period_month: Number(e.target.value) }))}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]">
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{MONTH_FORMATTER.format(new Date(expForm.period_year, i))}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <FieldLabel>Ano</FieldLabel>
                    <input type="number" value={expForm.period_year} onChange={e => setExpForm(p => ({ ...p, period_year: Number(e.target.value) }))}
                      className="w-24 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]" />
                  </div>
                  <button type="button" onClick={handleGenerateReport}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-black transition hover:brightness-110">
                    <BarChart3 size={13} /> Gerar relatório
                  </button>
                </div>
              </div>
              {report ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: 'Utilizadores totais', value: String(report.total_subscribers),      tone: 'text-[var(--teal)]',  icon: <Users size={16} /> },
                    { label: 'Assinantes activos',  value: String(report.active_subscribers),     tone: 'text-[var(--green)]', icon: <ShieldCheck size={16} /> },
                    { label: 'Receita bruta',        value: toCurrency(report.revenue_mzn),        tone: 'text-[var(--green)]', icon: <TrendingUp size={16} /> },
                    { label: 'Despesas totais',      value: toCurrency(report.total_expenses_mzn), tone: 'text-red-400',        icon: <ReceiptText size={16} /> },
                    { label: 'Lucro líquido',        value: toCurrency(report.net_margin_mzn),     tone: report.net_margin_mzn >= 0 ? 'text-[var(--green)]' : 'text-red-400', icon: <CircleDollarSign size={16} /> },
                    { label: 'Margem',               value: `${report.margin_pct.toFixed(1)}%`,   tone: report.margin_pct >= 50 ? 'text-[var(--green)]' : 'text-[var(--gold)]', icon: <BarChart3 size={16} /> },
                  ].map(item => <KpiCard key={item.label} {...item} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
                  <FileText size={32} className="text-[var(--faint)] opacity-40" />
                  <p className="font-serif text-lg">Nenhum relatório gerado</p>
                  <p className="font-mono text-[11px] text-[var(--faint)]">Seleccione o período e clique em &quot;Gerar relatório&quot;.</p>
                </div>
              )}
            </div>
          )}

          {/* ══ UTILIZADORES ══ */}
          {tab === 'users' && (
            <div className="space-y-4">
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

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h2 className="font-serif text-lg text-[var(--ink)]">Contas registadas</h2>
                  <p className="font-mono text-[10px] text-[var(--faint)]">{users.length} utilizador(es)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-5 py-3 text-left">
                          <input type="checkbox" checked={users.length > 0 && selectedUserIds.length === users.length}
                            onChange={toggleSelectAllUsers} aria-label="Seleccionar todos" />
                        </th>
                        {['Utilizador', 'Plano', 'Pagamento', 'Criado em', 'Trabalhos'].map(col => (
                          <th key={col} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {users.map(user => {
                        const works = userWorks[user.id] ?? [];
                        const isExpanded = expandedUserId === user.id;
                        return (
                        <Fragment key={user.id}>
                        <tr className="transition hover:bg-[var(--border)]/20">
                          <td className="px-5 py-3.5">
                            <input type="checkbox" checked={selectedUserIds.includes(user.id)}
                              onChange={() => toggleSelectedUser(user.id)} aria-label={`Seleccionar ${user.email ?? user.id}`} />
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
                                  user.payment_status === 'confirmed' ? 'border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]'
                                  : user.payment_status === 'pending'  ? 'border-[var(--gold)]/30 bg-[var(--gold)]/10 text-[var(--gold2)]'
                                  : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>{user.payment_status}</span>
                              : <span className="font-mono text-[11px] text-[var(--faint)]">—</span>}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-[var(--muted)]">
                            {new Date(user.created_at).toLocaleDateString('pt-PT')}
                          </td>
                          <td className="px-5 py-3.5">
                            <button type="button" onClick={() => void loadUserWorks(user.id)}
                              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                              {loadingWorksUserId === user.id ? <RefreshCw size={11} className="animate-spin" /> : <Eye size={11} />}
                              {isExpanded ? 'Ocultar' : 'Ver'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${user.id}-works`} className="bg-[var(--border)]/10">
                            <td colSpan={6} className="px-5 py-4">
                              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <h3 className="font-serif text-base text-[var(--ink)]">Trabalhos académicos criados</h3>
                                    <p className="font-mono text-[10px] text-[var(--faint)]">{works.length} trabalho(s) encontrado(s) para {user.full_name || user.email || 'este utilizador'}</p>
                                  </div>
                                  <button type="button" onClick={() => void loadUserWorks(user.id, true)}
                                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                                    <RefreshCw size={10} /> Actualizar
                                  </button>
                                </div>
                                {works.length === 0 ? (
                                  <p className="py-4 text-center font-mono text-[11px] text-[var(--faint)]">Nenhum trabalho criado por este utilizador.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {works.map(work => (
                                      <div key={work.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium text-[var(--ink)]">{work.topic}</p>
                                          <p className="font-mono text-[10px] text-[var(--faint)]">ID: {work.id}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                                          <span className="rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-2 py-0.5 uppercase text-[var(--gold2)]">{work.work_type === 'project' ? 'Projecto' : 'Académico'}</span>
                                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 uppercase text-[var(--muted)]">{work.status ?? '—'}</span>
                                          <span className="text-[var(--faint)]">Criado: {new Date(work.created_at).toLocaleDateString('pt-PT')}</span>
                                          <span className="text-[var(--faint)]">Actualizado: {new Date(work.updated_at).toLocaleDateString('pt-PT')}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                      })}
                    </tbody>
                  </table>
                  {users.length === 0 && (
                    <div className="py-14 text-center font-mono text-[11px] text-[var(--faint)]">Nenhum utilizador encontrado.</div>
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
