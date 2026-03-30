export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f5f0e8] px-6 py-16 text-[#0f0e0d] md:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#8b6914]">Erro 404</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight md:text-6xl">
          Esta página não existe.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-[#6b6254] md:text-lg">
          O link pode estar incorreto ou a página pode ter sido removida. Volte para a página inicial
          e continue criando o seu trabalho académico.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a
            href="/landing"
            className="rounded bg-[#0f0e0d] px-6 py-3 font-mono text-xs uppercase tracking-[0.08em] text-[#f5f0e8] transition hover:bg-[#8b6914]"
          >
            Ir para a landing
          </a>
          <a
            href="/app"
            className="rounded border border-[#c9a96e] px-6 py-3 font-mono text-xs uppercase tracking-[0.08em] text-[#6b6254] transition hover:border-[#8b6914] hover:text-[#0f0e0d]"
          >
            Abrir o app
          </a>
        </div>
      </div>
    </main>
  );
}
