import Link from 'next/link';

const unlockedFeatures = [
  'Editor inteligente com assistência de IA em tempo real',
  'Geração e desenvolvimento avançado de trabalhos longos',
  'Exportação completa e sem limitações do conteúdo',
  'Ferramentas premium de cobertura, resumo e organização',
  'Prioridade em novas funcionalidades da plataforma',
];

export default function PremiumAtivadoPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b0907] text-[#f1e8da]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(201,169,110,0.2),transparent_50%),radial-gradient(circle_at_80%_100%,rgba(139,105,20,0.16),transparent_45%)]" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#d4b37b]">Muneri Premium</p>

        <div className="mb-6 grid h-24 w-24 place-items-center rounded-full border border-[#c9a96e]/70 bg-[#17120d] shadow-[0_0_40px_rgba(201,169,110,0.2)]">
          <div className="checkmark" aria-hidden="true" />
        </div>

        <h1 className="font-serif text-4xl italic text-[#f5e7c9] md:text-5xl">Premium ativado com sucesso</h1>
        <p className="mt-4 max-w-2xl text-base text-[#cbbba6] md:text-lg">
          A tua conta já está com acesso premium. Aqui está o que desbloqueaste agora:
        </p>

        <ul className="mt-8 w-full max-w-2xl space-y-3 text-left">
          {unlockedFeatures.map((feature) => (
            <li
              key={feature}
              className="rounded-xl border border-[#3b2f20] bg-[#120f0b]/85 px-4 py-3 text-sm text-[#e9dcc8] md:text-base"
            >
              <span className="mr-2 text-[#d4b37b]">✓</span>
              {feature}
            </li>
          ))}
        </ul>

        <Link
          href="/app"
          className="mt-10 inline-flex items-center justify-center rounded-lg border border-[#c9a96e] bg-[#c9a96e]/10 px-6 py-3 font-mono text-xs uppercase tracking-[0.14em] text-[#f5e7c9] transition hover:bg-[#c9a96e]/20"
        >
          Ir para o editor →
        </Link>
      </section>

      <style jsx>{`
        .checkmark {
          width: 56px;
          height: 56px;
          border-radius: 999px;
          border: 2px solid rgba(212, 179, 123, 0.65);
          position: relative;
          animation: pulse 1.6s ease-out infinite;
        }

        .checkmark::after {
          content: '';
          position: absolute;
          left: 16px;
          top: 12px;
          width: 14px;
          height: 24px;
          border-right: 4px solid #d4b37b;
          border-bottom: 4px solid #d4b37b;
          transform: rotate(40deg) scale(0.6);
          opacity: 0;
          animation: draw 700ms ease forwards 120ms;
        }

        @keyframes draw {
          from {
            transform: rotate(40deg) scale(0.3);
            opacity: 0;
          }
          to {
            transform: rotate(40deg) scale(1);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(201, 169, 110, 0.3);
          }
          70% {
            box-shadow: 0 0 0 14px rgba(201, 169, 110, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(201, 169, 110, 0);
          }
        }
      `}</style>
    </main>
  );
}
