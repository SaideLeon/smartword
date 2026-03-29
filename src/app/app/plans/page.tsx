'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabaseClient, useAuth } from '@/hooks/useAuth';

interface PlanRow {
  key: string;
  label: string;
  price_mzn: number;
  works_limit: number | null;
  edits_limit: number | null;
  duration_months: number;
  tcc_enabled: boolean;
  ai_chat_enabled: boolean;
  cover_enabled: boolean;
  export_full: boolean;
}

export default function PlansPage() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      const { data } = await supabaseClient
        .from('plans')
        .select('*')
        .order('price_mzn', { ascending: true });

      setPlans((data as PlanRow[]) ?? []);
      setLoading(false);
    }

    loadPlans();
  }, []);

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-4 py-8 text-[var(--text-primary)]" data-theme="dark">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Muneri</p>
            <h1 className="text-2xl font-semibold">Planos da plataforma</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Plano actual: <strong>{profile?.plan_key || 'free'}</strong>
            </p>
          </div>
          <Link href="/app" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--bg-card)]">
            Voltar ao editor
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">A carregar planos...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.key} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold">{plan.label}</h2>
                  <p className="text-sm text-[var(--text-muted)]">{plan.price_mzn} MZN</p>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Duração: {plan.duration_months > 0 ? `${plan.duration_months} mês(es)` : 'sem validade'}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
                  <li>• Trabalhos: {plan.works_limit ?? 'ilimitados'}</li>
                  <li>• Edições: {plan.edits_limit ?? 'ilimitadas'}</li>
                  <li>• Exportação completa: {plan.export_full ? 'Sim' : 'Não'}</li>
                  <li>• Modo TCC: {plan.tcc_enabled ? 'Sim' : 'Não'}</li>
                  <li>• IA chat: {plan.ai_chat_enabled ? 'Sim' : 'Não'}</li>
                  <li>• Capa automática: {plan.cover_enabled ? 'Sim' : 'Não'}</li>
                </ul>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
