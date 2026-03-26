'use client';

import { useThemeMode } from '@/hooks/useThemeMode';

function LandingNav({ themeMode, onToggleTheme }: { themeMode: 'dark' | 'light'; onToggleTheme: () => void }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)]/80 bg-[var(--navBg)]/90 px-6 py-4 backdrop-blur md:px-12">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">∂</div>
          <span className="font-serif text-xl italic text-[var(--gold2)]">Muneri</span>
        </div>

        <ul className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] md:flex">
          <li><a href="#features" className="hover:text-[var(--gold2)]">Funcionalidades</a></li>
          <li><a href="#modos" className="hover:text-[var(--gold2)]">Modos</a></li>
          <li><a href="#equacoes" className="hover:text-[var(--gold2)]">Equações</a></li>
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
            aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {themeMode === 'dark' ? '☀ Claro' : '🌙 Escuro'}
          </button>
          <a href="/app" className="rounded bg-[var(--ink)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]">
            ↓ Abrir app
          </a>
        </div>
      </div>
    </nav>
  );
}

export default function LandingPage() {
  const { themeMode, toggleThemeMode } = useThemeMode();

  const themeVars = themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#a8832f] [--muted:#b0a692] [--faint:#6c6459] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  return (
    <main className={`${themeVars} min-h-screen bg-[var(--parchment)] text-[var(--ink)]`}>
      <LandingNav themeMode={themeMode} onToggleTheme={toggleThemeMode} />

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-12 md:grid-cols-2 md:px-12 md:py-20">
        <div className="space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--green)]">LaTeX → OMML · PWA Instalável</p>
          <h1 className="font-serif text-5xl leading-tight md:text-6xl">
            Escreve em <em className="text-[var(--gold2)]">Markdown.</em><br />
            Exporta com equações<br />
            <span className="text-transparent [text-stroke:1px_var(--ink)] [-webkit-text-stroke:1px_var(--ink)]">Word nativas.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-[var(--muted)]">
            Editor académico que converte <code className="rounded bg-[#e8dfc8] px-[5px] py-[1px] font-mono text-[0.85em] text-black">$...$</code> e{' '}
            <code className="rounded bg-[#e8dfc8] px-[5px] py-[1px] font-mono text-[0.85em] text-black">$$...$$</code> em equações OMML — editáveis directamente no Word.
          </p>
          <div className="rounded-lg bg-[var(--ink)] p-5 font-mono text-xs leading-7 text-[#8a7d6e] shadow-xl">
            <div>## Fórmula de Bhaskara</div>
            <div className="h-2" />
            <div className="text-[var(--gold)]">{'$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'}</div>
            <div className="h-2" />
            <div className="flex items-center gap-3">
              <span className="text-[#8a6a4a]">→ OMML</span>
              <span className="text-[#a0c080]">equação editável no Word ✓</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/app" className="rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-7 py-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink)] shadow-lg">
              ↓ Exportar .docx grátis
            </a>
            <a href="#features" className="border-b border-[var(--border)] pb-0.5 font-mono text-xs uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--ink)]">
              Ver funcionalidades →
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--heroRight)] p-6">
          <div className="space-y-3 rounded-2xl border border-[#2a2520] bg-[#141210] p-4 font-mono text-[10px] text-[#8a7d6e] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[#2a2520] pb-3">
              <div className="grid h-5 w-5 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-[9px] font-bold text-black">∂</div>
              <span className="italic text-[var(--gold)]">Muneri</span>
            </div>
            <div className="text-[#e8e2d9]"># Matemática</div>
            <div className="text-[var(--gold)]">## 1. Bhaskara</div>
            <div className="text-[var(--teal)]">{'$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$'}</div>
            <div>Onde Δ = b² - 4ac é o discriminante...</div>
            <div className="text-[var(--gold)]">## 2. Logaritmos</div>
            <div className="text-[var(--teal)]">$$\log_a b = x \iff a^x = b$$</div>
            <div className="rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] p-2 text-center text-[10px] italic text-black">↓ Exportar matematica.docx</div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-7xl px-6 py-16 md:px-12">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Funcionalidades</p>
        <h2 className="font-serif text-4xl leading-tight md:text-5xl">Tudo o que precisas para <em className="text-[var(--gold2)]">documentos académicos perfeitos.</em></h2>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-[var(--border)] md:grid-cols-3">
          {[
            ['∑', 'Equações OMML Nativas', 'Converte LaTeX para OMML automaticamente. As equações exportadas são editáveis no Word.'],
            ['∂', 'Editor Markdown Limpo', 'Interface minimalista com numeração de linhas e suporte completo a GFM.'],
            ['↓', 'Export Word Profissional', 'Documentos A4 com formatação académica, tabelas e paginação.'],
            ['≡', 'Secções & Quebras de Página', 'Marcadores {section} e {pagebreak} inserem secções Word independentes.'],
            ['✦', 'IA Integrada', 'Chat com IA que gera Markdown com equações LaTeX prontas a exportar.'],
            ['📲', 'PWA Instalável', 'Instala como app no Android ou iOS e usa offline.'],
          ].map(([icon, title, desc]) => (
            <article key={title} className="space-y-3 bg-[var(--parchment)] p-8">
              <div className="text-2xl">{icon}</div>
              <h3 className="font-serif text-2xl">{title}</h3>
              <p className="text-[15px] leading-relaxed text-[var(--muted)]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[var(--ink)] px-6 py-16 md:px-12">
        <div className="mx-auto w-full max-w-7xl">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#3a3530]">Como funciona</p>
          <h2 className="font-serif text-4xl text-[#e8e2d9] md:text-5xl">De Markdown a Word em <em className="text-[var(--gold)]">quatro passos.</em></h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              ['01', 'Escreve Markdown', 'Usa sintaxe Markdown com equações LaTeX inline e em bloco.'],
              ['02', 'Conversão Automática', 'LaTeX → MathML via Temml e depois MathML → OMML.'],
              ['03', 'Estrutura .docx', 'Documento final com estilos académicos, margens e paginação.'],
              ['04', 'Descarrega e Edita', 'Abre no Word com equações realmente editáveis.'],
            ].map(([num, title, desc]) => (
              <div key={num} className="space-y-3">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-[#3a3530] bg-[#1a1714] font-mono text-xs text-[var(--gold)]">{num}</div>
                <h3 className="font-serif text-lg text-[#d8d0c5]">{title}</h3>
                <p className="text-sm leading-relaxed text-[#5a5248]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="equacoes" className="border-y border-[var(--border)] bg-[#faf6ee] px-6 py-16 md:px-12">
        <div className="mx-auto grid w-full max-w-5xl gap-8">
          <h2 className="text-center font-serif text-3xl">LaTeX que se torna <em className="text-[var(--gold2)]">equação real</em> no Word.</h2>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)]">Markdown / LaTeX</p>
              <div className="rounded border border-[#2a2520] bg-[var(--ink)] p-4 font-mono text-sm text-[var(--teal)]">{'$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'}</div>
            </div>
            <div className="text-center font-mono text-xl text-[var(--gold2)]">→</div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)]">Word (OMML nativo)</p>
              <div className="rounded border border-[var(--border)] bg-[var(--parchment)] p-4 text-center font-serif text-2xl italic">𝑥 = <sup>−𝑏 ± √(𝑏²−4𝑎𝑐)</sup>⁄<sub>2𝑎</sub></div>
            </div>
          </div>
        </div>
      </section>

      <section id="modos" className="mx-auto w-full max-w-7xl px-6 py-16 md:px-12">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Modos especializados</p>
        <h2 className="font-serif text-4xl leading-tight md:text-5xl">Muito mais do que um <em className="text-[var(--gold2)]">editor Markdown.</em></h2>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="rounded-xl border border-[#1e2a1e] bg-[#0b0d0b] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-[#6a9e5f]">📝 Modo TCC</p>
            <h3 className="mt-3 font-serif text-2xl text-[#d0dcc8]">Do esboço à conclusão, secção a secção.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#4a6644]">Gera, desenvolve e mantém coerência de todas as secções do teu TCC.</p>
          </article>
          <article className="rounded-xl border border-[#1a2a1a] bg-[#0a0d0a] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-[#5a9e8f]">📚 Trabalho Escolar</p>
            <h3 className="mt-3 font-serif text-2xl text-[#c8dcd6]">Copiloto para o ensino secundário e médio.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#3a6e60]">Estrutura fixa com conteúdo contextualizado para Moçambique.</p>
          </article>
          <article className="rounded-xl border border-[#2a2520] bg-[#0d0c0b] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--gold)]">✦ IA Chat</p>
            <h3 className="mt-3 font-serif text-2xl text-[#d8d0c7]">Gera Markdown com equações LaTeX em segundos.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5a5248]">Explicações passo a passo e inserção directa no editor.</p>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[#faf6ee] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--muted)]">📐 Editor Principal</p>
            <h3 className="mt-3 font-serif text-2xl">Editor Markdown completo com suporte LaTeX.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Importa .md, insere quebras de página e exporta para Word em segundos.</p>
          </article>
        </div>
      </section>

      <section className="border-y border-[var(--border)] px-6 py-16 text-center md:px-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Começa agora</p>
        <h2 className="mt-4 font-serif text-5xl">O teu próximo documento <em className="text-[var(--gold2)]">começa aqui.</em></h2>
        <p className="mt-4 text-lg text-[var(--muted)]">Grátis. Sem registo. Sem instalação obrigatória.</p>
        <div className="mt-8 flex justify-center">
          <a href="/app" className="rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-8 py-[14px] font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--ink)]">
            ↓ Abrir Muneri — é grátis
          </a>
        </div>
        <p className="mt-8 font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">temml · mathml2omml · Muneri · Quelimane, Moçambique</p>
      </section>

      <footer className="flex flex-col gap-2 px-6 py-8 text-center md:flex-row md:items-center md:justify-between md:px-12 md:text-left">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">Muneri · Markdown para Word com Equações Nativas · 2026</div>
        <div className="text-sm italic text-[var(--faint)]">feito com ∂ em Quelimane, Moçambique</div>
      </footer>
    </main>
  );
}
