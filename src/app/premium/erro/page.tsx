import Link from 'next/link';

const reasonMessage: Record<string, string> = {
  invalid_token: 'O token recebido é inválido.',
  not_found: 'Este link não foi encontrado ou já não está disponível.',
  unavailable: 'Este link está indisponível (expirado, revogado ou sem usos).',
  user_not_found: 'Não foi possível encontrar o utilizador alvo deste link.',
  already_used: 'Este link já foi utilizado.',
  activation_failed: 'Houve uma falha ao ativar o plano premium.',
  unknown: 'Ocorreu um erro inesperado ao ativar o premium.',
};

export default async function PremiumErroPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const reason = (params.reason || 'unknown').toLowerCase();

  return (
    <main className="min-h-screen bg-[#0b0907] px-6 py-16 text-[#f1e8da]">
      <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-[#3b2f20] bg-[#120f0b]/90 p-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#d4b37b]">Muneri Premium</p>
        <h1 className="mt-3 font-serif text-4xl italic text-[#f5e7c9]">Não foi possível ativar</h1>
        <p className="mt-4 text-[#cbbba6]">{reasonMessage[reason] ?? reasonMessage.unknown}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/planos"
            className="rounded-lg border border-[#c9a96e] px-5 py-2 font-mono text-xs uppercase tracking-[0.12em] text-[#f5e7c9]"
          >
            Ver planos
          </Link>
          <Link
            href="/app"
            className="rounded-lg bg-[#c9a96e]/15 px-5 py-2 font-mono text-xs uppercase tracking-[0.12em] text-[#f5e7c9]"
          >
            Ir para o editor
          </Link>
        </div>
      </div>
    </main>
  );
}
