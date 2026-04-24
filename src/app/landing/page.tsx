'use client';

import type { ReactNode } from 'react';
import {
  ArrowDown,
  BookOpen,
  Briefcase,
  ChevronRight,
  CircleCheck,
  Clock3,
  Download,
  Gift,
  GraduationCap,
  Handshake,
  Maximize,
  Minimize,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useThemeMode } from '@/hooks/useThemeMode';

interface LandingNavProps {
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
}

function LandingNav({
  themeMode,
  onToggleTheme,
  onToggleFullscreen,
  isFullscreen,
  fullscreenSupported,
}: LandingNavProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)]/80 bg-[var(--navBg)]/90 px-4 py-3 backdrop-blur md:px-12 md:py-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex items-center justify-between md:justify-start md:gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">∂</div>
            <span className="font-serif text-xl italic text-[var(--gold2)]">Muneri</span>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            {fullscreenSupported && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
                aria-label={isFullscreen ? 'Sair de ecrã inteiro' : 'Entrar em ecrã inteiro'}
              >
                {isFullscreen ? <Minimize size={11} /> : <Maximize size={11} />}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
              aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {themeMode === 'dark' ? <><Sun size={11} /> Claro</> : <><Moon size={11} /> Escuro</>}
            </button>
            <a href="/app" className="flex items-center gap-1 rounded bg-[var(--ink)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]">
              <ArrowDown size={11} /> Abrir
            </a>
          </div>
        </div>

        <ul className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] md:flex">
          <li><a href="#como-funciona" className="hover:text-[var(--gold2)]">Como funciona</a></li>
          <li><a href="#beneficios" className="hover:text-[var(--gold2)]">Benefícios</a></li>
          <li><a href="#afiliados" className="hover:text-[var(--gold2)]">Afiliados</a></li>
          <li><a href="/planos" className="hover:text-[var(--gold2)]">Planos</a></li>
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          {fullscreenSupported && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
              aria-label={isFullscreen ? 'Sair de ecrã inteiro' : 'Entrar em ecrã inteiro'}
            >
              {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
              {isFullscreen ? 'Sair ecrã inteiro' : 'Ecrã inteiro'}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
            aria-label={themeMode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {themeMode === 'dark' ? <><Sun size={12} /> Claro</> : <><Moon size={12} /> Escuro</>}
          </button>
          <a href="/app" className="flex items-center gap-1.5 rounded bg-[var(--ink)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]">
            <ArrowDown size={12} /> Abrir app
          </a>
        </div>
      </div>
    </nav>
  );
}

const valueCards: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: 'Clareza para quem está começando',
    text: 'Você não precisa dominar regras de formatação. O Muneri guia cada etapa com linguagem simples e objetiva.',
    icon: <Sparkles size={20} strokeWidth={1.6} />,
  },
  {
    title: 'Foco no que realmente importa',
    text: 'Em vez de perder horas ajustando margens e estrutura, você investe energia no conteúdo do seu trabalho.',
    icon: <Clock3 size={20} strokeWidth={1.6} />,
  },
  {
    title: 'Resultado com padrão profissional',
    text: 'Capa, organização do conteúdo e exportação final em Word para você revisar e entregar com confiança.',
    icon: <ShieldCheck size={20} strokeWidth={1.6} />,
  },
];

const workflowSteps = [
  ['1', 'Informe o essencial', 'Tema, curso, instituição e os dados principais do documento.'],
  ['2', 'Escolha como quer trabalhar', 'Modo trabalho rápido, apoio para TCC e recursos inteligentes para acelerar sua escrita.'],
  ['3', 'Deixe o sistema organizar', 'A plataforma estrutura seu material com uma base pronta para apresentação académica.'],
  ['4', 'Revise e exporte', 'Baixe em Word, faça ajustes finais e entregue com tranquilidade.'],
];

const benefitCards: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: 'Para estudantes universitários',
    text: 'Crie trabalhos e TCC com mais segurança, sem começar do zero e sem travar na formatação.',
    icon: <GraduationCap size={18} strokeWidth={1.6} />,
  },
  {
    title: 'Para ensino médio e técnico',
    text: 'Estruture tarefas escolares e relatórios com um visual organizado e mais credibilidade na entrega.',
    icon: <BookOpen size={18} strokeWidth={1.6} />,
  },
  {
    title: 'Para profissionais e equipas',
    text: 'Monte relatórios e documentos com padrão visual consistente, economizando tempo em cada versão.',
    icon: <Briefcase size={18} strokeWidth={1.6} />,
  },
  {
    title: 'Para quem quer rapidez',
    text: 'Em poucos minutos você sai da ideia para um documento utilizável, pronto para revisão e envio.',
    icon: <Download size={18} strokeWidth={1.6} />,
  },
];

const affiliateReasons = [
  'Qualquer usuário pode ativar seu perfil de afiliado dentro da própria conta.',
  'Você recebe um link pessoal para compartilhar com colegas, amigos e comunidades.',
  'Acompanha suas indicações e comissões em um dashboard simples, sem planilhas manuais.',
  'É uma forma prática de gerar renda indicando uma ferramenta útil para quem estuda e trabalha.',
];

export default function LandingPage() {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  useEffect(() => {
    setFullscreenSupported(typeof document !== 'undefined' && !!document.documentElement.requestFullscreen);
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (!fullscreenSupported) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  }, [fullscreenSupported]);

  const themeVars = themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  return (
    <main className={`${themeVars} min-h-screen bg-[var(--parchment)] text-[var(--ink)]`}>
      <LandingNav
        themeMode={themeMode}
        onToggleTheme={toggleThemeMode}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
        fullscreenSupported={fullscreenSupported}
      />

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-10 sm:px-6 md:grid-cols-2 md:px-12 md:py-20">
        <div className="space-y-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--green)]">Uma plataforma para transformar esforço em resultado</p>
          <h1 className="font-serif text-[1.9rem] leading-[1.2] sm:text-4xl md:text-5xl md:leading-tight lg:text-6xl">
            Termine trabalhos académicos com mais calma, mais clareza e{' '}
            <em className="text-[var(--gold2)]">muito menos stress.</em>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            O Muneri nasceu para ajudar quem precisa entregar documentos de qualidade sem perder tempo em detalhes técnicos.
            Você foca no conteúdo e a plataforma ajuda com estrutura, organização e exportação final em Word.
          </p>
          <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--heroRight)] p-4 text-sm text-[#c8bfb4]">
            <p className="flex items-center gap-2"><CircleCheck size={15} className="text-[var(--gold)]" /> Capa, organização e fluxo de escrita em um só lugar.</p>
            <p className="flex items-center gap-2"><CircleCheck size={15} className="text-[var(--gold)]" /> Recursos para trabalhos rápidos, TCC e apoio com IA.</p>
            <p className="flex items-center gap-2"><CircleCheck size={15} className="text-[var(--gold)]" /> Dashboard de afiliados para quem quiser indicar e ganhar comissões.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/app" className="flex items-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink)] shadow-lg sm:px-7">
              <ArrowDown size={13} /> Começar grátis
            </a>
            <a href="#afiliados" className="flex items-center gap-1 border-b border-[var(--border)] pb-0.5 font-mono text-xs uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--ink)]">
              Ver programa de afiliados <ChevronRight size={12} />
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--heroRight)] p-6">
          <div className="rounded-2xl border border-[#2a2520] bg-[#141210] p-5 text-sm text-[#c8bfb4]">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--gold)]">Missão</p>
            <h2 className="mt-2 font-serif text-2xl text-[#f1e8da]">Democratizar a criação de documentos académicos.</h2>
            <p className="mt-3 leading-relaxed">
              Queremos que qualquer pessoa — mesmo sem experiência em edição — consiga produzir um trabalho bem apresentado,
              com linguagem simples, processo guiado e apoio real para cada etapa.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-[#2a2520] bg-[#0f0e0d] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Valor 01</p>
                <p className="mt-1 text-[#f1e8da]">Simplicidade para o usuário final.</p>
              </div>
              <div className="rounded border border-[#2a2520] bg-[#0f0e0d] p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Valor 02</p>
                <p className="mt-1 text-[#f1e8da]">Resultados consistentes e confiáveis.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Benefícios principais</p>
        <h2 className="font-serif text-2xl leading-snug sm:text-3xl md:text-4xl lg:text-5xl">
          Feito para pessoas reais, com rotina corrida e prazos apertados.
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {valueCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-6">
              <div className="mb-3 text-[var(--gold2)]">{card.icon}</div>
              <h3 className="font-serif text-xl">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="bg-[var(--heroRight)] px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <div className="mx-auto w-full max-w-7xl">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Como funciona</p>
          <h2 className="font-serif text-2xl text-[#f1e8da] sm:text-3xl md:text-4xl lg:text-5xl">
            Da ideia ao documento final em <em className="text-[var(--gold)]">4 passos simples.</em>
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {workflowSteps.map(([number, title, description]) => (
              <article key={number} className="space-y-3">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-[#3a3530] bg-[#1a1714] font-mono text-xs text-[var(--gold)]">{number}</div>
                <h3 className="font-serif text-lg text-[#f1e8da]">{title}</h3>
                <p className="text-sm leading-relaxed text-[#c8bfb4]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Para quem é o Muneri</p>
        <h2 className="font-serif text-2xl leading-snug sm:text-3xl md:text-4xl lg:text-5xl">
          Se você precisa entregar melhor, mais rápido, este sistema é para você.
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {benefitCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-5 sm:p-6">
              <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-[var(--gold2)]">
                {card.icon} {card.title}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="afiliados" className="border-y border-[var(--border)] bg-[var(--parchment)] px-5 py-12 sm:px-6 md:px-12 md:py-16">
        <div className="mx-auto grid w-full max-w-7xl gap-8 md:grid-cols-[1.15fr_1fr] md:items-start">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Programa de afiliados</p>
            <h2 className="mt-2 font-serif text-2xl sm:text-3xl md:text-4xl">
              Indique o Muneri e transforme recomendações em <em className="text-[var(--gold2)]">renda extra.</em>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
              Nosso objetivo é criar uma rede de pessoas que ajudam outras a estudar e produzir melhor.
              Se você já usa a plataforma, pode compartilhar seu link e acompanhar tudo de forma transparente no dashboard.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/app/afiliados" className="flex items-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-6 py-3 font-mono text-xs uppercase tracking-[0.08em] text-[var(--ink)]">
                <Handshake size={14} /> Quero ser afiliado
              </a>
              <a href="/auth/signup" className="flex items-center gap-2 rounded border border-[var(--border)] px-6 py-3 font-mono text-xs uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
                <Users size={14} /> Criar conta
              </a>
            </div>
          </div>

          <aside className="rounded-xl border border-[var(--border)] bg-[var(--heroRight)] p-5 text-[#c8bfb4] sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--gold)]">Por que participar</p>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed">
              {affiliateReasons.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <Gift size={14} className="mt-0.5 shrink-0 text-[var(--gold)]" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="px-5 py-12 text-center sm:px-6 md:px-12 md:py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Comece agora</p>
        <h2 className="mt-4 font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
          Seja para estudar melhor ou para indicar e ganhar, <em className="text-[var(--gold2)]">o próximo passo é seu.</em>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Entre gratuitamente, experimente os recursos e escolha o caminho que faz mais sentido para você: usuário final, afiliado, ou ambos.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="/app" className="flex items-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-7 py-3 font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--ink)] sm:px-8 sm:py-[14px]">
            <ArrowDown size={14} /> Começar grátis
          </a>
          <a href="/planos" className="rounded border border-[var(--border)] px-7 py-3 font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
            Ver planos
          </a>
        </div>
      </section>

      <footer className="flex flex-col gap-2 border-t border-[var(--border)] px-5 py-6 text-center sm:px-6 md:flex-row md:items-center md:justify-between md:px-12 md:text-left">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">Muneri · Plataforma para criação de documentos académicos · 2026</div>
        <div className="text-sm italic text-[var(--faint)]">feito com ∂ em Quelimane, Moçambique</div>
      </footer>
    </main>
  );
}
