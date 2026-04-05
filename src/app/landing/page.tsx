'use client';

import {
  BookOpen, FileText, Building2, Clock, Users, Download,
  GraduationCap, Library, Briefcase, ThumbsUp, Sun, Moon,
  ChevronRight, ArrowDown,
} from 'lucide-react';
import { useThemeMode } from '@/hooks/useThemeMode';

function LandingNav({ themeMode, onToggleTheme }: { themeMode: 'dark' | 'light'; onToggleTheme: () => void }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)]/80 bg-[var(--navBg)]/90 px-4 py-3 backdrop-blur md:px-12 md:py-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex items-center justify-between md:justify-start md:gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">∂</div>
            <span className="font-serif text-xl italic text-[var(--gold2)]">Muneri</span>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
              aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {themeMode === 'dark'
                ? <><Sun size={11} /> Claro</>
                : <><Moon size={11} /> Escuro</>}
            </button>
            <a href="/app" className="flex items-center gap-1 rounded bg-[var(--ink)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]">
              <ArrowDown size={11} /> Abrir
            </a>
          </div>
        </div>

        <ul className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] md:flex">
          <li><a href="#features" className="hover:text-[var(--gold2)]">Vantagens</a></li>
          <li><a href="#modos" className="hover:text-[var(--gold2)]">Para quem é</a></li>
          <li><a href="#resultado" className="hover:text-[var(--gold2)]">Resultado final</a></li>
          <li><a href="/planos" className="hover:text-[var(--gold2)]">Planos</a></li>
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
            aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {themeMode === 'dark'
              ? <><Sun size={12} /> Claro</>
              : <><Moon size={12} /> Escuro</>}
          </button>
          <a href="/app" className="flex items-center gap-1.5 rounded bg-[var(--ink)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]">
            <ArrowDown size={12} /> Abrir app
          </a>
        </div>

        {/* Mobile nav links */}
        <ul className="flex w-full items-center gap-5 overflow-x-auto pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] md:hidden">
          <li><a href="#features" className="whitespace-nowrap hover:text-[var(--gold2)]">Vantagens</a></li>
          <li><a href="#modos" className="whitespace-nowrap hover:text-[var(--gold2)]">Para quem é</a></li>
          <li><a href="#resultado" className="whitespace-nowrap hover:text-[var(--gold2)]">Resultado final</a></li>
          <li><a href="/planos" className="whitespace-nowrap hover:text-[var(--gold2)]">Planos</a></li>
        </ul>
      </div>
    </nav>
  );
}

const features: [React.ReactNode, string, string][] = [
  [<BookOpen size={22} strokeWidth={1.5} />, 'Modelo pronto', 'Trabalho com estrutura académica completa e organizada.'],
  [<FileText size={22} strokeWidth={1.5} />, 'Capa e contracapa', 'Preencha os seus dados e o sistema monta tudo no formato certo.'],
  [<Building2 size={22} strokeWidth={1.5} />, 'Logotipo da instituição', 'Adicione facilmente o logotipo da universidade ou escola.'],
  [<Clock size={22} strokeWidth={1.5} />, 'Mais rapidez', 'Faça em minutos o que normalmente levaria horas para formatar.'],
  [<Users size={22} strokeWidth={1.5} />, 'Feito para iniciantes', 'Não precisa conhecer regras técnicas de edição para usar.'],
  [<Download size={22} strokeWidth={1.5} />, 'Arquivo pronto', 'Baixe em Word e faça ajustes finais, se quiser.'],
];

export default function LandingPage() {
  const { themeMode, toggleThemeMode } = useThemeMode();

  const themeVars = themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  return (
    <main className={`${themeVars} min-h-screen bg-[var(--parchment)] text-[var(--ink)]`}>
      <LandingNav themeMode={themeMode} onToggleTheme={toggleThemeMode} />

      {/* ── HERO ── */}
      <section className="mx-auto grid w-full max-w-7xl gap-8 overflow-hidden px-5 py-10 sm:px-6 md:grid-cols-2 md:px-12 md:py-20">
        <div className="space-y-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--green)]">Trabalho académico pronto em minutos</p>
          <h1 className="font-serif text-[1.9rem] leading-[1.2] sm:text-4xl md:text-5xl md:leading-tight lg:text-6xl">
            Crie seu trabalho com{' '}
            <em className="text-[var(--gold2)]">capa, contracapa</em>{' '}
            e texto formatado automaticamente.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Mesmo sem experiência, você consegue gerar um trabalho completo: capa, contracapa, sumário, capítulos e referências.
            Também pode adicionar o logotipo da sua instituição e baixar o arquivo pronto para entregar.
          </p>
          <div className="overflow-hidden rounded-lg bg-[var(--ink)] p-4 font-mono text-xs leading-7 text-[#8a7d6e] shadow-xl sm:p-5">
            <div className="text-[var(--parchment)]/60">✓ Capa personalizada</div>
            <div className="h-1.5" />
            <div className="text-[var(--gold)]">✓ Contracapa automática</div>
            <div className="h-1.5" />
            <div className="text-[var(--green)] opacity-80">✓ Documento final organizado — pronto para o Word</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/app" className="flex items-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink)] shadow-lg sm:px-7">
              <ArrowDown size={13} /> Criar meu trabalho grátis
            </a>
            <a href="#features" className="flex items-center gap-1 border-b border-[var(--border)] pb-0.5 font-mono text-xs uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--ink)]">
              Ver funcionalidades <ChevronRight size={12} />
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--heroRight)] p-4 sm:p-6">
          <div className="overflow-hidden rounded-2xl border border-[#2a2520] bg-[#141210] p-4 font-mono text-[10px] leading-relaxed text-[#8a7d6e] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[#2a2520] pb-3">
              <div className="grid h-5 w-5 shrink-0 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-[9px] font-bold text-black">∂</div>
              <span className="italic text-[var(--gold)]">Muneri</span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="text-[#e8e2d9]"># Trabalho Acadêmico</div>
              <div className="text-[var(--gold)]"># Capa e contracapa</div>
              <div className="text-[var(--teal)]">Nome da instituição + logotipo</div>
              <div>Nome do aluno, curso, tema, orientador...</div>
              <div className="text-[var(--gold)]"># Conteúdo completo</div>
              <div className="text-[var(--teal)]">Introdução, desenvolvimento e conclusão</div>
            </div>
            <div className="mt-4 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] p-2 text-center text-[10px] italic text-black">
              ↓ Baixar trabalho-final.docx
            </div>
          </div>
        </div>
      </section>

      {/* ── VANTAGENS ── */}
      <section id="features" className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Vantagens</p>
        <h2 className="font-serif text-2xl leading-snug sm:text-3xl md:text-4xl lg:text-5xl">
          Tudo o que você precisa para <em className="text-[var(--gold2)]">entregar um trabalho impecável.</em>
        </h2>

        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-[var(--border)] sm:grid-cols-2 md:grid-cols-3">
          {features.map(([icon, title, desc]) => (
            <article key={title} className="space-y-3 bg-[var(--parchment)] p-6 sm:p-8">
              <div className="text-[var(--gold2)]">{icon}</div>
              <h3 className="font-serif text-xl sm:text-2xl">{title}</h3>
              <p className="text-sm leading-relaxed text-[var(--muted)]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      {/* NOTE: --heroRight is always dark (#090908 / #1e1a14), so we use fixed
          light colours here instead of CSS vars that invert with the theme. */}
      <section className="bg-[var(--heroRight)] px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <div className="mx-auto w-full max-w-7xl">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Como funciona</p>
          <h2 className="font-serif text-2xl text-[#f1e8da] sm:text-3xl md:text-4xl lg:text-5xl">
            Do zero ao trabalho pronto em <em className="text-[var(--gold)]">quatro passos simples.</em>
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {[
              ['01', 'Informe os dados', 'Digite tema, curso, instituição e outras informações básicas.'],
              ['02', 'Escolha o tipo de trabalho', 'Selecione o formato: TCC, trabalho académico ou relatório.'],
              ['03', 'Geração automática', 'A plataforma monta capa, contracapa, conteúdo e organização.'],
              ['04', 'Baixe e entregue', 'Você recebe o arquivo Word pronto para revisar e enviar.'],
            ].map(([num, title, desc]) => (
              <div key={num} className="space-y-3">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-[#3a3530] bg-[#1a1714] font-mono text-xs text-[var(--gold)]">{num}</div>
                {/* Fixed light colour — this section background is always dark */}
                <h3 className="font-serif text-lg text-[#f1e8da]">{title}</h3>
                <p className="text-sm leading-relaxed text-[#c8bfb4]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTADO FINAL ── */}
      <section id="resultado" className="border-y border-[var(--border)] bg-[var(--parchment)] px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <div className="mx-auto grid w-full max-w-5xl gap-6">
          <h2 className="text-center font-serif text-2xl sm:text-3xl">
            Veja o resultado: <em className="text-[var(--gold2)]">trabalho completo e profissional.</em>
          </h2>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)]">O que você preenche</p>
              <div className="rounded border border-[#2a2520] bg-[var(--ink)] p-4 font-mono text-sm text-[var(--teal)]">
                Tema + curso + instituição + aluno + orientador
              </div>
            </div>
            <div className="text-center font-mono text-xl text-[var(--gold2)]">→</div>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)]">O que você recebe</p>
              <div className="rounded border border-[var(--border)] bg-[var(--parchment)] p-4 text-center font-serif text-lg italic sm:text-xl">
                Capa + contracapa + sumário + capítulos + referências
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PARA QUEM É ── */}
      <section id="modos" className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Para quem é</p>
        <h2 className="font-serif text-2xl leading-snug sm:text-3xl md:text-4xl lg:text-5xl">
          Ideal para quem quer <em className="text-[var(--gold2)]">resultado rápido, sem complicação.</em>
        </h2>

        <div className="mt-8 grid gap-4 sm:gap-6 md:grid-cols-2">
          <article className="rounded-xl border border-[#1e2a1e] bg-[#0b0d0b] p-5 sm:p-6">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-[#6a9e5f]">
              <GraduationCap size={14} strokeWidth={1.5} /> Universitários
            </p>
            <h3 className="mt-3 font-serif text-xl text-[#d0dcc8] sm:text-2xl">TCC e trabalhos académicos com padrão profissional.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#4a6644]">Perfeito para quem precisa entregar com qualidade, mesmo sem saber formatar.</p>
          </article>
          <article className="rounded-xl border border-[#1a2a1a] bg-[#0a0d0a] p-5 sm:p-6">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-[#5a9e8f]">
              <Library size={14} strokeWidth={1.5} /> Ensino médio
            </p>
            <h3 className="mt-3 font-serif text-xl text-[#c8dcd6] sm:text-2xl">Trabalhos escolares bem organizados e fáceis de montar.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#3a6e60]">Ajuda você a estruturar tudo com linguagem clara e formato correto.</p>
          </article>
          <article className="rounded-xl border border-[#2a2520] bg-[#0d0c0b] p-5 sm:p-6">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-[var(--gold)]">
              <Briefcase size={14} strokeWidth={1.5} /> Profissionais
            </p>
            <h3 className="mt-3 font-serif text-xl text-[#d8d0c7] sm:text-2xl">Relatórios e documentos formais prontos para apresentação.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5a5248]">Economize tempo e mantenha um padrão visual organizado.</p>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-5 sm:p-6">
            <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <ThumbsUp size={14} strokeWidth={1.5} /> Iniciantes
            </p>
            <h3 className="mt-3 font-serif text-xl sm:text-2xl">Você não precisa saber nada técnico para começar.</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">Basta preencher informações simples e deixar o sistema fazer o resto.</p>
          </article>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="border-y border-[var(--border)] px-5 py-12 text-center sm:px-6 md:px-12 md:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Começa agora</p>
        <h2 className="mt-4 font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
          O teu próximo documento <em className="text-[var(--gold2)]">começa aqui.</em>
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Grátis. Simples. Feito para quem quer terminar o trabalho com tranquilidade.
        </p>
        <div className="mt-8 flex justify-center">
          <a href="/app" className="flex items-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-7 py-3 font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--ink)] sm:px-8 sm:py-[14px]">
            <ArrowDown size={14} /> Começar agora — é grátis
          </a>
        </div>
        <p className="mt-8 font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">Muneri · Trabalhos acadêmicos automáticos · Quelimane, Moçambique</p>
      </section>

      <footer className="flex flex-col gap-2 px-5 py-6 text-center sm:px-6 md:flex-row md:items-center md:justify-between md:px-12 md:text-left">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">Muneri · Gerador automático de trabalhos académicos · 2026</div>
        <div className="text-sm italic text-[var(--faint)]">feito com ∂ em Quelimane, Moçambique</div>
      </footer>
    </main>
  );
}
