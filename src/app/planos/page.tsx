'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  MessageSquare,
  Moon,
  Sun,
  Sparkles,
  FileDown,
  BookOpen,
  XCircle,
  Zap,
} from 'lucide-react';
import { supabaseClient, useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';

/* ─── Tipos ─── */
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

type PaymentApiErrorPayload = { error?: string; message?: string; retry_after?: number };

/* ─── Helpers ─── */
function formatRetryAfter(s: number) {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function mapPaymentError(p: PaymentApiErrorPayload | null | undefined): string {
  if (!p) return 'Erro inesperado ao iniciar pagamento.';
  if (p.error === 'PAYMENT_ATTEMPT_LIMIT') {
    const retry = typeof p.retry_after === 'number' ? ` Tente em ${formatRetryAfter(p.retry_after)}.` : '';
    return `Já iniciou um pagamento recentemente. Finalize-o ou aguarde antes de tentar novamente.${retry}`;
  }
  if (p.error === 'PAYMENT_ALREADY_REGISTERED')
    return 'Já existe um pagamento iniciado para este plano. Atualize a página e continue no checkout anterior.';
  return p.message || p.error || 'Falha ao iniciar pagamento.';
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  works:    <BarChart3 size={13} />,
  edits:    <Sparkles size={13} />,
  export:   <FileDown size={13} />,
  tcc:      <BookOpen size={13} />,
  chat:     <MessageSquare size={13} />,
  cover:    <Zap size={13} />,
};

function featureList(plan: PlanRow) {
  return [
    { key: 'works',  label: 'Trabalhos',          value: plan.works_limit == null ? 'Ilimitados' : String(plan.works_limit), ok: true },
    { key: 'edits',  label: 'Edições',             value: plan.edits_limit == null ? 'Ilimitadas' : String(plan.edits_limit), ok: true },
    { key: 'export', label: 'Exportação completa', value: plan.export_full ? 'Sim' : 'Não', ok: plan.export_full },
    { key: 'tcc',    label: 'Modo TCC',            value: plan.tcc_enabled ? 'Sim' : 'Não', ok: plan.tcc_enabled },
    { key: 'chat',   label: 'IA Chat',             value: plan.ai_chat_enabled ? 'Sim' : 'Não', ok: plan.ai_chat_enabled },
    { key: 'cover',  label: 'Capa automática',     value: plan.cover_enabled ? 'Sim' : 'Não', ok: plan.cover_enabled },
  ];
}

/* ─── Nav ─── */
function Nav({ themeMode, onToggleTheme }: { themeMode: 'dark' | 'light'; onToggleTheme: () => void }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)]/80 bg-[var(--navBg)]/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
        <div className="flex items-center gap-3">
          <Link href="/landing" className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:text-[var(--gold2)]">
            <ArrowLeft size={12} /> Voltar
          </Link>
          <span className="text-[var(--border)]">·</span>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)]">
              <Image src="/icon.svg" alt="Muneri" width={16} height={16} />
            </div>
            <span className="font-serif text-base italic text-[var(--gold2)]">Muneri</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onToggleTheme}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
            {themeMode === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <Link href="/app"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-black">
            <Zap size={12} /> Abrir app
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─── Card de plano ─── */
function PlanCard({
  plan,
  isCurrent,
  isHighlight,
  paymentMethod,
  onChangeMethod,
  onPay,
  submitting,
  feedback,
}: {
  plan: PlanRow;
  isCurrent: boolean;
  isHighlight: boolean;
  paymentMethod: 'mpesa' | 'emola' | 'card';
  onChangeMethod: (m: 'mpesa' | 'emola' | 'card') => void;
  onPay: () => void;
  submitting: boolean;
  feedback: { type: 'success' | 'error'; text: string } | null;
}) {
  const isFree = Number(plan.price_mzn) < 1;
  const features = featureList(plan);

  return (
    <article className={`relative flex flex-col rounded-2xl border-2 p-7 transition ${
      isHighlight
        ? 'border-[var(--gold)] bg-[var(--heroRight)] shadow-xl shadow-[var(--gold)]/10'
        : 'border-[var(--border)] bg-[var(--surface)]'
    }`}>
      {isHighlight && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold2)] px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-black">
            ★ Recomendado
          </span>
        </div>
      )}

      {isCurrent && (
        <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--green)]">
          <CheckCircle2 size={11} /> Plano actual
        </div>
      )}

      {/* Nome + duração */}
      <div className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{plan.key}</p>
        <h3 className={`mt-1 font-serif text-2xl ${isHighlight ? 'text-[#f1e8da]' : 'text-[var(--ink)]'}`}>{plan.label}</h3>
        <p className="font-mono text-[10px] text-[var(--faint)]">
          {plan.duration_months > 0 ? `Renovação mensal · ${plan.duration_months} mês(es)` : 'Cobrança por obra'}
        </p>
      </div>

      {/* Preço */}
      <div className={`mb-6 rounded-xl border px-5 py-4 ${isHighlight ? 'border-[var(--gold)]/20 bg-[#0f0e0d]' : 'border-[var(--border)] bg-[var(--parchment)]'}`}>
        {isFree ? (
          <p className={`font-serif text-4xl ${isHighlight ? 'text-[var(--gold)]' : 'text-[var(--ink)]'}`}>Grátis</p>
        ) : (
          <>
            <p className={`font-serif text-4xl font-medium ${isHighlight ? 'text-[var(--gold)]' : 'text-[var(--ink)]'}`}>
              {Number(plan.price_mzn).toLocaleString('pt-BR')}
              <span className="font-mono text-lg font-normal text-[var(--faint)]"> MT</span>
            </p>
            {plan.price_usd > 0 && (
              <p className="mt-0.5 font-mono text-[11px] text-[var(--faint)]">≈ ${plan.price_usd.toFixed(2)} USD</p>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <ul className="mb-6 flex-1 space-y-2.5">
        {features.map(f => (
          <li key={f.key} className="flex items-center justify-between gap-3">
            <span className={`flex items-center gap-2 text-sm ${isHighlight ? 'text-[#c8bfb4]' : 'text-[var(--muted)]'}`}>
              <span className={f.ok ? 'text-[var(--gold2)]' : 'text-[var(--faint)]'}>{FEATURE_ICONS[f.key]}</span>
              {f.label}
            </span>
            <span className={`font-mono text-[11px] font-semibold ${f.ok ? isHighlight ? 'text-[var(--gold)]' : 'text-[var(--green)]' : 'text-[var(--faint)]'}`}>
              {f.value}
            </span>
          </li>
        ))}
      </ul>

      {/* Método de pagamento */}
      {!isFree && (
        <div className="mb-4">
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
            Método de pagamento
          </label>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--parchment)] p-1">
            {(['mpesa', 'emola', 'card'] as const).map(m => (
              <button key={m} type="button" onClick={() => onChangeMethod(m)}
                className={`rounded-md py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] transition ${
                  paymentMethod === m
                    ? 'bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black font-semibold'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}>
                {m === 'mpesa' ? 'M-Pesa' : m === 'emola' ? 'e-Mola' : 'Cartão'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 font-mono text-[11px] leading-relaxed ${
          feedback.type === 'success'
            ? 'border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> : <XCircle size={12} className="mt-0.5 shrink-0" />}
          {feedback.text}
        </div>
      )}

      {/* CTA */}
      <button type="button" onClick={onPay} disabled={submitting || isFree}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] transition disabled:opacity-50 ${
          isHighlight
            ? 'bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black shadow-lg hover:scale-[1.01]'
            : 'border-2 border-[var(--border)] text-[var(--ink)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
        }`}>
        {submitting
          ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> A iniciar…</>
          : isFree
            ? <><CheckCircle2 size={14} /> Plano actual</>
            : <><Zap size={14} /> Comprar {plan.label}</>}
      </button>
    </article>
  );
}

/* ════════════════════════════════════════════
   PÁGINA
════════════════════════════════════════════ */
export default function PlanosPage() {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const { profile } = useAuth();

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, 'mpesa' | 'emola' | 'card'>>({});
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
  const [feedbackByPlan, setFeedbackByPlan] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({});

  const themeVars = themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908] [--surface:#141210]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14] [--surface:#ece8df]';

  useEffect(() => {
    (async () => {
      const { data } = await supabaseClient
        .from('plans').select('*').eq('is_active', true).order('price_mzn', { ascending: true });
      setPlans((data as PlanRow[]) ?? []);
      setLoadingPlans(false);
    })();
  }, []);

  async function startPayment(plan: PlanRow) {
    if (Number(plan.price_mzn) < 1) return;
    const method = paymentMethods[plan.key] ?? 'mpesa';
    setSubmittingPlan(plan.key);
    setFeedbackByPlan(p => { const n = { ...p }; delete n[plan.key]; return n; });
    try {
      const res = await fetch('/api/payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_key: plan.key, payment_method: method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(mapPaymentError(data as PaymentApiErrorPayload));
      if (typeof data?.checkout_url !== 'string') throw new Error('Link de checkout não recebido.');
      setFeedbackByPlan(p => ({ ...p, [plan.key]: { type: 'success', text: 'A redireccionar para o checkout…' } }));
      window.location.assign(data.checkout_url);
    } catch (e: any) {
      setFeedbackByPlan(p => ({ ...p, [plan.key]: { type: 'error', text: e?.message || 'Erro inesperado.' } }));
    } finally { setSubmittingPlan(null); }
  }

  /* Plano do meio como destaque (ou o segundo se só houver 2) */
  const highlightIdx = plans.length > 1 ? Math.floor(plans.length / 2) : 0;

  return (
    <div className={`${themeVars} flex min-h-screen flex-col bg-[var(--parchment)] text-[var(--ink)]`}>
      <Nav themeMode={themeMode} onToggleTheme={toggleThemeMode} />

      <div className="flex flex-1 flex-col">

        {/* ══ HERO ══ */}
        <section className="border-b border-[var(--border)] bg-[var(--heroRight)] px-5 py-14 text-center md:py-20">
          <div className="mx-auto max-w-3xl">
            <p className="inline-block rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gold)]">
              Planos e preçário · Muneri 2026
            </p>
            <h1 className="mt-5 font-serif text-4xl leading-tight text-[#f1e8da] sm:text-5xl md:text-6xl">
              Escolha o plano certo <em className="text-[var(--gold)]">para você.</em>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[#c8bfb4] sm:text-lg">
              Comece grátis, actualize quando precisar de mais. Todos os planos incluem exportação em Word e formatação automática.
            </p>
            {profile?.plan_key && (
              <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--green)]/30 bg-[var(--green)]/10 px-4 py-1.5 font-mono text-[11px] text-[var(--green)]">
                <CheckCircle2 size={12} /> Plano actual: <strong>{profile.plan_key}</strong>
              </div>
            )}
          </div>
        </section>

        {/* ══ CARDS DOS PLANOS ══ */}
        <section className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 md:px-8 md:py-16">
          {loadingPlans ? (
            <div className="flex items-center justify-center gap-3 py-24 font-mono text-[12px] text-[var(--faint)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--gold)] border-t-transparent" />
              A carregar planos…
            </div>
          ) : plans.length === 0 ? (
            <div className="py-24 text-center font-mono text-[12px] text-[var(--faint)]">Nenhum plano disponível de momento.</div>
          ) : (
            <div className={`grid gap-5 ${
              plans.length === 1 ? 'max-w-sm mx-auto' :
              plans.length === 2 ? 'sm:grid-cols-2 max-w-2xl mx-auto' :
              plans.length === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' :
              'sm:grid-cols-2 xl:grid-cols-4'
            }`}>
              {plans.map((plan, i) => (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  isCurrent={profile?.plan_key === plan.key}
                  isHighlight={i === highlightIdx}
                  paymentMethod={paymentMethods[plan.key] ?? 'mpesa'}
                  onChangeMethod={m => setPaymentMethods(p => ({ ...p, [plan.key]: m }))}
                  onPay={() => startPayment(plan)}
                  submitting={submittingPlan === plan.key}
                  feedback={feedbackByPlan[plan.key] ?? null}
                />
              ))}
            </div>
          )}

          {/* Notas */}
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Notas sobre preços</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <li className="flex items-start gap-2"><span className="mt-1 text-[var(--gold2)]">·</span> Taxa de câmbio de referência: <span className="font-mono text-[var(--gold2)]">1 USD = 64,05 MZN</span></li>
              <li className="flex items-start gap-2"><span className="mt-1 text-[var(--gold2)]">·</span> Valores em meticais foram arredondados para facilitar cobrança local.</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-[var(--gold2)]">·</span> O plano Avulso é cobrado por obra entregue, sem mensalidade.</li>
              <li className="flex items-start gap-2"><span className="mt-1 text-[var(--gold2)]">·</span> Pagamento processado de forma segura via PaySuite.</li>
            </ul>
          </div>
        </section>

        {/* ══ CTA FINAL ══ */}
        <section className="border-t border-[var(--border)] bg-[var(--heroRight)] px-5 py-14 text-center md:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-serif text-3xl text-[#f1e8da] sm:text-4xl">
              O seu próximo trabalho <em className="text-[var(--gold)]">começa aqui.</em>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[#c8bfb4]">
              Grátis para começar. Sem cartão de crédito. Feito para quem quer terminar o trabalho com tranquilidade.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/app"
                className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-8 py-4 font-mono text-sm font-bold uppercase tracking-[0.08em] text-black shadow-xl transition hover:scale-[1.02]">
                <Zap size={15} /> Começar grátis
              </Link>
              <Link href="/landing"
                className="flex items-center gap-2 rounded-xl border border-[#3a3530] px-8 py-4 font-mono text-sm uppercase tracking-[0.08em] text-[#c8bfb4] transition hover:border-[var(--gold2)] hover:text-[var(--gold)]">
                Ver como funciona
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--border)] px-5 py-6 md:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 text-center md:flex-row md:justify-between md:text-left">
            <div className="flex items-center gap-2">
              <Image src="/icon.svg" alt="Muneri" width={14} height={14} className="opacity-50" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">Muneri · 2026 · Quelimane, Moçambique</span>
            </div>
            <div className="flex gap-5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
              <Link href="/landing" className="hover:text-[var(--gold2)] transition">Landing</Link>
              <Link href="/app" className="hover:text-[var(--gold2)] transition">App</Link>
              <Link href="/app/afiliados" className="hover:text-[var(--gold2)] transition">Afiliados</Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
