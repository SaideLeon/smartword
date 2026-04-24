import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f0e0d] px-6 text-[#f1e8da]">
      <section className="w-full max-w-lg rounded-xl border border-[#2c2721] bg-[#151310] p-8 text-center shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#8a7d6e]">Modo offline</p>
        <h1 className="mt-3 font-serif text-3xl italic text-[#d4b37b]">Sem ligação à internet</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#c8bfb4]">
          O Muneri está a funcionar no modo offline. Assim que a ligação for restabelecida, atualize esta página para
          sincronizar os dados mais recentes.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded bg-gradient-to-br from-[#d4b37b] to-[#c9a96e] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-black"
          >
            Tentar novamente
          </Link>
        </div>
      </section>
    </main>
  );
}
