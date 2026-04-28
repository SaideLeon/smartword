'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Gift,
  GraduationCap,
  Handshake,
  LayoutTemplate,
  Maximize,
  Minimize,
  Moon,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useThemeMode } from '@/hooks/useThemeMode';

/* ─── Nav ─── */
interface LandingNavProps {
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
}

function LandingNav({ themeMode, onToggleTheme, onToggleFullscreen, isFullscreen, fullscreenSupported }: LandingNavProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)]/80 bg-[var(--navBg)]/95 px-4 py-3 backdrop-blur md:px-12 md:py-4">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)]">
            <Image src="/icon.svg" alt="Muneri logo" width={20} height={20} className="h-5 w-5" />
          </div>
          <span className="font-serif text-xl italic text-[var(--gold2)]">Muneri</span>
        </div>

        {/* Links — desktop */}
        <ul className="hidden items-center gap-6 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] md:flex">
          <li><a href="#como-funciona" className="hover:text-[var(--gold2)] transition">Como funciona</a></li>
          <li><a href="#afiliados" className="hover:text-[var(--gold2)] transition">Afiliados</a></li>
          <li><a href="/planos" className="hover:text-[var(--gold2)] transition">Planos</a></li>
        </ul>

        {/* Acções */}
        <div className="flex items-center gap-2">
          {fullscreenSupported && (
            <button type="button" onClick={onToggleFullscreen}
              className="hidden items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)] md:flex">
              {isFullscreen ? <Minimize size={11} /> : <Maximize size={11} />}
            </button>
          )}
          <button type="button" onClick={onToggleTheme}
            className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
            {themeMode === 'dark' ? <><Sun size={11} /><span className="hidden sm:inline">Claro</span></> : <><Moon size={11} /><span className="hidden sm:inline">Escuro</span></>}
          </button>
          <a href="/planos"
            className="hidden items-center gap-1.5 rounded border border-[var(--gold2)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--gold2)] transition hover:bg-[var(--gold2)] hover:text-black md:flex">
            Planos
          </a>
          <a href="/app"
            className="flex items-center gap-1.5 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-black font-semibold shadow">
            <Zap size={12} /> Criar trabalho
          </a>
        </div>
      </div>
    </nav>
  );
}

/* ─── Dados ─── */
const howItWorks = [
  { icon: <FileText size={22} strokeWidth={1.5} />, step: '01', title: 'Informe o tema', desc: 'Digite o título ou tema do seu trabalho. Só isso.' },
  { icon: <Sparkles size={22} strokeWidth={1.5} />, step: '02', title: 'Clique em Gerar', desc: 'A IA cria a estrutura, desenvolve o conteúdo e formata tudo automaticamente.' },
  { icon: <LayoutTemplate size={22} strokeWidth={1.5} />, step: '03', title: 'Trabalho completo', desc: 'Capa, índice, desenvolvimento, referências — tudo pronto e formatado.' },
  { icon: <Download size={22} strokeWidth={1.5} />, step: '04', title: 'Baixe e imprima', desc: 'Exporte em Word, revise se quiser, e entregue com confiança.' },
];

const proofPoints = [
  'Capa com nome, instituição, curso e data',
  'Índice numerado e organizado',
  'Desenvolvimento completo por capítulos',
  'Formatação acadêmica automática',
  'Referências bibliográficas incluídas',
  'Exportação em Word (.docx)',
];

const affiliateSteps = [
  { icon: <Users size={20} strokeWidth={1.5} />, title: 'Crie sua conta grátis', desc: 'Registe-se e active o perfil de afiliado em segundos, dentro da sua conta.' },
  { icon: <Gift size={20} strokeWidth={1.5} />, title: 'Receba seu link pessoal', desc: 'Um link único para compartilhar com colegas, grupos e redes sociais.' },
  { icon: <TrendingUp size={20} strokeWidth={1.5} />, title: 'Acompanhe seus ganhos', desc: 'Dashboard em tempo real com cliques, conversões e comissões acumuladas.' },
];

const plans = [
  {
    name: 'Básico',
    label: 'Grátis para começar',
    price: '0',
    features: ['3 trabalhos por mês', 'Exportação em Word', 'Formatação automática'],
    cta: 'Começar grátis',
    href: '/app',
    highlight: false,
  },
  {
    name: 'Pro',
    label: 'Mais popular',
    price: '299',
    features: ['Trabalhos ilimitados', 'IA avançada para TCC', 'Pesquisa automática', 'Suporte prioritário'],
    cta: 'Assinar Pro',
    href: '/planos',
    highlight: true,
  },
  {
    name: 'Afiliado',
    label: 'Ganhe indicando',
    price: '0',
    features: ['Comissão por indicação', 'Dashboard de ganhos', 'Link pessoal', 'Sem custo de entrada'],
    cta: 'Tornar-se afiliado',
    href: '/app/afiliados',
    highlight: false,
  },
];

/* ─── Página ─── */
export default function LandingPage() {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  useEffect(() => {
    setFullscreenSupported(typeof document !== 'undefined' && !!document.documentElement.requestFullscreen);
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (!fullscreenSupported) return;
    document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen();
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

      {/* ══════════════════════════════════════════
          HERO — proposta principal
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[var(--heroRight)] px-5 py-16 text-center sm:px-6 md:py-24 md:px-12">
        {/* fundo decorativo */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 60% 40%, #d4b37b 0%, transparent 60%), radial-gradient(circle at 20% 80%, #6ea886 0%, transparent 50%)' }} />

        <div className="relative mx-auto max-w-4xl">
          <p className="inline-block rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--gold)]">
            ✦ Plataforma Académica com IA · Moçambique
          </p>

          <h1 className="mt-6 font-serif text-[2.2rem] leading-[1.15] text-[#f1e8da] sm:text-5xl md:text-6xl lg:text-7xl">
            Trabalho académico<br />
            <em className="text-[var(--gold)]">pronto em minutos.</em>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#c8bfb4] sm:text-xl">
            Digite o tema, clique em gerar — e receba um trabalho completo com capa, índice, desenvolvimento e referências, formatado e pronto para imprimir.
          </p>

          {/* CTAs principais */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href="/app"
              className="group flex items-center gap-2.5 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-8 py-4 font-mono text-sm font-bold uppercase tracking-[0.08em] text-black shadow-xl transition hover:scale-[1.02] hover:shadow-2xl">
              <Zap size={16} />
              Criar meu trabalho agora
              <ArrowRight size={15} className="transition group-hover:translate-x-1" />
            </a>
            <a href="#afiliados"
              className="flex items-center gap-2 rounded-lg border border-[#3a3530] bg-[#141210] px-8 py-4 font-mono text-sm uppercase tracking-[0.08em] text-[#c8bfb4] transition hover:border-[var(--gold2)] hover:text-[var(--gold)]">
              <TrendingUp size={15} />
              Quero ganhar como afiliado
            </a>
          </div>

          {/* Social proof rápido */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 font-mono text-[11px] uppercase tracking-[0.1em] text-[#8a7d6e]">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-[var(--green)]" /> Grátis para começar</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-[var(--green)]" /> Sem instalar nada</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-[var(--green)]" /> Exporta em Word</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-[var(--green)]" /> Pronto para impressão</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          DUAS AUDIÊNCIAS — escolha o seu caminho
      ══════════════════════════════════════════ */}
      <section className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-6 md:px-12 md:py-20">
        <div className="mb-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Para quem é o Muneri</p>
          <h2 className="mt-3 font-serif text-2xl leading-snug sm:text-3xl md:text-4xl">
            Dois caminhos. <em className="text-[var(--gold2)]">Uma plataforma.</em>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card — Estudantes */}
          <div className="group relative overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--parchment)] p-8 transition hover:border-[var(--gold)]/60">
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-[var(--gold)]/10 blur-2xl transition group-hover:bg-[var(--gold)]/20" />
            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--gold)]">
                <GraduationCap size={12} /> Para estudantes
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl">
                Gere trabalhos académicos <em className="text-[var(--gold2)]">completos automaticamente</em>
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                Sem horas de formatação. Sem stress com regras académicas. Você digita o tema, clica um botão e recebe o trabalho pronto com tudo incluído.
              </p>
              <ul className="mt-5 space-y-2.5">
                {proofPoints.map(p => (
                  <li key={p} className="flex items-center gap-2.5 text-sm text-[var(--muted)]">
                    <CheckCircle2 size={14} className="shrink-0 text-[var(--green)]" />
                    {p}
                  </li>
                ))}
              </ul>
              <a href="/app"
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] py-3.5 font-mono text-sm font-bold uppercase tracking-[0.08em] text-black shadow-lg transition hover:scale-[1.01]">
                <Zap size={15} /> Criar meu trabalho agora
              </a>
            </div>
          </div>

          {/* Card — Afiliados */}
          <div className="group relative overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--parchment)] p-8 transition hover:border-[var(--green)]/60">
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-[var(--green)]/10 blur-2xl transition group-hover:bg-[var(--green)]/20" />
            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--green)]">
                <TrendingUp size={12} /> Para afiliados
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl">
                Divulgue o Muneri e <em className="text-[var(--green)]">ganhe comissão</em> por cada venda
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                Qualquer pessoa pode ser afiliada. Compartilhe seu link com colegas, grupos e redes sociais — e receba uma percentagem a cada assinatura que vier por você.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  'Activação em 1 minuto, dentro da conta',
                  'Link pessoal exclusivo para partilhar',
                  'Dashboard com comissões em tempo real',
                  'Sem custo de entrada ou mensalidade',
                  'Receba por todas as indicações activas',
                  'Ideal para estudantes, influenciadores e comunidades',
                ].map(p => (
                  <li key={p} className="flex items-center gap-2.5 text-sm text-[var(--muted)]">
                    <CheckCircle2 size={14} className="shrink-0 text-[var(--green)]" />
                    {p}
                  </li>
                ))}
              </ul>
              <a href="/app/afiliados"
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[var(--green)] py-3.5 font-mono text-sm font-bold uppercase tracking-[0.08em] text-[var(--green)] transition hover:bg-[var(--green)] hover:text-black">
                <Handshake size={15} /> Tornar-me afiliado agora
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          COMO FUNCIONA — para estudantes
      ══════════════════════════════════════════ */}
      <section id="como-funciona" className="bg-[var(--heroRight)] px-5 py-14 sm:px-6 md:px-12 md:py-20">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-12 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">É mesmo simples</p>
            <h2 className="mt-3 font-serif text-2xl text-[#f1e8da] sm:text-3xl md:text-4xl">
              De tema a trabalho pronto <em className="text-[var(--gold)]">em 4 passos.</em>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#c8bfb4]">Sem conhecimento técnico. Sem horas de pesquisa. Só digitar e baixar.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {howItWorks.map(({ icon, step, title, desc }) => (
              <article key={step} className="rounded-xl border border-[#2a2520] bg-[#141210] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-[var(--gold)]">{icon}</div>
                  <span className="font-mono text-3xl font-bold text-[#2a2520]">{step}</span>
                </div>
                <h3 className="font-serif text-lg text-[#f1e8da]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#c8bfb4]">{desc}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <a href="/app"
              className="inline-flex items-center gap-2.5 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-8 py-4 font-mono text-sm font-bold uppercase tracking-[0.08em] text-black shadow-xl transition hover:scale-[1.02]">
              <Zap size={16} /> Experimentar agora — é grátis
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PROVA SOCIAL — tipos de trabalho
      ══════════════════════════════════════════ */}
      <section className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-6 md:px-12 md:py-20">
        <div className="mb-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Funciona para qualquer área</p>
          <h2 className="mt-3 font-serif text-2xl leading-snug sm:text-3xl md:text-4xl">
            Seja qual for o seu curso, <em className="text-[var(--gold2)]">o Muneri cobre.</em>
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            { icon: <GraduationCap size={20} strokeWidth={1.5} />, label: 'Universidade', desc: 'TCC, monografias e relatórios de estágio completos' },
            { icon: <BookOpen size={20} strokeWidth={1.5} />, label: 'Politécnico', desc: 'Trabalhos de grupo, projectos e relatórios técnicos' },
            { icon: <Briefcase size={20} strokeWidth={1.5} />, label: 'Profissional', desc: 'Relatórios corporativos e documentos de apresentação' },
            { icon: <Clock size={20} strokeWidth={1.5} />, label: 'Urgente', desc: 'Prazo apertado? Gere em minutos, entregue hoje' },
          ].map(({ icon, label, desc }) => (
            <article key={label} className="rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-6 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-[var(--border)] text-[var(--gold2)]">{icon}</div>
              <h3 className="font-serif text-lg">{label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          AFILIADOS — secção dedicada
      ══════════════════════════════════════════ */}
      <section id="afiliados" className="bg-[var(--heroRight)] px-5 py-14 sm:px-6 md:px-12 md:py-20">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-12 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Programa de afiliados</p>
            <h2 className="mt-3 font-serif text-2xl text-[#f1e8da] sm:text-3xl md:text-4xl">
              Indique o Muneri e <em className="text-[var(--green)]">ganhe dinheiro</em> enquanto ajuda outros.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[#c8bfb4]">
              Não precisa de experiência em vendas. Se tem amigos que estudam, já tem o suficiente para começar a ganhar.
            </p>
          </div>

          {/* 3 passos afiliado */}
          <div className="grid gap-6 md:grid-cols-3">
            {affiliateSteps.map(({ icon, title, desc }, i) => (
              <article key={title} className="relative rounded-xl border border-[#2a2520] bg-[#141210] p-7 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]">{icon}</div>
                <p className="font-mono text-xs text-[var(--faint)]">Passo {i + 1}</p>
                <h3 className="mt-2 font-serif text-xl text-[#f1e8da]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#c8bfb4]">{desc}</p>
              </article>
            ))}
          </div>

          {/* Banner de destaque */}
          <div className="mt-10 rounded-2xl border border-[var(--green)]/20 bg-[var(--green)]/5 p-8 text-center md:p-12">
            <Star size={28} className="mx-auto mb-4 text-[var(--gold)]" />
            <h3 className="font-serif text-2xl text-[#f1e8da] md:text-3xl">
              Cada pessoa que indicar e assinar = <em className="text-[var(--green)]">comissão para você.</em>
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-[#c8bfb4]">
              Partilhe em grupos de WhatsApp, Telegram, Instagram ou com colegas da faculdade. Quanto mais indicar, mais ganha.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="/app/afiliados"
                className="flex items-center gap-2.5 rounded-lg border-2 border-[var(--green)] bg-[var(--green)]/10 px-8 py-4 font-mono text-sm font-bold uppercase tracking-[0.08em] text-[var(--green)] transition hover:bg-[var(--green)] hover:text-black">
                <Handshake size={16} /> Tornar-me afiliado agora
              </a>
              <a href="/auth/signup"
                className="flex items-center gap-2 rounded-lg border border-[#3a3530] px-8 py-4 font-mono text-sm uppercase tracking-[0.08em] text-[#c8bfb4] transition hover:border-[var(--gold2)] hover:text-[var(--gold)]">
                <Users size={15} /> Criar conta grátis
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PLANOS
      ══════════════════════════════════════════ */}
      <section id="planos" className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-6 md:px-12 md:py-20">
        <div className="mb-12 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Planos e preços</p>
          <h2 className="mt-3 font-serif text-2xl leading-snug sm:text-3xl md:text-4xl">
            Comece grátis. <em className="text-[var(--gold2)]">Escale quando quiser.</em>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name}
              className={`relative flex flex-col rounded-2xl border-2 p-8 transition ${plan.highlight
                ? 'border-[var(--gold)] bg-[var(--heroRight)] shadow-xl shadow-[var(--gold)]/10'
                : 'border-[var(--border)] bg-[var(--parchment)]'}`}>
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold2)] px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-black">
                    ★ Mais popular
                  </span>
                </div>
              )}
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)]">{plan.label}</p>
              <h3 className={`mt-2 font-serif text-2xl ${plan.highlight ? 'text-[#f1e8da]' : ''}`}>{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className={`font-mono text-4xl font-bold ${plan.highlight ? 'text-[var(--gold)]' : 'text-[var(--ink)]'}`}>
                  {plan.price === '0' ? 'Grátis' : `${plan.price} MT`}
                </span>
                {plan.price !== '0' && <span className="font-mono text-xs text-[var(--faint)]">/mês</span>}
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className={`flex items-center gap-2.5 text-sm ${plan.highlight ? 'text-[#c8bfb4]' : 'text-[var(--muted)]'}`}>
                    <CheckCircle2 size={14} className={`shrink-0 ${plan.highlight ? 'text-[var(--gold)]' : 'text-[var(--green)]'}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href={plan.href}
                className={`mt-8 flex items-center justify-center gap-2 rounded-lg py-3.5 font-mono text-sm font-bold uppercase tracking-[0.08em] transition ${plan.highlight
                  ? 'bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] text-black shadow-lg hover:scale-[1.02]'
                  : 'border-2 border-[var(--border)] text-[var(--ink)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'}`}>
                {plan.name === 'Afiliado' ? <Handshake size={14} /> : <Zap size={14} />}
                {plan.cta}
              </a>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-[11px] text-[var(--faint)]">
          Todos os planos incluem exportação em Word · Sem cobranças ocultas
        </p>
      </section>

      {/* ══════════════════════════════════════════
          CTA FINAL — duplo
      ══════════════════════════════════════════ */}
      <section className="bg-[var(--heroRight)] px-5 py-16 text-center sm:px-6 md:px-12 md:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--faint)]">O próximo passo é seu</p>
          <h2 className="mt-4 font-serif text-3xl text-[#f1e8da] sm:text-4xl md:text-5xl">
            Qual é o seu caminho <em className="text-[var(--gold)]">hoje?</em>
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {/* Caminho 1 */}
            <div className="rounded-2xl border border-[#2a2520] bg-[#141210] p-8">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 text-[var(--gold)]">
                <FileText size={24} strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-xl text-[#f1e8da]">Preciso de um trabalho</h3>
              <p className="mt-2 text-sm text-[#c8bfb4]">Crie agora. É grátis para começar e leva menos de 5 minutos.</p>
              <a href="/app"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] py-3.5 font-mono text-sm font-bold uppercase tracking-[0.08em] text-black">
                <Zap size={14} /> Criar trabalho grátis
              </a>
            </div>

            {/* Caminho 2 */}
            <div className="rounded-2xl border border-[#2a2520] bg-[#141210] p-8">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]">
                <TrendingUp size={24} strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-xl text-[#f1e8da]">Quero ganhar comissão</h3>
              <p className="mt-2 text-sm text-[#c8bfb4]">Active o perfil de afiliado e comece a ganhar a partir da primeira indicação.</p>
              <a href="/app/afiliados"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[var(--green)] py-3.5 font-mono text-sm font-bold uppercase tracking-[0.08em] text-[var(--green)] transition hover:bg-[var(--green)] hover:text-black">
                <Handshake size={14} /> Tornar-me afiliado
              </a>
            </div>
          </div>

          <p className="mt-8 font-mono text-[11px] text-[var(--faint)]">
            Ou faça os dois — ser afiliado e usar a plataforma ao mesmo tempo.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="border-t border-[var(--border)] px-5 py-8 md:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex items-center gap-2">
            <Image src="/icon.svg" alt="Muneri logo" width={16} height={16} className="h-4 w-4 opacity-60" />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">Muneri · 2026 · Quelimane, Moçambique</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
            <a href="/planos" className="hover:text-[var(--gold2)] transition">Planos</a>
            <a href="/app/afiliados" className="hover:text-[var(--gold2)] transition">Afiliados</a>
            <a href="/auth/signup" className="hover:text-[var(--gold2)] transition">Criar conta</a>
            <a href="/app" className="hover:text-[var(--gold2)] transition">Abrir app</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
