'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { AffiliateDashboardLayout } from '@/components/affiliate/AffiliateDashboardLayout';
import { AffiliateKpiCard } from '@/components/affiliate/AffiliateKpiCard';
import { AffiliateReferralsTable } from '@/components/affiliate/AffiliateReferralsTable';

interface AffiliateRecord {
  id: string;
  code: string;
  total_referrals: number;
  total_converted: number;
  total_commission_mzn: number;
  pending_commission_mzn: number;
  paid_commission_mzn: number;
}

interface AffiliatePayload {
  exists: boolean;
  affiliate: AffiliateRecord | null;
  referrals?: Array<{
    id: string;
    status: string;
    registered_at: string;
    converted_at: string | null;
    referred_user?: {
      full_name: string | null;
      email: string | null;
    } | null;
    commissions?: Array<{
      id: string;
      payment_amount_mzn: number;
      commission_mzn: number;
      commission_rate: number;
      status: string;
      created_at: string;
    }>;
  }>;
}

const moneyFormatter = new Intl.NumberFormat('pt-MZ', {
  style: 'currency',
  currency: 'MZN',
  maximumFractionDigits: 2,
});

export default function AffiliateDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<AffiliatePayload | null>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/affiliate?referrals=true', { cache: 'no-store' });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(typeof json.error === 'string' ? json.error : 'Não foi possível carregar o dashboard de afiliado.');
        }

        if (!active) return;
        setPayload(json as AffiliatePayload);
        if (json?.affiliate?.code) {
          setShareLink(`${window.location.origin}/auth/signup?ref=${json.affiliate.code}`);
        }
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : 'Erro inesperado.';
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, [user]);

  const createAffiliate = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Não foi possível ativar o programa de afiliados.');
      }

      const nextPayload: AffiliatePayload = {
        exists: true,
        affiliate: json.affiliate,
        referrals: payload?.referrals ?? [],
      };

      setPayload(nextPayload);
      setShareLink(typeof json.link === 'string' ? json.link : `${window.location.origin}/auth/signup?ref=${json.code}`);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Erro inesperado.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
  };

  const affiliate = payload?.affiliate;
  const referrals = useMemo(() => payload?.referrals ?? [], [payload?.referrals]);

  if (authLoading || loading) {
    return (
      <AffiliateDashboardLayout
        title="Dashboard de afiliado"
        subtitle="Carregando seus dados de indicação..."
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">Carregando...</div>
      </AffiliateDashboardLayout>
    );
  }

  if (!user) {
    return (
      <AffiliateDashboardLayout
        title="Torne-se afiliado"
        subtitle="Faça login para ativar seu link e começar a ganhar comissão por indicações convertidas."
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          Você precisa estar autenticado para participar do programa.{' '}
          <Link href="/auth/login" className="font-semibold text-[var(--gold2)] underline-offset-4 hover:underline">
            Ir para login
          </Link>
          .
        </div>
      </AffiliateDashboardLayout>
    );
  }

  return (
    <AffiliateDashboardLayout
      title={affiliate ? 'Seu dashboard de afiliado' : 'Ative seu perfil de afiliado'}
      subtitle="Qualquer usuário pode aderir ao programa de afiliados e começar a convidar novos usuários com um link único."
      actions={
        affiliate ? (
          <>
            <button
              type="button"
              onClick={copyLink}
              className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
            >
              Copiar link
            </button>
            <Link
              href="/app"
              className="rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
            >
              Voltar ao editor
            </Link>
          </>
        ) : null
      }
    >
      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      ) : null}

      {!affiliate ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-serif text-xl text-[var(--ink)]">Comece agora</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Ative seu código de afiliado com um clique. Depois disso, você terá acesso às métricas de cliques, cadastros e comissões.
          </p>
          <button
            type="button"
            onClick={createAffiliate}
            disabled={submitting}
            className="mt-4 cursor-pointer rounded-md border border-transparent bg-gradient-to-r from-[var(--gold)] to-[var(--gold2)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Ativando...' : 'Quero ser afiliado'}
          </button>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AffiliateKpiCard label="Indicações" value={String(affiliate.total_referrals ?? 0)} hint="Usuários registrados com seu código" />
            <AffiliateKpiCard label="Convertidos" value={String(affiliate.total_converted ?? 0)} hint="Usuários com compra aprovada" />
            <AffiliateKpiCard label="A pagar" value={moneyFormatter.format(affiliate.pending_commission_mzn ?? 0)} hint="Comissões pendentes" />
            <AffiliateKpiCard label="Total ganho" value={moneyFormatter.format(affiliate.total_commission_mzn ?? 0)} hint="Comissões acumuladas" />
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Seu link de indicação</p>
            <p className="mt-2 break-all rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--ink)]">{shareLink || `${origin}/auth/signup?ref=${affiliate.code}`}</p>
          </section>

          <section>
            <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">Indicações recentes</h2>
            <AffiliateReferralsTable referrals={referrals} />
          </section>
        </>
      )}
    </AffiliateDashboardLayout>
  );
}
