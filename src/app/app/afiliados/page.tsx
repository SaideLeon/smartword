'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Gift,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

/* ─── Tipos ─── */
interface AffiliateRecord {
  id: string;
  code: string;
  total_referrals: number;
  total_converted: number;
  total_commission_mzn: number;
  pending_commission_mzn: number;
  paid_commission_mzn: number;
}

interface Referral {
  id: string;
  status: string;
  registered_at: string;
  converted_at: string | null;
  referred_user?: { full_name: string | null; email: string | null } | null;
  commissions?: Array<{
    id: string;
    payment_amount_mzn: number;
    commission_mzn: number;
    commission_rate: number;
    status: string;
    created_at: string;
  }>;
}

interface AffiliatePayload {
  exists: boolean;
  affiliate: AffiliateRecord | null;
  referrals?: Referral[];
}

/* ─── Formatadores ─── */
const fmt = new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });

/* ─── Componente KPI ─── */
function KpiCard({ label, value, hint, icon, accent }: { label: string; value: string; hint: string; icon: React.ReactNode; accent?: string }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--parchment)] p-6">
      <div className={`absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl ${accent ?? 'bg-[var(--gold)]/10 text-[var(--gold2)]'}`}>
        {icon}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{label}</p>
      <p className="mt-3 font-serif text-3xl text-[var(--ink)]">{value}</p>
      <p className="mt-1 font-mono text-[10px] text-[var(--faint)]">{hint}</p>
    </article>
  );
}

/* ─── Status badge ─── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    converted:  { label: 'Convertido',  cls: 'border-[var(--green)]/40 bg-[var(--green)]/10 text-[var(--green)]' },
    registered: { label: 'Registrado',  cls: 'border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[var(--gold)]' },
    pending:    { label: 'Pendente',    cls: 'border-[var(--faint)]/40 bg-[var(--faint)]/10 text-[var(--faint)]' },
  };
  const s = map[status] ?? { label: status, cls: 'border-[var(--border)] text-[var(--muted)]' };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${s.cls}`}>
      {s.label}
    </span>
  );
}

/* ─── Sidebar ─── */
function Sidebar({ themeMode, onToggleTheme }: { themeMode: 'dark' | 'light'; onToggleTheme: () => void }) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--navBg)]">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)]">
          <Image src="/icon.svg" alt="Muneri" width={18} height={18} />
        </div>
        <span className="font-serif text-lg italic text-[var(--gold2)]">Muneri</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--faint)]">Menu</p>

        <Link href="/app/afiliados"
          className="flex items-center gap-2.5 rounded-lg bg-gradient-to-r from-[var(--gold)]/15 to-transparent px-3 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--gold2)]">
          <LayoutDashboard size={14} /> Dashboard
        </Link>

        <Link href="/app"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:bg-[var(--border)]/40 hover:text-[var(--ink)]">
          <Zap size={14} /> Editor
        </Link>

        <Link href="/planos"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:bg-[var(--border)]/40 hover:text-[var(--ink)]">
          <BarChart3 size={14} /> Planos
        </Link>
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--border)] px-3 py-3 space-y-1">
        <button type="button" onClick={onToggleTheme}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:bg-[var(--border)]/40 hover:text-[var(--ink)]">
          {themeMode === 'dark' ? <><Sun size={13} /> Modo claro</> : <><Moon size={13} /> Modo escuro</>}
        </button>
        <Link href="/app"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:bg-[var(--border)]/40 hover:text-[var(--ink)]">
          <LogOut size={13} /> Sair
        </Link>
      </div>
    </aside>
  );
}

/* ─── Página principal ─── */
export default function AffiliateDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<AffiliatePayload | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  const themeVars = themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908] [--surface:#141210]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14] [--surface:#ece8df]';

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/affiliate?referrals=true', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar.');
        if (!active) return;
        setPayload(json as AffiliatePayload);
        if (json?.affiliate?.code) {
          setShareLink(`${window.location.origin}/auth/signup?ref=${json.affiliate.code}`);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Erro inesperado.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const createAffiliate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/affiliate', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao ativar.');
      setPayload({ exists: true, affiliate: json.affiliate, referrals: [] });
      setShareLink(json.link ?? `${window.location.origin}/auth/signup?ref=${json.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const affiliate = payload?.affiliate;
  const referrals = useMemo(() => payload?.referrals ?? [], [payload?.referrals]);

  /* ── Layout raiz ── */
  return (
    <div className={`${themeVars} flex h-screen overflow-hidden bg-[var(--heroRight)] text-[var(--ink)]`}>
      {/* Sidebar — desktop */}
      <div className="hidden md:block">
        <Sidebar themeMode={themeMode} onToggleTheme={toggleThemeMode} />
      </div>

      {/* Área principal */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Topbar */}
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--navBg)] px-5 py-3 md:px-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Muneri · Programa de afiliados</p>
            <h1 className="font-serif text-xl text-[var(--ink)]">
              {affiliate ? 'Dashboard de afiliado' : 'Ativar perfil de afiliado'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Tema — mobile */}
            <button type="button" onClick={toggleThemeMode}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)] md:hidden">
              {themeMode === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <Link href="/app"
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
              <Zap size={11} /> Editor
            </Link>
          </div>
        </header>

        {/* Conteúdo scrollável */}
        <main className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">

          {/* Erro */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-[12px] text-red-400">
              {error}
            </div>
          )}

          {/* Loading */}
          {(authLoading || loading) && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
              <span className="font-mono text-[12px] text-[var(--muted)]">A carregar dados…</span>
            </div>
          )}

          {/* Não autenticado */}
          {!authLoading && !loading && !user && (
            <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--gold)]/10 text-[var(--gold2)]">
                <Users size={28} strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="font-serif text-2xl">Acesso restrito</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Precisa de estar autenticado para aceder ao programa de afiliados.</p>
              </div>
              <Link href="/auth/login"
                className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-black">
                Fazer login <ChevronRight size={13} />
              </Link>
            </div>
          )}

          {/* Activação — utilizador sem perfil de afiliado */}
          {!authLoading && !loading && user && !affiliate && (
            <div className="mx-auto max-w-2xl">
              {/* Hero de activação */}
              <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center md:p-12">
                <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
                  style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #d4b37b 0%, transparent 60%)' }} />
                <div className="relative">
                  <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)]/20 to-transparent border border-[var(--gold)]/20 text-[var(--gold)]">
                    <HandCoins size={28} strokeWidth={1.5} />
                  </div>
                  <h2 className="font-serif text-3xl">Comece a ganhar hoje</h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
                    Active o seu perfil de afiliado com um clique. Receba um link pessoal, acompanhe indicações e ganhe comissão por cada assinatura convertida.
                  </p>

                  <div className="mx-auto mt-8 grid max-w-md gap-3 text-left">
                    {[
                      'Link de indicação exclusivo e rastreável',
                      'Dashboard com métricas em tempo real',
                      'Comissão automática por cada conversão',
                      'Sem custo — activação em 1 minuto',
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2.5 text-sm text-[var(--muted)]">
                        <CheckCircle2 size={14} className="shrink-0 text-[var(--green)]" />
                        {item}
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={createAffiliate} disabled={submitting}
                    className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] py-4 font-mono text-sm font-bold uppercase tracking-[0.08em] text-black shadow-lg transition hover:scale-[1.01] disabled:opacity-60">
                    {submitting
                      ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" /> A ativar…</>
                      : <><Gift size={15} /> Activar perfil de afiliado</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard — utilizador com afiliado activo */}
          {!authLoading && !loading && user && affiliate && (
            <div className="space-y-6">

              {/* ── KPIs ── */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Indicações totais"
                  value={String(affiliate.total_referrals ?? 0)}
                  hint="Pessoas registadas com o seu link"
                  icon={<Users size={16} />}
                  accent="bg-[var(--teal)]/10 text-[var(--teal)]"
                />
                <KpiCard
                  label="Convertidos"
                  value={String(affiliate.total_converted ?? 0)}
                  hint="Subscritores confirmados"
                  icon={<TrendingUp size={16} />}
                  accent="bg-[var(--green)]/10 text-[var(--green)]"
                />
                <KpiCard
                  label="A receber"
                  value={fmt.format(affiliate.pending_commission_mzn ?? 0)}
                  hint="Comissões pendentes de pagamento"
                  icon={<Wallet size={16} />}
                  accent="bg-[var(--gold)]/10 text-[var(--gold2)]"
                />
                <KpiCard
                  label="Total ganho"
                  value={fmt.format(affiliate.total_commission_mzn ?? 0)}
                  hint="Acumulado desde o início"
                  icon={<HandCoins size={16} />}
                  accent="bg-[var(--gold)]/10 text-[var(--gold2)]"
                />
              </div>

              {/* ── Link + Código ── */}
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                {/* Link de partilha */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Seu link de indicação</p>
                      <p className="mt-1 break-all font-mono text-[12px] text-[var(--ink)]">
                        {shareLink || `— código: ${affiliate.code} —`}
                      </p>
                    </div>
                    <button type="button" onClick={copyLink}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] transition ${copied
                        ? 'border-[var(--green)]/40 bg-[var(--green)]/10 text-[var(--green)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'}`}>
                      <Copy size={12} />
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Use este link para se registar no Muneri: ${shareLink}`)}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                      <ExternalLink size={11} /> WhatsApp
                    </a>
                    <a href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('Regista-te no Muneri com o meu link!')}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                      <ExternalLink size={11} /> Telegram
                    </a>
                  </div>
                </div>

                {/* Taxa de conversão */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center md:min-w-[160px]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Conversão</p>
                  <p className="mt-3 font-serif text-4xl text-[var(--gold2)]">
                    {affiliate.total_referrals > 0
                      ? `${Math.round((affiliate.total_converted / affiliate.total_referrals) * 100)}%`
                      : '—'}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-[var(--faint)]">
                    {affiliate.total_converted} de {affiliate.total_referrals}
                  </p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold2)] transition-all"
                      style={{ width: affiliate.total_referrals > 0 ? `${(affiliate.total_converted / affiliate.total_referrals) * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>

              {/* ── Tabela de indicações ── */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                  <div>
                    <h2 className="font-serif text-lg text-[var(--ink)]">Indicações recentes</h2>
                    <p className="font-mono text-[10px] text-[var(--faint)]">{referrals.length} registo(s) encontrado(s)</p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
                    <ArrowUpRight size={10} /> Actualizado agora
                  </span>
                </div>

                {referrals.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--border)] text-[var(--faint)]">
                      <Users size={20} strokeWidth={1.5} />
                    </div>
                    <p className="font-serif text-lg text-[var(--ink)]">Ainda sem indicações</p>
                    <p className="max-w-xs text-sm text-[var(--muted)]">Partilhe o seu link com colegas e grupos para começar a ganhar comissões.</p>
                    <button type="button" onClick={copyLink}
                      className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--gold2)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--gold2)] transition hover:bg-[var(--gold2)] hover:text-black">
                      <Copy size={11} /> Copiar link
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          {['Utilizador', 'Registado', 'Estado', 'Comissão', ''].map(col => (
                            <th key={col} className="px-6 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.map((r, i) => {
                          const commission = r.commissions?.reduce((t, c) => t + c.commission_mzn, 0) ?? 0;
                          const name = r.referred_user?.full_name ?? r.referred_user?.email ?? '—';
                          const email = r.referred_user?.email;
                          return (
                            <tr key={r.id} className={`transition hover:bg-[var(--border)]/20 ${i < referrals.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>
                              <td className="px-6 py-3.5">
                                <p className="font-medium text-[var(--ink)]">{name}</p>
                                {email && name !== email && <p className="font-mono text-[11px] text-[var(--faint)]">{email}</p>}
                              </td>
                              <td className="px-6 py-3.5 font-mono text-[11px] text-[var(--muted)]">
                                {fmtDate(r.registered_at)}
                              </td>
                              <td className="px-6 py-3.5">
                                <StatusBadge status={r.status} />
                              </td>
                              <td className="px-6 py-3.5 font-mono text-[12px] text-[var(--ink)]">
                                {commission > 0 ? fmt.format(commission) : '—'}
                              </td>
                              <td className="px-6 py-3.5">
                                {r.converted_at && (
                                  <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--green)]">
                                    <CheckCircle2 size={10} /> {fmtDate(r.converted_at)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Dicas de crescimento ── */}
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { icon: <Users size={16} />, title: 'Grupos de WhatsApp', text: 'Partilhe em grupos de estudantes universitários. São os mais receptivos ao Muneri.' },
                  { icon: <ExternalLink size={16} />, title: 'Redes sociais', text: 'Um post no Instagram ou TikTok pode gerar dezenas de conversões de uma só vez.' },
                  { icon: <TrendingUp size={16} />, title: 'Época de entrega', text: 'O volume aumenta muito nas épocas de entrega de trabalhos. Partilhe antes dessas datas.' },
                ].map(({ icon, title, text }) => (
                  <div key={title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-[var(--gold)]/10 px-2.5 py-1.5 text-[var(--gold2)]">{icon}</div>
                    <h3 className="font-serif text-base text-[var(--ink)]">{title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{text}</p>
                  </div>
                ))}
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
