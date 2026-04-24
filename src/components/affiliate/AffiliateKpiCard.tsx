interface AffiliateKpiCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function AffiliateKpiCard({ label, value, hint }: AffiliateKpiCardProps) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </article>
  );
}
