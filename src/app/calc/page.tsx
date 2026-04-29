"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  Moon,
  Server,
  Sun,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useThemeMode } from "@/hooks/useThemeMode";

/* ════════════════════════════════════════════
   CONSTANTES
════════════════════════════════════════════ */
const GEMINI = { inputPerMToken: 0.25, outputPerMToken: 1.5 } as const;
const TOKENS_PER_PAGE = { input: 400, output: 550 } as const;
const USD_MZN = 63.5;
const GATEWAY = 0.0648;

const INFRA_COSTS = [
  { id: "vercel",    label: "Vercel Pro",   usd: 10.0,  annual: false },
  { id: "supabase",  label: "Supabase Pro", usd: 10.0,  annual: false },
  { id: "upstash",   label: "Upstash",      usd: 0.6,   annual: false },
  { id: "namecheap", label: "Domínio",      usd: 15.0,  annual: true  },
] as const;

const INFRA_MONTHLY = INFRA_COSTS.map(s => ({
  ...s,
  usdPerMonth: s.annual ? s.usd / 12 : s.usd,
}));

const TOTAL_INFRA_USD = INFRA_MONTHLY.reduce((sum, s) => sum + s.usdPerMonth, 0);
const MARGIN_OPTIONS = [20, 30, 40, 50, 60, 75, 100] as const;

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
function calcGemini(pages: number) {
  const inp = pages * TOKENS_PER_PAGE.input;
  const out = pages * TOKENS_PER_PAGE.output;
  return {
    inputTokens:  inp,
    outputTokens: out,
    inputUSD:     (inp  / 1_000_000) * GEMINI.inputPerMToken,
    outputUSD:    (out  / 1_000_000) * GEMINI.outputPerMToken,
    get totalUSD() { return this.inputUSD + this.outputUSD; },
  };
}

const f2  = (n: number) => n.toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f4  = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const pct = (n: number) => `${n.toFixed(1)}%`;

/* ════════════════════════════════════════════
   ATOMS
════════════════════════════════════════════ */
function SliderField({ id, label, min, max, step = 1, value, onChange, hint }: {
  id: string; label: string; min: number; max: number;
  step?: number; value: number; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[12px] text-[var(--muted)]">{label}</label>
        <span className="font-mono text-[12px] font-semibold text-[var(--gold2)]">{value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-[var(--gold2)]"
        style={{ accentColor: "var(--gold2)" }} />
      {hint && <p className="font-mono text-[10px] text-[var(--faint)]">{hint}</p>}
    </div>
  );
}

function MetricRow({ label, value, accent, divider = true }: {
  label: string; value: string; accent?: string; divider?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${divider ? "border-b border-[var(--border)]" : ""}`}>
      <span className="text-[12px] text-[var(--muted)]">{label}</span>
      <span className={`font-mono text-[12px] font-semibold tabular-nums ${accent ?? "text-[var(--ink)]"}`}>{value}</span>
    </div>
  );
}

function KpiTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--faint)]">{label}</p>
      <p className={`mt-2 font-serif text-xl tabular-nums ${accent ?? "text-[var(--ink)]"}`}>{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[10px] text-[var(--faint)]">{sub}</p>}
    </div>
  );
}

/* ════════════════════════════════════════════
   PÁGINA
════════════════════════════════════════════ */
export default function CalcPage() {
  const { themeMode, toggleThemeMode } = useThemeMode();

  const themeVars = themeMode === "dark"
    ? "[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908] [--surface:#141210]"
    : "[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14] [--surface:#ece8df]";

  /* ── State ── */
  const [pages,   setPages]   = useState(12);
  const [margin,  setMargin]  = useState(50);
  const [users,   setUsers]   = useState(5);
  const [works,   setWorks]   = useState(3);
  const [extra,   setExtra]   = useState(0);

  /* ── Computed ── */
  const calc = useMemo(() => {
    const g           = calcGemini(pages);
    const geminiMZN   = g.totalUSD * USD_MZN;
    const infraPerWork = TOTAL_INFRA_USD / users / works;
    const infraMZN    = infraPerWork * USD_MZN;
    const baseMZN     = geminiMZN + infraMZN + extra;
    const netMZN      = baseMZN * (1 + margin / 100);
    const grossMZN    = netMZN / (1 - GATEWAY);
    const gateMZN     = grossMZN * GATEWAY;
    const profitMZN   = grossMZN - gateMZN - baseMZN;
    const marginReal  = (profitMZN / grossMZN) * 100;

    return {
      g, geminiMZN,
      infraPerWork, infraMZN,
      baseMZN, netMZN,
      grossMZN, gateMZN,
      profitMZN, marginReal,
      costPerPage: baseMZN / pages,
    };
  }, [pages, margin, users, works, extra]);

  /* ── Render ── */
  return (
    <div className={`${themeVars} flex h-screen flex-col overflow-hidden bg-[var(--parchment)] text-[var(--ink)]`}>

      {/* ── Topbar ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--navBg)] px-5 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <Link href="/admin"
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:text-[var(--gold2)]">
            <ArrowLeft size={12} /> Admin
          </Link>
          <span className="text-[var(--border)]">·</span>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)]">
              <Image src="/icon.svg" alt="Muneri" width={16} height={16} />
            </div>
            <div>
              <span className="font-serif text-base italic text-[var(--gold2)]">Muneri</span>
              <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--faint)]">· Calculadora de custo</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-[var(--faint)] md:block">
            Gemini 3.1 Flash-Lite · 1 USD = {USD_MZN} MZN · Emola {(GATEWAY * 100).toFixed(2)}%
          </span>
          <button type="button" onClick={toggleThemeMode}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
            {themeMode === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </header>

      {/* ── Body: split layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ════ PAINEL ESQUERDO — Inputs ════ */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--navBg)]">
          <div className="space-y-6 p-5">

            {/* Parâmetros do trabalho */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Zap size={13} className="text-[var(--gold2)]" />
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--faint)]">Parâmetros do trabalho</p>
              </div>

              <div className="space-y-5">
                <SliderField id="pages" label="Número de páginas" min={1} max={20} value={pages}
                  onChange={setPages} hint="Recomendado: 12–15 páginas" />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] text-[var(--muted)]">Margem de lucro</label>
                    <span className="font-mono text-[12px] font-semibold text-[var(--gold2)]">{margin}%</span>
                  </div>
                  <input type="range" min={10} max={200} step={5} value={margin}
                    onChange={e => setMargin(Number(e.target.value))}
                    className="w-full cursor-pointer" style={{ accentColor: "var(--gold2)" }} />
                  <div className="flex flex-wrap gap-1.5">
                    {MARGIN_OPTIONS.map(m => (
                      <button key={m} type="button" onClick={() => setMargin(m)}
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition ${
                          margin === m
                            ? "border-[var(--gold)] bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black"
                            : "border-[var(--border)] text-[var(--faint)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
                        }`}>{m}%</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] text-[var(--muted)]">Custo adicional (MZN)</label>
                    <span className="font-mono text-[10px] text-[var(--faint)]">mão-de-obra etc.</span>
                  </div>
                  <input type="number" min={0} step={10} value={extra}
                    onChange={e => setExtra(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-[12px] text-[var(--ink)] outline-none placeholder-[var(--faint)] transition focus:border-[var(--gold2)]"
                    placeholder="0" />
                </div>
              </div>
            </section>

            <div className="border-t border-[var(--border)]" />

            {/* Infraestrutura */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Server size={13} className="text-[var(--teal)]" />
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--faint)]">Infraestrutura</p>
              </div>

              <div className="mb-4 space-y-2">
                {INFRA_MONTHLY.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)]/40 px-3 py-2">
                    <div>
                      <p className="text-[11px] font-medium text-[var(--ink)]">{s.label}</p>
                      <p className="font-mono text-[10px] text-[var(--faint)]">
                        {s.annual ? `$${s.usd}/ano` : `$${s.usd}/mês`}
                        {" · "}≈ ${s.usdPerMonth.toFixed(2)}/mês
                      </p>
                    </div>
                    <span className="font-mono text-[10px] font-semibold text-[var(--teal)]">
                      {f2((s.usdPerMonth / users / works) * USD_MZN)} MT
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-5">
                <SliderField id="users" label="Utilizadores a pagar" min={1} max={50} value={users}
                  onChange={setUsers}
                  hint={`$${(TOTAL_INFRA_USD / users).toFixed(2)} USD/utilizador/mês`} />
                <SliderField id="works" label="Trabalhos/utilizador/mês" min={1} max={20} value={works}
                  onChange={setWorks} />
              </div>
            </section>

          </div>
        </aside>

        {/* ════ ÁREA PRINCIPAL — Resultados ════ */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-[var(--heroRight)] px-6 py-6 md:px-8">

          {/* KPIs no topo */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile label="Cobrar ao cliente"
              value={`${f2(calc.grossMZN)} MT`}
              accent="text-[var(--gold)]" />
            <KpiTile label="Lucro líquido"
              value={`${f2(calc.profitMZN)} MT`}
              sub={`${pct(calc.marginReal)} real`}
              accent="text-[var(--green)]" />
            <KpiTile label="Taxa gateway"
              value={`${f2(calc.gateMZN)} MT`}
              sub="Emola 6.48%"
              accent="text-red-400" />
            <KpiTile label="Custo / página"
              value={`${f2(calc.costPerPage)} MT`}
              accent="text-[var(--teal)]" />
          </div>

          {/* Grid de detalhes */}
          <div className="grid flex-1 gap-4 lg:grid-cols-2">

            {/* ── Custo IA ── */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-[var(--gold2)]" />
                  <h2 className="font-serif text-base text-[var(--ink)]">Custo Gemini</h2>
                </div>
                <span className="font-mono text-[10px] text-[var(--faint)]">{pages} págs.</span>
              </div>

              <MetricRow label="Tokens input"  value={calc.g.inputTokens.toLocaleString("pt-MZ")} />
              <MetricRow label="Tokens output" value={calc.g.outputTokens.toLocaleString("pt-MZ")} />
              <MetricRow label="Custo input"   value={`$${f4(calc.g.inputUSD)}`} />
              <MetricRow label="Custo output"  value={`$${f4(calc.g.outputUSD)}`} />
              <MetricRow label="Total USD"      value={`$${f4(calc.g.totalUSD)}`} accent="text-[var(--gold2)]" />
              <MetricRow label="Total MZN" value={`${f2(calc.geminiMZN)} MT`} accent="text-[var(--gold2)]" divider={false} />
            </section>

            {/* ── Infra por trabalho ── */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={13} className="text-[var(--teal)]" />
                  <h2 className="font-serif text-base text-[var(--ink)]">Infra por trabalho</h2>
                </div>
                <span className="font-mono text-[10px] text-[var(--faint)]">{users} utilizadores · {works} trab./mês</span>
              </div>

              <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--parchment)]/30 px-4 py-2.5 font-mono text-[11px] text-[var(--faint)]">
                ${TOTAL_INFRA_USD.toFixed(2)}/mês ÷ {users} utilizadores ÷ {works} trabalhos
                <span className="ml-2 text-[var(--teal)] font-semibold">= ${f4(calc.infraPerWork)}</span>
              </div>

              {INFRA_MONTHLY.map(s => (
                <MetricRow key={s.id}
                  label={s.label}
                  value={`${f2((s.usdPerMonth / users / works) * USD_MZN)} MT`} />
              ))}
              <MetricRow label="Total infra" value={`${f2(calc.infraMZN)} MT`} accent="text-[var(--teal)]" divider={false} />
            </section>

            {/* ── Decomposição do preço ── */}
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 size={13} className="text-[var(--green)]" />
                <h2 className="font-serif text-base text-[var(--ink)]">Decomposição do preço</h2>
              </div>

              <MetricRow label="Custo IA (MZN)"         value={`${f2(calc.geminiMZN)} MT`} />
              <MetricRow label="Custo infra (MZN)"      value={`${f2(calc.infraMZN)} MT`} />
              {extra > 0 && <MetricRow label="Custo adicional" value={`${f2(extra)} MT`} />}
              <MetricRow label="Custo base total"        value={`${f2(calc.baseMZN)} MT`} accent="text-[var(--gold2)]" />
              <MetricRow label={`Margem (${margin}%)`}  value={`+ ${f2(calc.netMZN - calc.baseMZN)} MT`} />
              <MetricRow label="Receita líquida"         value={`${f2(calc.netMZN)} MT`} />
              <MetricRow label={`Gateway (${(GATEWAY * 100).toFixed(2)}%)`} value={`− ${f2(calc.gateMZN)} MT`} accent="text-red-400" divider={false} />
            </section>

            {/* ── Resumo final ── */}
            <section className="flex flex-col rounded-2xl border border-[var(--gold)]/30 bg-[var(--surface)] p-5">
              <div className="mb-4 flex items-center gap-2">
                <CircleDollarSign size={13} className="text-[var(--gold2)]" />
                <h2 className="font-serif text-base text-[var(--ink)]">Resultado final</h2>
              </div>

              {/* Destaque do preço */}
              <div className="mb-4 rounded-xl border border-[var(--gold)]/20 bg-[#0f0e0d] p-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--gold)]">Cobrar ao cliente</p>
                <p className="mt-2 font-serif text-4xl text-[#f1e8da] tabular-nums">{f2(calc.grossMZN)}</p>
                <p className="font-mono text-base text-[var(--gold)]">MT</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--parchment)]/20 p-3 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--faint)]">Você recebe</p>
                  <p className="mt-1 font-serif text-xl text-[var(--green)] tabular-nums">{f2(calc.netMZN)} MT</p>
                  <p className="font-mono text-[9px] text-[var(--faint)]">após gateway</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--parchment)]/20 p-3 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--faint)]">Lucro líquido</p>
                  <p className="mt-1 font-serif text-xl text-[var(--green)] tabular-nums">{f2(calc.profitMZN)} MT</p>
                  <p className="font-mono text-[9px] text-[var(--faint)]">{pct(calc.marginReal)} real</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--parchment)]/10 px-4 py-3">
                <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                  <span>Margem pretendida</span>
                  <span className="font-mono font-semibold text-[var(--gold2)]">{margin}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold2)] transition-all"
                    style={{ width: `${Math.min(100, margin / 2)}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
                  <span>Margem real</span>
                  <span className={`font-mono font-semibold ${calc.marginReal >= margin ? "text-[var(--green)]" : "text-red-400"}`}>
                    {pct(calc.marginReal)}
                  </span>
                </div>
              </div>

              {/* Nota de rodapé */}
              <p className="mt-auto pt-5 font-mono text-[9px] leading-relaxed text-[var(--faint)]">
                {TOKENS_PER_PAGE.input} tok. input + {TOKENS_PER_PAGE.output} tok. output por pág. ·
                {" "}Infra: ${TOTAL_INFRA_USD.toFixed(2)}/mês ·
                {" "}1 USD = {USD_MZN} MZN · Emola {(GATEWAY * 100).toFixed(2)}% (PaySuite 3.48% + gateway 3%)
              </p>
            </section>

          </div>
        </main>

      </div>
    </div>
  );
}
