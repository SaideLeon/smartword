"use client";

import { useState, useMemo } from "react";
import { useThemeMode } from "@/hooks/useThemeMode";

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_PRICING = {
  inputPerMToken: 0.25,
  outputPerMToken: 1.5,
} as const;

const TOKENS_PER_PAGE = {
  input: 400,
  output: 550,
} as const;

const USD_TO_MZN = 63.5;

/**
 * All fixed infrastructure costs.
 * annual: true  → value is per year, converted to /month automatically
 * annual: false → value is per month
 */
const INFRA_COSTS = [
  { id: "vercel",    label: "Vercel Pro",   usd: 10.0,  annual: false },
  { id: "supabase",  label: "Supabase Pro", usd: 10.0,  annual: false },
  { id: "upstash",   label: "Upstash",      usd: 0.6,   annual: false },
  { id: "namecheap", label: "Domínio",      usd: 15.0,  annual: true  },
] as const;

/** Normalise every cost to USD/month */
const INFRA_MONTHLY = INFRA_COSTS.map((s) => ({
  ...s,
  usdPerMonth: s.annual ? s.usd / 12 : s.usd,
}));

const TOTAL_INFRA_USD = INFRA_MONTHLY.reduce((sum, s) => sum + s.usdPerMonth, 0);

const GATEWAY_RATE = 0.0648;

const MARGIN_OPTIONS = [20, 30, 40, 50, 60, 75, 100] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcGeminiCostUSD(pages: number) {
  const inputTokens   = pages * TOKENS_PER_PAGE.input;
  const outputTokens  = pages * TOKENS_PER_PAGE.output;
  const inputCostUSD  = (inputTokens  / 1_000_000) * GEMINI_PRICING.inputPerMToken;
  const outputCostUSD = (outputTokens / 1_000_000) * GEMINI_PRICING.outputPerMToken;
  return { inputTokens, outputTokens, inputCostUSD, outputCostUSD, totalCostUSD: inputCostUSD + outputCostUSD };
}

function grossForNet(netMZN: number) {
  return netMZN / (1 - GATEWAY_RATE);
}

const fmtMZN  = (n: number) => n.toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD  = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const fmtUSD2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)] mb-4">
      {children}
    </p>
  );
}

function Row({
  label, value, sub, highlight, dimmed,
}: {
  label: string; value: string; sub?: string;
  highlight?: "danger" | "success" | "info"; dimmed?: boolean;
}) {
  const colorMap = {
    danger:  "text-red-400",
    success: "text-[var(--green)]",
    info:    "text-[var(--gold2)]",
  };
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
      <div>
        <span className={`text-[13px] ${dimmed ? "text-[var(--faint)]" : "text-[var(--muted)]"}`}>
          {label}
        </span>
        {sub && (
          <span className="ml-2 font-mono text-[10px] text-[var(--faint)]">{sub}</span>
        )}
      </div>
      <span
        className={`text-[14px] tabular-nums font-medium ${
          highlight
            ? colorMap[highlight]
            : dimmed
            ? "text-[var(--faint)]"
            : "text-[var(--ink)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Slider({ id, min, max, value, onChange, step = 1 }: {
  id: string; min: number; max: number; value: number;
  onChange: (v: number) => void; step?: number;
}) {
  return (
    <input
      id={id} type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full cursor-pointer accent-[var(--gold2)]"
      style={{ accentColor: "var(--gold2)" }}
    />
  );
}

function StatCard({ label, value, color, sub }: {
  label: string; value: string; color: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--ink)]/[0.03] p-4 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)] mb-1 leading-tight">
        {label}
      </p>
      <p className={`text-[15px] font-medium tabular-nums ${color}`}>{value}</p>
      {sub && (
        <p className="font-mono text-[10px] text-[var(--faint)] mt-0.5">{sub}</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AcademicCostCalculator() {
  const { themeMode } = useThemeMode();

  const themeVars =
    themeMode === "dark"
      ? "[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]"
      : "[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]";

  const [pages,              setPages]         = useState(12);
  const [marginPct,          setMarginPct]     = useState(50);
  const [minUsers,           setMinUsers]      = useState(5);
  const [worksPerUserPerMonth, setWorksPerUser] = useState(3);
  const [extraCostMZN,       setExtraCostMZN]  = useState(0);

  const calc = useMemo(() => {
    const gemini        = calcGeminiCostUSD(pages);
    const geminiCostMZN = gemini.totalCostUSD * USD_TO_MZN;

    const infraBreakdown = INFRA_MONTHLY.map((s) => ({
      ...s,
      perWorkUSD: s.usdPerMonth / minUsers / worksPerUserPerMonth,
      perWorkMZN: (s.usdPerMonth / minUsers / worksPerUserPerMonth) * USD_TO_MZN,
    }));

    const infraPerWorkUSD    = TOTAL_INFRA_USD / minUsers / worksPerUserPerMonth;
    const infraPerWorkMZN    = infraPerWorkUSD * USD_TO_MZN;
    const totalBaseCostMZN   = geminiCostMZN + infraPerWorkMZN + extraCostMZN;
    const desiredNetMZN      = totalBaseCostMZN * (1 + marginPct / 100);
    const grossPriceMZN      = grossForNet(desiredNetMZN);
    const gatewayFeeMZN      = grossPriceMZN * GATEWAY_RATE;
    const netReceivedMZN     = grossPriceMZN - gatewayFeeMZN;
    const profitMZN          = netReceivedMZN - totalBaseCostMZN;
    const costPerPageMZN     = totalBaseCostMZN / pages;

    return {
      gemini, geminiCostMZN,
      infraPerWorkUSD, infraPerWorkMZN, infraBreakdown,
      totalBaseCostMZN, desiredNetMZN,
      grossPriceMZN, gatewayFeeMZN,
      netReceivedMZN, profitMZN, costPerPageMZN,
    };
  }, [pages, marginPct, minUsers, worksPerUserPerMonth, extraCostMZN]);

  return (
    <main className={`${themeVars} min-h-screen bg-[var(--parchment)] text-[var(--ink)] px-4 py-12`}>
      <div className="max-w-xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)] mb-3">
            Ferramenta interna · Muneri
          </p>
          <h1 className="font-serif text-[1.9rem] leading-[1.2] sm:text-4xl text-[var(--ink)]">
            Calculadora de <em className="text-[var(--gold2)]">Custo</em>
          </h1>
          <p className="text-sm leading-relaxed text-[var(--muted)] mt-2">
            Gemini 3.1 Flash-Lite · Emola 6,48% · 4 serviços
          </p>
        </div>

        {/* ── Work parameters ── */}
        <div className="rounded-2xl border border-[var(--border)] p-5 space-y-6">
          <SectionLabel>Parâmetros do trabalho</SectionLabel>

          {/* Pages slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label htmlFor="pages-slider" className="text-[13px] text-[var(--muted)]">
                Número de páginas
              </label>
              <span className="font-mono text-[13px] font-medium text-[var(--ink)]">
                {pages} pág.
              </span>
            </div>
            <Slider id="pages-slider" min={1} max={20} value={pages} onChange={setPages} />
            <div className="flex justify-between mt-1 font-mono text-[10px] text-[var(--faint)]">
              <span>1</span><span>Recomendado: 12–15</span><span>20</span>
            </div>
          </div>

          {/* Margin slider + pill buttons */}
          <div>
            <div className="flex justify-between mb-2">
              <label htmlFor="margin-slider" className="text-[13px] text-[var(--muted)]">
                Margem de lucro desejada
              </label>
              <span className="font-mono text-[13px] font-medium text-[var(--gold2)]">
                {marginPct}%
              </span>
            </div>
            <Slider id="margin-slider" min={10} max={200} step={5} value={marginPct} onChange={setMarginPct} />
            <div className="flex gap-2 mt-3 flex-wrap">
              {MARGIN_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMarginPct(m)}
                  className={[
                    "font-mono text-[11px] uppercase tracking-[0.1em] px-3 py-1 rounded-full border transition-all",
                    marginPct === m
                      ? "bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] border-[var(--gold)] text-[var(--parchment)]"
                      : "border-[var(--border)] text-[var(--faint)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]",
                  ].join(" ")}
                >
                  {m}%
                </button>
              ))}
            </div>
          </div>

          {/* Extra cost input */}
          <div>
            <div className="flex justify-between mb-2">
              <label htmlFor="extra-cost" className="text-[13px] text-[var(--muted)]">
                Custo fixo adicional (MZN)
              </label>
              <span className="font-mono text-[10px] text-[var(--faint)]">ex: mão-de-obra</span>
            </div>
            <input
              id="extra-cost"
              type="number"
              min={0}
              step={10}
              value={extraCostMZN}
              onChange={(e) => setExtraCostMZN(Math.max(0, Number(e.target.value)))}
              className="w-full rounded border border-[var(--border)] bg-transparent px-3 py-2.5 font-mono text-sm text-[var(--ink)] placeholder-[var(--faint)] outline-none transition focus:border-[var(--gold2)]"
              placeholder="0"
            />
          </div>
        </div>

        {/* ── Infrastructure ── */}
        <div className="rounded-2xl border border-[var(--border)] p-5 space-y-6">
          <SectionLabel>
            Infraestrutura — US$ {fmtUSD2(TOTAL_INFRA_USD)}/mês total
          </SectionLabel>

          {/* Service cards */}
          <div className="grid grid-cols-2 gap-3">
            {calc.infraBreakdown.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--ink)]/[0.03] p-3"
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="text-[12px] font-medium text-[var(--ink)]">{s.label}</p>
                  {s.annual && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] bg-[var(--gold)]/20 text-[var(--gold2)] px-1.5 py-0.5 rounded">
                      anual
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--faint)]">
                  {s.annual
                    ? `US$ ${s.usd}/ano → US$ ${fmtUSD2(s.usdPerMonth)}/mês`
                    : `US$ ${s.usd}/mês`}
                </p>
                <p className="font-mono text-[12px] font-medium text-[var(--green)] mt-1.5">
                  ≈ {fmtMZN(s.perWorkMZN)} MZN/trabalho
                </p>
              </div>
            ))}
          </div>

          {/* Users slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label htmlFor="users-slider" className="text-[13px] text-[var(--muted)]">
                Utilizadores a pagar
              </label>
              <span className="font-mono text-[13px] font-medium text-[var(--ink)]">
                {minUsers} utilizadores
              </span>
            </div>
            <Slider id="users-slider" min={1} max={50} value={minUsers} onChange={setMinUsers} />
            <div className="flex justify-between mt-1 font-mono text-[10px] text-[var(--faint)]">
              <span>1</span>
              <span className="text-[var(--green)]">
                US$ {fmtUSD2(TOTAL_INFRA_USD / minUsers)}/utilizador/mês
              </span>
              <span>50</span>
            </div>
          </div>

          {/* Works per user */}
          <div>
            <div className="flex justify-between mb-2">
              <label htmlFor="works-slider" className="text-[13px] text-[var(--muted)]">
                Trabalhos por utilizador/mês
              </label>
              <span className="font-mono text-[13px] font-medium text-[var(--ink)]">
                {worksPerUserPerMonth} trabalhos
              </span>
            </div>
            <Slider id="works-slider" min={1} max={20} value={worksPerUserPerMonth} onChange={setWorksPerUser} />
            <div className="flex justify-between mt-1 font-mono text-[10px] text-[var(--faint)]">
              <span>1</span><span>20</span>
            </div>
          </div>

          {/* Formula box */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--ink)]/[0.03] p-4 space-y-2 text-[13px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)] mb-2">
              Fórmula
            </p>
            <div className="flex justify-between text-[var(--muted)]">
              <span>US$ {fmtUSD2(TOTAL_INFRA_USD)} ÷ {minUsers} utilizadores</span>
              <span>= US$ {fmtUSD2(TOTAL_INFRA_USD / minUsers)}/utilizador</span>
            </div>
            <div className="flex justify-between text-[var(--muted)]">
              <span>÷ {worksPerUserPerMonth} trabalhos/mês</span>
              <span>= US$ {fmtUSD(calc.infraPerWorkUSD)}/trabalho</span>
            </div>
            <div className="flex justify-between font-medium text-[var(--ink)] pt-2 border-t border-[var(--border)]">
              <span>Infra por trabalho (MZN)</span>
              <span className="text-[var(--green)]">{fmtMZN(calc.infraPerWorkMZN)} MZN</span>
            </div>
          </div>
        </div>

        {/* ── Cost breakdown ── */}
        <div className="rounded-2xl border border-[var(--border)] p-5">
          <SectionLabel>Decomposição do custo por trabalho</SectionLabel>
          <Row label="Tokens input"  value={calc.gemini.inputTokens.toLocaleString("pt-MZ")}
            sub={`@ US$${GEMINI_PRICING.inputPerMToken}/1M`} dimmed />
          <Row label="Tokens output" value={calc.gemini.outputTokens.toLocaleString("pt-MZ")}
            sub={`@ US$${GEMINI_PRICING.outputPerMToken}/1M`} dimmed />
          <Row label="Gemini (USD)"  value={`US$ ${fmtUSD(calc.gemini.totalCostUSD)}`} />
          <Row label="Gemini (MZN)"  value={`${fmtMZN(calc.geminiCostMZN)} MZN`} />
          {calc.infraBreakdown.map((s) => (
            <Row key={s.id} label={`${s.label} (MZN)`} value={`${fmtMZN(s.perWorkMZN)} MZN`} />
          ))}
          {extraCostMZN > 0 && (
            <Row label="Custo adicional" value={`${fmtMZN(extraCostMZN)} MZN`} />
          )}
          <Row label="Custo base total" value={`${fmtMZN(calc.totalBaseCostMZN)} MZN`} highlight="info" />
        </div>

        {/* ── Pricing ── */}
        <div className="rounded-2xl border border-[var(--border)] p-5">
          <SectionLabel>Estrutura de preço ao cliente</SectionLabel>
          <Row label="Custo base total" value={`${fmtMZN(calc.totalBaseCostMZN)} MZN`} />
          <Row
            label={`Margem (${marginPct}%)`}
            value={`+ ${fmtMZN(calc.desiredNetMZN - calc.totalBaseCostMZN)} MZN`}
          />
          <Row label="Receita líquida desejada" value={`${fmtMZN(calc.desiredNetMZN)} MZN`} />
          <Row label="Taxa Emola (6,48%)" value={`− ${fmtMZN(calc.gatewayFeeMZN)} MZN`} highlight="danger" />

          {/* Price highlight box — always-dark heroRight surface */}
          <div className="mt-4 rounded-xl bg-[var(--heroRight)] border border-[var(--gold)]/20 p-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--gold)] mb-2">
                Cobrar ao cliente
              </p>
              <p className="font-serif text-[2rem] leading-none text-[#f1e8da] tabular-nums">
                {fmtMZN(calc.grossPriceMZN)} MZN
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#8a7d6e] mb-1">
                Você recebe
              </p>
              <p className="font-mono text-[20px] font-medium text-[#6ea886] tabular-nums">
                {fmtMZN(calc.netReceivedMZN)} MZN
              </p>
              <p className="font-mono text-[10px] text-[#8a7d6e] mt-0.5">após gateway</p>
            </div>
          </div>
        </div>

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Custo / página"
            value={`${fmtMZN(calc.costPerPageMZN)} MZN`}
            color="text-[var(--ink)]"
          />
          <StatCard
            label="Lucro líquido"
            value={`${fmtMZN(calc.profitMZN)} MZN`}
            color="text-[var(--green)]"
          />
          <StatCard
            label="Taxa gateway"
            value={`${fmtMZN(calc.gatewayFeeMZN)} MZN`}
            color="text-red-400"
          />
        </div>

        {/* ── Footer note ── */}
        <p className="font-mono text-[10px] text-[var(--faint)] text-center leading-relaxed">
          {TOKENS_PER_PAGE.input} tokens input + {TOKENS_PER_PAGE.output} output por página estimados
          <br />
          Infra total: US$ {fmtUSD2(TOTAL_INFRA_USD)}/mês
          (Vercel $10 + Supabase $10 + Upstash $0.60 + Domínio $15/ano)
          <br />
          Câmbio: 1 USD = {USD_TO_MZN} MZN · Emola 6,48% (PaySuite 3,48% + gateway 3%)
        </p>

      </div>
    </main>
  );
}
