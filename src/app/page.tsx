import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]" data-theme="dark">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <p className="mono text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Muneri</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Escreva trabalhos académicos em Markdown e exporte para Word com um clique.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-[var(--text-secondary)] sm:text-lg">
          A página inicial é pública para qualquer visitante conhecer a plataforma. Faça login para entrar no editor,
          gerar conteúdos com IA e exportar os documentos finais.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/auth/signup"
            className="rounded-md bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-base)] transition hover:opacity-90"
          >
            Criar conta grátis
          </Link>
          <Link
            href="/auth/login"
            className="rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--bg-card)]"
          >
            Entrar
          </Link>
          <Link
            href="/planos"
            className="rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--bg-card)]"
          >
            Ver planos
          </Link>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold">Landing pública</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Qualquer pessoa pode acessar a rota inicial sem autenticação.</p>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold">Editor completo</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Área autenticada em <code>/app</code> para escrever, revisar e exportar.</p>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold">Planos flexíveis</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Escolha um plano e envie o comprovante para validação administrativa.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
