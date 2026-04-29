"use client";

import { useState, useCallback } from "react";
import {
  Check,
  Globe,
  GraduationCap,
  Link2,
  Megaphone,
  Smartphone,
  Timer,
  UserCheck,
  Wallet,
  Landmark,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

interface AudienceCard {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  description: string;
}

interface Step {
  num: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  description: string;
}

interface Objection {
  wrong: string;
  right: string;
  description: string;
}

interface Testimonial {
  quote: string;
  initials: string;
  name: string;
  role: string;
  avatarStyle: React.CSSProperties;
}

interface FaqItem {
  question: string;
  answer: string;
}

// ── Data ───────────────────────────────────────────────────────────────────

const audienceCards: AudienceCard[] = [
  {
    icon: GraduationCap,
    title: "Estudante sem renda própria",
    description:
      "Dependes dos pais ou de bolsa. Queres ter o teu dinheiro sem abandonar os estudos. Indica para os teus colegas — e começa a receber.",
  },
  {
    icon: Smartphone,
    title: "Ativo nas redes sociais",
    description:
      "Tens seguidores no Instagram, Tiktok ou grupos de WhatsApp com estudantes. Um único post pode gerar comissões todos os meses.",
  },
  {
    icon: Wallet,
    title: "Precisa de renda extra",
    description:
      "O salário não chega ao fim do mês. Queres algo que funcione em paralelo, sem horários fixos e sem sair de casa.",
  },
  {
    icon: Landmark,
    title: "Conhece muitos estudantes",
    description:
      "Moras perto de universidade, politécnico ou escola. Tens acesso natural ao público certo. Isso já é capital.",
  },
  {
    icon: Timer,
    title: "Sem tempo para segundo emprego",
    description:
      "Queres ganhar dinheiro mas não tens horas para mais uma ocupação. Com o Muneri, trabalhas quando queres — e recebes enquanto dormes.",
  },
  {
    icon: Globe,
    title: "Qualquer cidade de Moçambique",
    description:
      "Maputo, Beira, Nampula, Quelimane — não importa onde estás. O link funciona em todo o país, online.",
  },
];

const steps: Step[] = [
  {
    num: "01",
    icon: ShieldCheck,
    title: "Cria a tua conta",
    description: "Registas-te gratuitamente no Muneri. Sem cartão, sem taxas de entrada.",
  },
  {
    num: "02",
    icon: Link2,
    title: "Recebe o teu link",
    description: "O teu link pessoal é gerado automaticamente. Cada clique é rastreado ao teu nome.",
  },
  {
    num: "03",
    icon: Megaphone,
    title: "Partilha onde quiseres",
    description:
      "WhatsApp, Telegram, Instagram, Facebook, grupos de faculdade — qualquer canal serve.",
  },
  {
    num: "04",
    icon: UserCheck,
    title: "Recebe a comissão",
    description:
      "Cada estudante que assinar através do teu link gera comissão automaticamente para ti.",
  },
];

const objections: Objection[] = [
  {
    wrong: "Não sei vender",
    right: "Não precisas vender",
    description:
      "O Muneri já foi desenvolvido a pensar em estudantes. Tu só partilhas o link — o produto vende-se a si mesmo. Basta mandar uma mensagem para colegas.",
  },
  {
    wrong: "Não tenho seguidores",
    right: "Basta 1 grupo de WhatsApp",
    description:
      "Com 30 pessoas num grupo de estudantes, uma boa mensagem pode gerar 3 a 5 assinaturas. São 300 MT a 500 MT com um único envio.",
  },
  {
    wrong: "Parece complicado",
    right: "3 cliques para activar",
    description:
      "O dashboard é simples. Vês quantas pessoas clicaram, quantas assinaram e quanto tens a receber. Sem relatórios, sem papelada.",
  },
  {
    wrong: "E se ninguém assinar?",
    right: "Não perdes nada",
    description:
      "A entrada é gratuita. Não há mensalidade de afiliado. Se não geras vendas, simplesmente não recebe nada — e não perdes um centavo.",
  },
];

const testimonials: Testimonial[] = [
  {
    quote:
      "Partilhei no grupo da minha turma e em dois dias já tinha 4 assinaturas. Foram 400 MT sem sair do quarto.",
    initials: "AM",
    name: "Amina M.",
    role: "Estudante · Maputo",
    avatarStyle: { background: "rgba(82,168,122,.15)", color: "var(--green2)" },
  },
  {
    quote:
      "Uso para pagar as minhas propinas. Com o Muneri consigo indicar durante o intervalo das aulas — é rápido e fácil.",
    initials: "JD",
    name: "João D.",
    role: "Politécnico · Beira",
    avatarStyle: { background: "rgba(212,168,75,.15)", color: "var(--gold2)" },
  },
  {
    quote:
      "Nunca tinha feito nada de marketing. Só mandei uma mensagem honesta para os meus colegas. Funcionou logo na primeira semana.",
    initials: "FC",
    name: "Fátima C.",
    role: "Recém-formada · Nampula",
    avatarStyle: { background: "rgba(82,122,200,.15)", color: "#7899e8" },
  },
];

const faqItems: FaqItem[] = [
  {
    question: "Qual é a percentagem de comissão?",
    answer:
      "Recebes 20% do valor de cada plano vendido através do teu link. Para o plano de 500 MT, por exemplo, recebes 100 MT por cada assinatura.",
  },
  {
    question: "Quando e como recebo o dinheiro?",
    answer:
      "O pagamento é feito por M-Pesa ou e-Mola, directamente ao teu número. As comissões são pagas mensalmente com base nas vendas do mês anterior.",
  },
  {
    question: "Preciso de pagar para ser afiliado?",
    answer:
      "Não. A activação do perfil de afiliado é completamente gratuita. Não há mensalidade, não há taxa de entrada, não há custo de qualquer tipo.",
  },
  {
    question: "Preciso de ser estudante para ser afiliado?",
    answer:
      "Não. Qualquer pessoa pode ser afiliada: estudantes, professores, pais, profissionais. O único requisito é conhecer estudantes para quem podes indicar.",
  },
  {
    question: "Há limite de quantas pessoas posso indicar?",
    answer:
      "Nenhum. Podes indicar 1 pessoa ou 1.000 pessoas — não há tecto. Quanto mais indicares, mais recebes.",
  },
  {
    question: "Como sei quantas pessoas clicaram no meu link?",
    answer:
      "Tens acesso a um dashboard dentro da tua conta com todos os dados em tempo real: cliques, registos, assinaturas e comissões acumuladas.",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <button
            onClick={() => toggle(i)}
            style={{
              width: "100%",
              textAlign: "left",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "1.5rem 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "1rem",
              fontWeight: 400,
              color: "var(--ink)",
            }}
          >
            {item.question}
            <span
              style={{
                color: openIndex === i ? "var(--gold2)" : "var(--green2)",
                fontSize: "1.3rem",
                fontFamily: "'DM Mono', monospace",
                transition: "transform .2s, color .2s",
                transform: openIndex === i ? "rotate(45deg)" : "none",
                flexShrink: 0,
              }}
            >
              +
            </span>
          </button>
          {openIndex === i && (
            <div
              style={{
                paddingBottom: "1.5rem",
                fontSize: ".9rem",
                color: "var(--muted)",
                lineHeight: 1.8,
              }}
            >
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EarningsCalculator() {
  const [refs, setRefs] = useState(10);
  const [plan, setPlan] = useState(500);

  const earning = Math.round(refs * plan * 0.2);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 2,
        padding: "3rem",
        maxWidth: 700,
        margin: "0 auto",
      }}
    >
      <p
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "1.5rem",
          color: "var(--ink)",
          marginBottom: "2rem",
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        Calculadora de comissões
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--faint)",
            minWidth: 140,
          }}
        >
          Indicações/mês
        </label>
        <input
          type="range"
          min={1}
          max={50}
          value={refs}
          step={1}
          onChange={(e) => setRefs(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 14,
            color: "var(--green2)",
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {refs}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--faint)",
            minWidth: 140,
          }}
        >
          Plano médio (MT)
        </label>
        <input
          type="range"
          min={152}
          max={3018}
          value={plan}
          step={1}
          onChange={(e) => setPlan(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 14,
            color: "var(--green2)",
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {plan.toLocaleString("pt-MZ")}
        </span>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: "2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: "var(--faint)",
          }}
        >
          Estimativa de ganho mensal
        </div>
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "3.5rem",
            color: "var(--gold2)",
            lineHeight: 1.2,
            margin: ".4rem 0",
            fontWeight: 700,
          }}
        >
          {earning.toLocaleString("pt-MZ")} MT
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--faint)",
          }}
        >
          20% de comissão · Estimativa aproximada
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MunerAfiliados() {
  return (
    <>
      {/* Global styles injected via style tag — move to globals.css if preferred */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --bg: #0a0906;
          --surface: #111009;
          --card: #17140f;
          --card2: #1c1810;
          --border: #2e2820;
          --border2: #3d3428;
          --ink: #ede4d6;
          --muted: #b8ad9e;
          --faint: #6b6155;
          --gold: #d4a84b;
          --gold2: #f0c96a;
          --gold-dim: #8a6a1e;
          --green: #52a87a;
          --green2: #6ec68f;
          --green-dim: #1e4f32;
          --red: #e05050;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--bg);
          color: var(--ink);
          font-family: 'DM Sans', sans-serif;
          font-weight: 300;
          line-height: 1.6;
          overflow-x: hidden;
        }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .hero-tag::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green2);
          animation: blink 2s infinite;
          display: inline-block;
          margin-right: .5rem;
        }

        .hero-cta:hover { transform: translateY(-2px); box-shadow: 0 0 60px rgba(82,168,122,.35) !important; }
        .hero-cta:hover .arrow { transform: translateX(4px); }

        .audience-card:hover { border-color: var(--border2) !important; }
        .audience-card:hover::before { opacity: 1 !important; }

        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 0 70px rgba(82,168,122,.4) !important; }

        footer a:hover { color: var(--gold2) !important; }

        input[type=range] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 3px;
          background: var(--border2);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--green2);
          border: 2px solid var(--bg);
          cursor: pointer;
        }

        @media (max-width: 600px) {
          .strip-responsive { grid-template-columns: 1fr !important; }
          .strip-item-responsive { border-right: none !important; border-bottom: 1px solid var(--border) !important; }
          .strip-item-responsive:last-child { border-bottom: none !important; }
          .footer-responsive { flex-direction: column !important; text-align: center !important; }
        }
      `}</style>

      {/* NAV */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(10,9,6,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.3rem",
            fontStyle: "italic",
            color: "var(--gold2)",
            letterSpacing: "0.02em",
            display: "flex",
            alignItems: "center",
            gap: ".6rem",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--gold)",
            }}
          />
          Muneri
        </div>
        <Link
          href="/app/afiliados"
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            border: "1px solid var(--green)",
            color: "var(--green)",
            padding: ".4rem 1rem",
            borderRadius: "2rem",
            textDecoration: "none",
            transition: ".2s",
          }}
        >
          Tornar-me afiliado →
        </Link>
      </nav>

      {/* HERO */}
      <div
        className="hero"
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "7rem 2rem 6rem",
          textAlign: "center",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(212,168,75,.07) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 80% 80%, rgba(82,168,122,.04) 0%, transparent 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: 0.04,
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div
          className="hero-tag"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: ".5rem",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: "var(--green2)",
            border: "1px solid rgba(82,168,122,.3)",
            background: "rgba(82,168,122,.06)",
            padding: ".4rem 1.2rem",
            borderRadius: "2rem",
            marginBottom: "2rem",
          }}
        >
          Programa de Afiliados · Muneri · Moçambique
        </div>

        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(2.4rem, 7vw, 5.5rem)",
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: "-.02em",
            marginBottom: "1.5rem",
          }}
        >
          Ganhe dinheiro
          <br />
          <em style={{ fontStyle: "italic", color: "var(--gold2)" }}>
            indicando para estudantes.
          </em>
        </h1>

        <p
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
            color: "var(--muted)",
            maxWidth: 600,
            margin: "0 auto 3rem",
          }}
        >
          Partilhe um link. Receba comissão a cada estudante que assinar. Sem
          investimento, sem estoque, sem chefe.
        </p>

        <Link
          href="/app/afiliados"
          className="hero-cta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: ".75rem",
            background: "linear-gradient(135deg, var(--green) 0%, #3d9966 100%)",
            color: "#000",
            fontWeight: 500,
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            padding: "1.1rem 2.5rem",
            borderRadius: 4,
            textDecoration: "none",
            transition: ".25s",
            boxShadow: "0 0 40px rgba(82,168,122,.2)",
          }}
        >
          ✦ Quero ser afiliado agora
          <span className="arrow" style={{ transition: "transform .2s" }}>
            →
          </span>
        </Link>

        <p
          style={{
            marginTop: "1.2rem",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--faint)",
          }}
        >
          Activação gratuita · Funciona pelo telemóvel · Comece hoje
        </p>
      </div>

      {/* STRIP NÚMEROS */}
      <div
        className="strip-responsive"
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          textAlign: "center",
        }}
      >
        {[
          { num: "20%", label: "Comissão por venda" },
          { num: "0 MT", label: "Custo para entrar" },
          { num: "∞", label: "Indicações sem limite" },
        ].map((item, i, arr) => (
          <div
            key={i}
            className="strip-item-responsive"
            style={{
              padding: "2.5rem 1rem",
              borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(2rem, 5vw, 3.5rem)",
                color: "var(--gold2)",
                lineHeight: 1,
              }}
            >
              {item.num}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: ".15em",
                textTransform: "uppercase",
                color: "var(--faint)",
                marginTop: ".4rem",
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* PARA QUEM É */}
      <section style={{ padding: "6rem 2rem", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: "var(--faint)",
              display: "block",
              marginBottom: ".5rem",
            }}
          >
            Para quem é este programa
          </span>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              lineHeight: 1.2,
              fontWeight: 700,
              marginTop: ".5rem",
            }}
          >
            Se tens estes problemas,
            <br />
            <em style={{ color: "var(--gold2)" }}>este programa é para ti.</em>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {audienceCards.map((card, i) => {
            const Icon = card.icon;

            return (
              <div
              key={i}
              className="audience-card"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                padding: "2rem 1.8rem",
                position: "relative",
                overflow: "hidden",
                transition: "border-color .25s",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "linear-gradient(90deg, var(--green), var(--gold))",
                  opacity: 0,
                  transition: "opacity .25s",
                }}
              />
              <div style={{ color: "var(--gold2)", marginBottom: "1rem", display: "inline-flex" }}>
                <Icon size={28} strokeWidth={1.75} />
              </div>
              <h3
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "1.1rem",
                  color: "var(--ink)",
                  marginBottom: ".5rem",
                  fontWeight: 700,
                }}
              >
                {card.title}
              </h3>
              <p style={{ fontSize: ".875rem", color: "var(--muted)", lineHeight: 1.7 }}>
                {card.description}
              </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <div
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "6rem 2rem",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: ".2em",
                textTransform: "uppercase",
                color: "var(--faint)",
                display: "block",
                marginBottom: ".5rem",
              }}
            >
              Passo a passo
            </span>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                lineHeight: 1.2,
                fontWeight: 700,
                marginTop: ".5rem",
              }}
            >
              Como funciona,{" "}
              <em style={{ color: "var(--green2)" }}>em 4 passos simples.</em>
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 2,
              marginTop: "1rem",
            }}
          >
            {steps.map((step, i) => {
              const Icon = step.icon;

              return (
                <div
                key={i}
                style={{
                  background: "var(--card)",
                  padding: "2.5rem 2rem",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "3.5rem",
                    fontWeight: 500,
                    color: "var(--border2)",
                    lineHeight: 1,
                    position: "absolute",
                    top: "1.2rem",
                    right: "1.5rem",
                  }}
                >
                  {step.num}
                </div>
                <div
                  style={{
                    color: "var(--green2)",
                    fontSize: "1.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <Icon size={24} strokeWidth={1.75} />
                </div>
                <h3
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "1.1rem",
                    color: "var(--ink)",
                    marginBottom: ".5rem",
                    fontWeight: 700,
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ fontSize: ".875rem", color: "var(--muted)", lineHeight: 1.7 }}>
                  {step.description}
                </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CALCULADORA */}
      <section style={{ padding: "6rem 2rem", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: "var(--faint)",
              display: "block",
              marginBottom: ".5rem",
            }}
          >
            Simula os teus ganhos
          </span>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              lineHeight: 1.2,
              fontWeight: 700,
              marginTop: ".5rem",
            }}
          >
            Quanto podes <em style={{ color: "var(--gold2)" }}>ganhar este mês?</em>
          </h2>
        </div>
        <EarningsCalculator />
      </section>

      {/* OBJEÇÕES */}
      <div
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "6rem 2rem",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: ".2em",
                textTransform: "uppercase",
                color: "var(--faint)",
                display: "block",
                marginBottom: ".5rem",
              }}
            >
              Dúvidas comuns
            </span>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                lineHeight: 1.2,
                fontWeight: 700,
                marginTop: ".5rem",
              }}
            >
              O que podes estar{" "}
              <em style={{ color: "var(--green2)" }}>a pensar agora.</em>
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {objections.map((obj, i) => (
              <div
                key={i}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 2,
                  padding: "2rem",
                }}
              >
                <div
                  style={{
                    color: "var(--red)",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    marginBottom: ".5rem",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: ".45rem" }}>
                    <X size={14} strokeWidth={2} />
                    &quot;{obj.wrong}&quot;
                  </span>
                </div>
                <div
                  style={{
                    color: "var(--green2)",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    marginBottom: ".75rem",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: ".45rem" }}>
                    <Check size={14} strokeWidth={2} />
                    {obj.right}
                  </span>
                </div>
                <p style={{ fontSize: ".875rem", color: "var(--muted)", lineHeight: 1.7 }}>
                  {obj.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TESTEMUNHOS */}
      <div
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "6rem 2rem",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: ".2em",
                textTransform: "uppercase",
                color: "var(--faint)",
                display: "block",
                marginBottom: ".5rem",
              }}
            >
              O que dizem os afiliados
            </span>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                lineHeight: 1.2,
                fontWeight: 700,
                marginTop: ".5rem",
              }}
            >
              Resultados <em style={{ color: "var(--gold2)" }}>reais de pessoas reais.</em>
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.5rem",
              marginTop: "1rem",
            }}
          >
            {testimonials.map((t, i) => (
              <div
                key={i}
                style={{
                  background: "var(--card2)",
                  border: "1px solid var(--border)",
                  borderRadius: 2,
                  padding: "2rem",
                }}
              >
                <div
                  style={{
                    color: "var(--gold)",
                    fontSize: ".75rem",
                    letterSpacing: ".1em",
                    marginBottom: ".4rem",
                  }}
                >
                  ★★★★★
                </div>
                <p
                  style={{
                    fontSize: ".95rem",
                    color: "var(--muted)",
                    lineHeight: 1.8,
                    marginBottom: "1.5rem",
                    fontStyle: "italic",
                  }}
                >
                  &ldquo;{t.quote}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      fontWeight: 500,
                      ...t.avatarStyle,
                    }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: ".875rem",
                        color: "var(--ink)",
                        fontWeight: 500,
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 10,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        color: "var(--faint)",
                      }}
                    >
                      {t.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <section style={{ padding: "6rem 2rem", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: "var(--faint)",
              display: "block",
              marginBottom: ".5rem",
            }}
          >
            Perguntas frequentes
          </span>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              lineHeight: 1.2,
              fontWeight: 700,
              marginTop: ".5rem",
            }}
          >
            Respostas <em style={{ color: "var(--green2)" }}>directas e honestas.</em>
          </h2>
        </div>
        <FaqAccordion items={faqItems} />
      </section>

      {/* CTA FINAL */}
      <div
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          padding: "8rem 2rem",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 80% 70% at 50% 100%, rgba(82,168,122,.06) 0%, transparent 70%)",
          }}
        />
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: "var(--faint)",
            display: "block",
            marginBottom: ".5rem",
          }}
        >
          Decide agora
        </span>
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(2rem, 5vw, 4rem)",
            lineHeight: 1.15,
            fontWeight: 700,
            maxWidth: 800,
            margin: "0 auto 1.5rem",
          }}
        >
          A próxima comissão
          <br />
          <em style={{ color: "var(--green2)" }}>pode ser tua ainda hoje.</em>
        </h2>
        <p
          style={{
            color: "var(--muted)",
            maxWidth: 500,
            margin: "0 auto 3rem",
          }}
        >
          Activação gratuita. Primeiro link em menos de 2 minutos. Sem risco, sem custo.
        </p>
        <Link
          href="/app/afiliados"
          className="cta-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: ".75rem",
            background: "linear-gradient(135deg, var(--green) 0%, #3d9966 100%)",
            color: "#000",
            fontWeight: 500,
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            padding: "1.2rem 3rem",
            borderRadius: 4,
            textDecoration: "none",
            transition: ".25s",
            boxShadow: "0 0 50px rgba(82,168,122,.25)",
            border: "none",
            cursor: "pointer",
          }}
        >
          ✦ Activar o meu perfil de afiliado
          <span style={{ transition: "transform .2s" }}>→</span>
        </Link>
        <p
          style={{
            marginTop: "1.5rem",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            color: "var(--faint)",
          }}
        >
          Sem cartão · Sem mensalidade · Começa grátis
        </p>
      </div>

      {/* FOOTER */}
      <footer
        className="footer-responsive"
        style={{
          borderTop: "1px solid var(--border)",
          padding: "2.5rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--faint)",
        }}
      >
        <span>Muneri · 2026 · Quelimane, Moçambique</span>
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          {[
            { href: "/planos", label: "Planos" },
            { href: "/landing", label: "Sobre o Muneri" },
            { href: "/auth/signup", label: "Criar conta" },
            { href: "/app", label: "Entrar na app" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: "var(--faint)",
                textDecoration: "none",
                transition: "color .2s",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </>
  );
}
