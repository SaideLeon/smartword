const EXCHANGE_RATE = 64.05;

const plans = [
  {
    key: 'free',
    label: 'Gratuito',
    usd: 0,
    mzn: 0,
    badge: 'Entrada',
    description: 'Para experimentar o editor com recursos essenciais.',
    features: ['20 trabalhos por mês', 'Sem IA Chat', 'Sem modo TCC', 'Exportação parcial'],
  },
  {
    key: 'avulso',
    label: 'Avulso',
    usd: 0,
    mzn: 50,
    badge: 'Por obra',
    description: 'Pagamento pontual para uma entrega específica.',
    features: ['1 trabalho', '2 edições', 'Capa automática', 'Exportação completa'],
  },
  {
    key: 'basico',
    label: 'Básico',
    usd: 4.99,
    mzn: 320,
    badge: 'Básico',
    description: 'Plano mensal para uso contínuo com IA.',
    features: ['Trabalhos ilimitados', 'IA Chat', 'Sem modo TCC', 'Exportação completa'],
  },
  {
    key: 'standard',
    label: 'Standard',
    usd: 7.99,
    mzn: 512,
    badge: 'Intermédio',
    description: 'Equilíbrio entre recursos e preço mensal.',
    features: ['Trabalhos ilimitados', 'IA Chat', 'Capa automática', 'Exportação completa'],
  },
  {
    key: 'pro',
    label: 'Pro',
    usd: 9.99,
    mzn: 640,
    badge: 'Ideal',
    description: 'Plano recomendado para TCC e documentos avançados.',
    features: ['Trabalhos ilimitados', 'IA Chat', 'Modo TCC ativo', 'Capa automática + exportação completa'],
  },
  {
    key: 'premium',
    label: 'Premium',
    usd: 14.99,
    mzn: 960,
    badge: 'Premium',
    description: 'Plano com maior margem para operação e evolução do produto.',
    features: ['Trabalhos ilimitados', 'IA Chat', 'Modo TCC ativo', 'Todos os recursos desbloqueados'],
  },
] as const;

function formatUsd(value: number) {
  return value === 0 ? '—' : `$${value.toFixed(2)}`;
}

export default function PlanosPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-4 py-10 text-[var(--text-primary)]" data-theme="dark">
      <section className="mx-auto w-full max-w-6xl">
        <header className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <p className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Muneri · Precificação SaaS</p>
          <h1 className="mt-2 text-3xl font-semibold">Tabela completa de preços dos planos</h1>
          <p className="mt-3 max-w-3xl text-sm text-[var(--text-muted)]">
            Esta página foi criada com base no arquivo <strong>precificacao_saas_meticais (3).html</strong>,
            considerando os cenários de referência em USD e os valores finais em meticais usados no produto.
          </p>
        </header>

        <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <h2 className="text-lg font-semibold">Pressupostos usados na precificação</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            <li>• Taxa de câmbio de referência: <strong>1 USD = {EXCHANGE_RATE} MZN</strong>.</li>
            <li>• Cenários-base do HTML: <strong>$4.99</strong>, <strong>$7.99</strong>, <strong>$9.99</strong> e <strong>$14.99</strong>.</li>
            <li>• Valor em meticais por plano mensal arredondado para facilitar pagamento local.</li>
            <li>• Plano avulso mantido como pagamento por obra (sem assinatura mensal).</li>
          </ul>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.key} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{plan.label}</h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{plan.badge}</p>
                </div>
                <span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]">{plan.key}</span>
              </div>

              <div className="mt-4 rounded-lg bg-[var(--bg-card)] p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Preço</p>
                <p className="mt-1 text-2xl font-semibold">{plan.mzn.toLocaleString('pt-BR')} MZN</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">USD referência: {formatUsd(plan.usd)}</p>
              </div>

              <p className="mt-4 text-sm text-[var(--text-secondary)]">{plan.description}</p>

              <ul className="mt-4 space-y-1.5 text-sm text-[var(--text-secondary)]">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
