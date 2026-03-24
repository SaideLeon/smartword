'use client';

import { useEffect } from 'react';

const LANDING_HTML = String.raw`
<div class="cursor" id="cursor"></div>
<div class="cursor-ring" id="cursorRing"></div>

<nav>
  <div class="nav-logo">
    <div class="nav-icon">∂</div>
    <span class="nav-name">docx</span>
  </div>
  <ul class="nav-links">
    <li><a href="#features">Funcionalidades</a></li>
    <li><a href="#modos">Modos</a></li>
    <li><a href="#equacoes">Equações</a></li>
  </ul>
  <a href="#cta" class="nav-cta">↓ Abrir app</a>
</nav>

<section class="hero">
  <div class="hero-left">
    <p class="hero-eyebrow">LaTeX → OMML · PWA Instalável</p>
    <h1 class="hero-h1">
      Escreve em <em>Markdown.</em><br />
      Exporta com equações<br />
      <span class="outline-text">Word nativas.</span>
    </h1>
    <p class="hero-sub">
      Editor académico que converte <code style="font-family:'DM Mono',monospace;font-size:0.85em;background:#e8dfc8;padding:1px 5px;border-radius:3px;">$...$</code> e <code style="font-family:'DM Mono',monospace;font-size:0.85em;background:#e8dfc8;padding:1px 5px;border-radius:3px;">$$...$$</code> em equações OMML — editáveis directamente no Word. Sem plugins. Sem imagens.
    </p>
    <div class="hero-code">
      <div class="code-line">## Fórmula de Bhaskara</div>
      <div class="code-line" style="height:8px"></div>
      <div class="code-md">$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$</div>
      <div class="code-line" style="height:8px"></div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span class="code-arrow">→ OMML</span>
        <span class="code-omml">equação editável no Word ✓</span>
      </div>
    </div>
    <div class="hero-actions">
      <a href="#cta" class="btn-primary">↓ Exportar .docx grátis</a>
      <a href="#features" class="btn-secondary">Ver funcionalidades →</a>
    </div>
  </div>

  <div class="hero-right">
    <div class="hero-mockup">
      <div class="float-tag ft1">
        <span class="ft-dot ft-green"></span>LaTeX → OMML activo
      </div>
      <div class="float-tag ft2">
        <span class="ft-dot ft-gold"></span>187 linhas · 3880 chars
      </div>
      <div class="float-tag ft3">
        <span class="ft-dot ft-teal"></span>PWA instalável
      </div>

      <div class="phone-frame">
        <div class="phone-header">
          <div class="phone-logo-icon">∂</div>
          <span class="phone-logo-text">docx</span>
        </div>
        <div class="phone-body">
          <div class="phone-line ph-h1"># Matemática</div>
          <div class="phone-line ph-text">&nbsp;</div>
          <div class="phone-line ph-h2">## 1. Bhaskara</div>
          <div class="phone-line ph-text">&nbsp;</div>
          <div class="phone-line ph-math">$$x = \frac{-b \pm</div>
          <div class="phone-line ph-math">\sqrt{b^2-4ac}}{2a}$$</div>
          <div class="phone-line ph-text">&nbsp;</div>
          <div class="phone-line ph-text">Onde $\Delta = b^2 - 4ac$</div>
          <div class="phone-line ph-text">é o discriminante...</div>
          <div class="phone-line ph-text">&nbsp;</div>
          <div class="phone-line ph-h2">## 2. Logaritmos</div>
          <div class="phone-line ph-text">&nbsp;</div>
          <div class="phone-line ph-math">$$\log_a b = x \iff</div>
          <div class="phone-line ph-math">a^x = b$$</div>
          <div class="phone-line ph-text">&nbsp;</div>
          <div class="phone-line" style="color:#3a3530">···<span class="cursor-blink"></span></div>
        </div>
        <div class="phone-export">↓ Exportar matematica.docx</div>
      </div>
    </div>
  </div>
</section>

<div class="marquee-wrap">
  <div class="marquee-track" id="marqueeTrack">
    <div class="marquee-item">Markdown Editor <span>✦</span></div>
    <div class="marquee-item">LaTeX → OMML <span>✦</span></div>
    <div class="marquee-item">Equações Nativas Word <span>✦</span></div>
    <div class="marquee-item">Modo TCC <span>✦</span></div>
    <div class="marquee-item">Trabalho Escolar <span>✦</span></div>
    <div class="marquee-item">IA Chat <span>✦</span></div>
    <div class="marquee-item">PWA Offline <span>✦</span></div>
    <div class="marquee-item">Export .docx <span>✦</span></div>
    <div class="marquee-item">Quelimane, Moçambique <span>✦</span></div>
    <div class="marquee-item">Markdown Editor <span>✦</span></div>
    <div class="marquee-item">LaTeX → OMML <span>✦</span></div>
    <div class="marquee-item">Equações Nativas Word <span>✦</span></div>
    <div class="marquee-item">Modo TCC <span>✦</span></div>
    <div class="marquee-item">Trabalho Escolar <span>✦</span></div>
    <div class="marquee-item">IA Chat <span>✦</span></div>
    <div class="marquee-item">PWA Offline <span>✦</span></div>
    <div class="marquee-item">Export .docx <span>✦</span></div>
    <div class="marquee-item">Quelimane, Moçambique <span>✦</span></div>
  </div>
</div>

<section class="features" id="features">
  <p class="section-label reveal">Funcionalidades</p>
  <h2 class="section-h2 reveal">Tudo o que precisas para<br /><em>documentos académicos perfeitos.</em></h2>

  <div class="features-grid reveal">
    <div class="feat-card">
      <div class="feat-icon">∑</div>
      <h3 class="feat-title">Equações OMML Nativas</h3>
      <p class="feat-desc">Converte LaTeX para OMML automaticamente. As equações exportadas são editáveis directamente no Microsoft Word — não são imagens.</p>
      <span class="feat-tag">LaTeX → MathML → OMML</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">∂</div>
      <h3 class="feat-title">Editor Markdown Limpo</h3>
      <p class="feat-desc">Interface minimalista com numeração de linhas, importação de ficheiros .md por drag & drop, e suporte completo a GFM com tabelas.</p>
      <span class="feat-tag">Markdown + GFM</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">↓</div>
      <h3 class="feat-title">Export Word Profissional</h3>
      <p class="feat-desc">Documentos A4 formatados com Times New Roman, espaçamento académico, tabelas estilizadas e numeração de páginas no rodapé.</p>
      <span class="feat-tag">.docx · A4 · ABNT-ready</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">≡</div>
      <h3 class="feat-title">Secções & Quebras de Página</h3>
      <p class="feat-desc">Marcadores <code style="font-family:'DM Mono',monospace;font-size:0.8em;">{section}</code> e <code style="font-family:'DM Mono',monospace;font-size:0.8em;">{pagebreak}</code> inserem secções Word independentes com paginação reiniciada.</p>
      <span class="feat-tag">Multi-secção</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">✦</div>
      <h3 class="feat-title">IA Integrada</h3>
      <p class="feat-desc">Chat com IA que gera Markdown com equações LaTeX prontas a exportar. Inserção directa no editor com um clique.</p>
      <span class="feat-tag">Groq · Streaming</span>
    </div>
    <div class="feat-card">
      <div class="feat-icon">📲</div>
      <h3 class="feat-title">PWA Instalável</h3>
      <p class="feat-desc">Instala como app nativa no Android ou iOS. Funciona offline com os ficheiros essenciais em cache. Sem necessidade de internet após instalação.</p>
      <span class="feat-tag">Service Worker · Offline</span>
    </div>
  </div>
</section>

<section class="how">
  <div class="how-inner">
    <p class="section-label reveal">Como funciona</p>
    <h2 class="section-h2 reveal">De Markdown a Word em <em>quatro passos.</em></h2>

    <div class="steps">
      <div class="step reveal">
        <div class="step-num">01</div>
        <h3 class="step-title">Escreve Markdown</h3>
        <p class="step-desc">Usa a sintaxe Markdown normal com equações LaTeX inline <code style="font-family:'DM Mono',monospace;font-size:0.85em;color:#6a9e8f;">$...$</code> e em bloco <code style="font-family:'DM Mono',monospace;font-size:0.85em;color:#6a9e8f;">$$...$$</code>.</p>
      </div>
      <div class="step reveal" style="transition-delay:0.1s">
        <div class="step-num">02</div>
        <h3 class="step-title">Conversão Automática</h3>
        <p class="step-desc">O motor converte LaTeX → MathML via Temml e depois MathML → OMML, preservando toda a estrutura matemática.</p>
      </div>
      <div class="step reveal" style="transition-delay:0.2s">
        <div class="step-num">03</div>
        <h3 class="step-title">Estrutura .docx</h3>
        <p class="step-desc">O documento Word é montado com estilos académicos — fontes, margens, espaçamento, tabelas e rodapé com numeração.</p>
      </div>
      <div class="step reveal" style="transition-delay:0.3s">
        <div class="step-num">04</div>
        <h3 class="step-title">Descarrega e Edita</h3>
        <p class="step-desc">Abre no Microsoft Word e encontras equações editáveis, prontas para ajustar, copiar ou reformatar.</p>
      </div>
    </div>
  </div>
</section>

<section class="equations" id="equacoes">
  <div class="eq-inner">
    <h2 class="eq-title reveal">LaTeX que se torna <em style="color:var(--gold2)">equação real</em> no Word.</h2>

    <div class="eq-grid reveal">
      <div>
        <p class="eq-label">Markdown / LaTeX</p>
        <div class="eq-box dark">$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$</div>
      </div>
      <div class="eq-arrow">→</div>
      <div>
        <p class="eq-label">Word (OMML nativo)</p>
        <div class="eq-box">
          <div class="eq-result" style="font-size:1.2rem">𝑥 = <sup>−𝑏 ± √(𝑏²−4𝑎𝑐)</sup>⁄<sub>2𝑎</sub></div>
        </div>
      </div>
    </div>

    <div class="eq-grid reveal">
      <div>
        <p class="eq-label">Markdown / LaTeX</p>
        <div class="eq-box dark">$$\log_a M = \frac{\log_b M}{\log_b a}$$</div>
      </div>
      <div class="eq-arrow">→</div>
      <div>
        <p class="eq-label">Word (OMML nativo)</p>
        <div class="eq-box">
          <div class="eq-result">log<sub>𝑎</sub> 𝑀 = <sup>log<sub>𝑏</sub> 𝑀</sup>⁄<sub>log<sub>𝑏</sub> 𝑎</sub></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="modes" id="modos">
  <p class="section-label reveal">Modos especializados</p>
  <h2 class="section-h2 reveal">Muito mais do que um<br /><em>editor Markdown.</em></h2>

  <div class="modes-grid">
    <div class="mode-card mode-tcc reveal">
      <div class="mode-header">
        <span class="mode-emoji">📝</span>
        <span class="mode-name">Modo TCC</span>
      </div>
      <div class="mode-body">
        <h3 class="mode-title">Do esboço à conclusão, secção a secção.</h3>
        <p class="mode-desc">Copiloto académico que gera, desenvolve e mantém a coerência do teu TCC ao longo de todas as secções.</p>
        <ul class="mode-bullets">
          <li>Geração de esboço estruturado com IA</li>
          <li>Desenvolvimento de cada secção com contexto das anteriores</li>
          <li>Compressão automática de contexto — sem limites de janela</li>
          <li>Sessões persistentes com Supabase</li>
          <li>Inserção directa no editor Markdown</li>
        </ul>
      </div>
    </div>

    <div class="mode-card mode-work reveal" style="transition-delay:0.1s">
      <div class="mode-header">
        <span class="mode-emoji">📚</span>
        <span class="mode-name">Trabalho Escolar</span>
      </div>
      <div class="mode-body">
        <h3 class="mode-title">Copiloto para o ensino secundário e médio.</h3>
        <p class="mode-desc">Estrutura fixa (Índice, Introdução, Desenvolvimento, Conclusão, Referências) adaptada ao contexto moçambicano.</p>
        <ul class="mode-bullets">
          <li>6 secções pré-definidas + subtópicos do tema</li>
          <li>Conteúdo contextualizado para Moçambique</li>
          <li>Progresso visual secção a secção</li>
          <li>Retoma trabalhos anteriores a qualquer momento</li>
        </ul>
      </div>
    </div>

    <div class="mode-card mode-ai reveal" style="transition-delay:0.2s">
      <div class="mode-header">
        <span class="mode-emoji">✦</span>
        <span class="mode-name">IA Chat</span>
      </div>
      <div class="mode-body">
        <h3 class="mode-title">Gera Markdown com equações LaTeX em segundos.</h3>
        <p class="mode-desc">Chat com IA especializado em matemática e ciências. Respostas em Markdown com equações prontas a exportar.</p>
        <ul class="mode-bullets">
          <li>Explicações passo a passo com LaTeX</li>
          <li>Exercícios resolvidos com solução</li>
          <li>Inserção ou substituição do editor com um clique</li>
          <li>Streaming em tempo real</li>
        </ul>
      </div>
    </div>

    <div class="mode-card reveal" style="transition-delay:0.3s;background:#faf6ee">
      <div class="mode-header" style="border-color:var(--border)">
        <span class="mode-emoji">📐</span>
        <span class="mode-name" style="color:var(--muted)">Editor Principal</span>
      </div>
      <div class="mode-body">
        <h3 class="mode-title">Editor Markdown completo com suporte LaTeX.</h3>
        <p class="mode-desc">Escreve, importa ficheiros .md, insere quebras de página e secções, e exporta para Word em segundos.</p>
        <ul class="mode-bullets" style="--gold2:var(--gold2)">
          <li>Numeração de linhas em tempo real</li>
          <li>Drag & drop de ficheiros .md</li>
          <li>Marcadores {pagebreak} e {section}</li>
          <li>Contador de linhas e caracteres</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<div class="pwa-strip reveal">
  <p class="pwa-text"><strong>PWA Pronta para Instalar</strong> — usa offline, sem internet</p>
  <div class="pwa-badges">
    <span class="pwa-badge">Android / Chrome: Instalar</span>
    <span class="pwa-badge">iPhone / iPad: Partilhar → Ecrã inicial</span>
  </div>
</div>

<section class="cta-section" id="cta">
  <div class="cta-inner">
    <p class="section-label reveal">Começa agora</p>
    <h2 class="cta-h2 reveal">
      O teu próximo documento<br />
      <em>começa aqui.</em>
    </h2>
    <p class="cta-sub reveal">Grátis. Sem registo. Sem instalação obrigatória.</p>
    <div class="reveal" style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
      <a href="/" class="btn-primary" style="font-size:13px;padding:14px 32px">↓ Abrir docx — é grátis</a>
    </div>
    <p class="reveal" style="margin-top:2rem;font-family:'DM Mono',monospace;font-size:10px;color:var(--faint);letter-spacing:0.08em">
      temml · mathml2omml · docx · Quelimane, Moçambique
    </p>
  </div>
</section>

<footer>
  <div class="footer-left">
    docx · Markdown para Word com Equações Nativas · 2026
  </div>
  <div class="footer-right">
    feito com ∂ em Quelimane, Moçambique
  </div>
</footer>
`;

export default function LandingPage() {
  useEffect(() => {
    const cursor = document.getElementById('cursor');
    const ring = document.getElementById('cursorRing');

    if (!cursor || !ring) return;

    let mx = 0;
    let my = 0;
    let rx = 0;
    let ry = 0;
    let frame = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      cursor.setAttribute('style', `transform: translate(${mx - 6}px, ${my - 6}px);`);
    };

    const animateRing = () => {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.setAttribute('style', `transform: translate(${rx - 18}px, ${ry - 18}px);`);
      frame = requestAnimationFrame(animateRing);
    };

    document.addEventListener('mousemove', handleMouseMove);
    frame = requestAnimationFrame(animateRing);

    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('visible'), i * 40);
          }
        });
      },
      { threshold: 0.12 },
    );

    reveals.forEach(el => observer.observe(el));

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=DM+Mono:wght@300;400;500&family=Crimson+Pro:ital,wght@0,300;0,400;1,300;1,400&display=swap" rel="stylesheet" />

      <main className="landing-page-root" dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />

      <style jsx global>{`
        :root { --ink:#0f0e0d;--parchment:#f5f0e8;--gold:#c9a96e;--gold2:#8b6914;--shadow:#1e1a14;--muted:#6b6254;--faint:#c4b8a4;--green:#4a7c59;--teal:#3a8a7a;--border:#d8ceb8; }
        *,:before,:after{box-sizing:border-box;margin:0;padding:0;} html{scroll-behavior:smooth;}
        .landing-page-root{background:var(--parchment);color:var(--ink);font-family:'Crimson Pro',Georgia,serif;overflow-x:hidden;position:relative;cursor:none;}
        .landing-page-root *{cursor:none;}
        .landing-page-root:before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");background-size:180px;pointer-events:none;z-index:100;opacity:.6;}
        .cursor{width:12px;height:12px;background:var(--gold);border-radius:50%;position:fixed;top:0;left:0;pointer-events:none;z-index:9999;mix-blend-mode:multiply;transition:transform .15s ease,opacity .2s}.cursor-ring{width:36px;height:36px;border:1px solid var(--gold2);border-radius:50%;position:fixed;top:0;left:0;pointer-events:none;z-index:9998;opacity:.5;transition:transform .35s cubic-bezier(.23,1,.32,1),opacity .2s}
        nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:1.25rem 3rem;background:rgba(245,240,232,.88);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);animation:fadeDown .8s ease both}.nav-logo{display:flex;align-items:center;gap:.65rem}.nav-icon{width:30px;height:30px;background:linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%);border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:var(--ink)}.nav-name{font-family:'Playfair Display',serif;font-style:italic;font-size:18px;color:var(--gold2);letter-spacing:.02em}.nav-links{display:flex;gap:2rem;list-style:none;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.nav-links a{color:inherit;text-decoration:none;transition:color .2s}.nav-links a:hover{color:var(--gold2)}.nav-cta{background:var(--ink);color:var(--parchment);font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:8px 20px;border:none;border-radius:3px;cursor:none;text-decoration:none;transition:background .2s,transform .15s;display:inline-block}.nav-cta:hover{background:var(--gold2);transform:translateY(-1px)}
        .hero{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;padding-top:80px;overflow:hidden;position:relative}.hero-left{padding:8rem 3rem 6rem;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:2}.hero-eyebrow{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--green);margin-bottom:1.5rem;opacity:0;animation:fadeUp .8s .2s ease forwards;display:flex;align-items:center;gap:.5rem}.hero-eyebrow:before{content:'';width:28px;height:1px;background:var(--green)}.hero-h1{font-family:'Playfair Display',serif;font-size:clamp(2.8rem,5vw,4.2rem);line-height:1.12;font-weight:400;color:var(--ink);opacity:0;animation:fadeUp .9s .35s ease forwards;margin-bottom:1.5rem}.hero-h1 em{font-style:italic;color:var(--gold2)}.hero-h1 .outline-text{-webkit-text-stroke:1.5px var(--ink);color:transparent}.hero-sub{font-size:1.2rem;color:var(--muted);line-height:1.7;max-width:460px;opacity:0;animation:fadeUp .9s .5s ease forwards;margin-bottom:2.5rem}.hero-code{background:var(--ink);border-radius:8px;padding:1.2rem 1.5rem;font-family:'DM Mono',monospace;font-size:12px;line-height:1.8;opacity:0;animation:fadeUp .9s .65s ease forwards;margin-bottom:2.5rem;position:relative;overflow:hidden}.hero-code:before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(201,169,110,.08) 0%,transparent 60%);pointer-events:none}.code-line{color:#7a8a6a}.code-md{color:#c9a96e}.code-arrow{color:#8a6a4a}.code-omml{color:#a0c080}.hero-actions{display:flex;gap:1rem;align-items:center;opacity:0;animation:fadeUp .9s .8s ease forwards}.btn-primary{background:linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%);color:var(--ink);font-family:'DM Mono',monospace;font-size:12px;font-weight:500;letter-spacing:.08em;padding:13px 28px;border:none;border-radius:4px;cursor:none;text-decoration:none;display:inline-flex;align-items:center;gap:.5rem;transition:transform .2s,box-shadow .2s;box-shadow:0 4px 24px rgba(139,105,20,.25)}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(139,105,20,.35)}.btn-secondary{color:var(--muted);font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.08em;text-decoration:none;display:inline-flex;align-items:center;gap:.4rem;border-bottom:1px solid var(--border);padding-bottom:2px;transition:color .2s,border-color .2s}.btn-secondary:hover{color:var(--ink);border-color:var(--ink)}
        .hero-right{position:relative;overflow:hidden;background:var(--shadow)}.hero-right:before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 40%,rgba(201,169,110,.12) 0%,transparent 65%),radial-gradient(ellipse at 75% 70%,rgba(74,124,89,.08) 0%,transparent 55%)}.hero-mockup{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:3rem}.phone-frame{width:260px;background:#141210;border-radius:28px;border:1px solid #2a2520;box-shadow:0 40px 80px rgba(0,0,0,.6),0 0 0 1px rgba(201,169,110,.1);overflow:hidden;animation:floatPhone 6s ease-in-out infinite;position:relative;z-index:2}.phone-header{background:rgba(15,14,13,.95);border-bottom:1px solid #2a2520;padding:.6rem .85rem;display:flex;align-items:center;gap:.5rem}.phone-logo-icon{width:22px;height:22px;background:linear-gradient(135deg,#c9a96e,#8b6914);border-radius:3px;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:10px;font-weight:700;color:#0f0e0d}.phone-logo-text{font-family:'DM Mono',monospace;font-style:italic;font-size:11px;color:#c9a96e;letter-spacing:.05em}.phone-body{padding:.75rem .85rem;font-family:'DM Mono',monospace;font-size:10px;line-height:1.7;color:#8a7d6e}.phone-line{margin-bottom:2px}.ph-h1{color:#e8e2d9;font-size:11px}.ph-h2{color:#c9a96e;font-size:10px}.ph-math{color:#6a9e8f}.ph-text{color:#6a6259}.phone-export{margin:.6rem .85rem;background:linear-gradient(135deg,#c9a96e,#8b6914);border-radius:4px;padding:8px;text-align:center;font-family:'DM Mono',monospace;font-size:10px;color:#0f0e0d;font-style:italic}.float-tag{position:absolute;background:var(--parchment);border:1px solid var(--border);border-radius:6px;padding:.5rem .85rem;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.06em;color:var(--muted);box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:3}.ft1{top:18%;left:8%;animation:floatTag1 5s ease-in-out infinite}.ft2{bottom:22%;right:6%;animation:floatTag2 6s ease-in-out infinite}.ft3{top:60%;left:5%;animation:floatTag3 7s ease-in-out infinite}.ft-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px}.ft-green{background:var(--green)}.ft-gold{background:var(--gold)}.ft-teal{background:var(--teal)}
        .marquee-wrap{overflow:hidden;border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:1rem 0;background:var(--ink)}.marquee-track{display:flex;gap:3rem;animation:marquee 28s linear infinite;white-space:nowrap}.marquee-item{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#5a5248;display:flex;align-items:center;gap:1rem;flex-shrink:0}.marquee-item span{color:var(--gold)}
        .features{padding:7rem 3rem;max-width:1200px;margin:0 auto}.section-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint);margin-bottom:1rem;display:flex;align-items:center;gap:.5rem}.section-label:before{content:'';width:20px;height:1px;background:var(--faint)}.section-h2{font-family:'Playfair Display',serif;font-size:clamp(2rem,3.5vw,3rem);font-weight:400;line-height:1.2;color:var(--ink);margin-bottom:1rem}.section-h2 em{color:var(--gold2);font-style:italic}.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5px;margin-top:4rem;border:1.5px solid var(--border);border-radius:10px;overflow:hidden}.feat-card{padding:2.5rem;border:1.5px solid var(--border);background:var(--parchment);transition:background .3s;position:relative;overflow:hidden}.feat-card:after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:0;transition:opacity .3s}.feat-card:hover{background:#f0e8d8}.feat-card:hover:after{opacity:1}.feat-icon{font-size:1.6rem;margin-bottom:1.25rem}.feat-title{font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:400;color:var(--ink);margin-bottom:.6rem}.feat-desc{font-size:.95rem;color:var(--muted);line-height:1.65}.feat-tag{display:inline-block;margin-top:1rem;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border-radius:2px;border:1px solid var(--border);color:var(--faint)}
        .how{background:var(--ink);padding:7rem 3rem;position:relative;overflow:hidden}.how:before{content:'';position:absolute;top:-100px;right:-100px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(201,169,110,.06) 0%,transparent 70%);pointer-events:none}.how-inner{max-width:1200px;margin:0 auto}.how .section-label{color:#3a3530}.how .section-label:before{background:#3a3530}.how .section-h2{color:#e8e2d9}.how .section-h2 em{color:var(--gold)}.steps{display:grid;grid-template-columns:repeat(4,1fr);margin-top:4rem;position:relative}.steps:before{content:'';position:absolute;top:24px;left:5%;right:5%;height:1px;background:linear-gradient(90deg,transparent,#2a2520 20%,#2a2520 80%,transparent)}.step{padding:0 1.5rem;position:relative}.step-num{width:48px;height:48px;border-radius:50%;background:#1a1714;border:1px solid #3a3530;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:11px;color:var(--gold);letter-spacing:.05em;margin-bottom:1.5rem;position:relative;z-index:1}.step-title{font-family:'Playfair Display',serif;font-size:1.05rem;color:#d8d0c5;margin-bottom:.5rem}.step-desc{font-size:.9rem;color:#5a5248;line-height:1.65}
        .equations{background:#faf6ee;border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:5rem 3rem;overflow:hidden}.eq-inner{max-width:900px;margin:0 auto}.eq-title{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:400;text-align:center;margin-bottom:3rem}.eq-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:1rem;align-items:center;margin-bottom:2rem}.eq-box{border:1px solid var(--border);border-radius:6px;padding:1rem 1.25rem;font-family:'DM Mono',monospace;font-size:13px;background:var(--parchment)}.eq-box.dark{background:var(--ink);border-color:#2a2520;color:#6a9e8f}.eq-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:var(--faint);margin-bottom:.4rem}.eq-arrow{width:40px;text-align:center;font-family:'DM Mono',monospace;font-size:14px;color:var(--gold2)}.eq-result{font-family:'Playfair Display',serif;font-size:1.4rem;font-style:italic;text-align:center;color:var(--ink)}
        .modes{padding:7rem 3rem;max-width:1200px;margin:0 auto}.modes-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;margin-top:4rem}.mode-card{border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:transform .3s,box-shadow .3s;position:relative}.mode-card:hover{transform:translateY(-4px);box-shadow:0 24px 48px rgba(0,0,0,.12)}.mode-header{padding:1.5rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:.75rem}.mode-emoji{font-size:1.4rem}.mode-name{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.mode-body{padding:1.75rem}.mode-title{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:400;margin-bottom:.75rem}.mode-desc{font-size:.95rem;color:var(--muted);line-height:1.7;margin-bottom:1.25rem}.mode-bullets{list-style:none}.mode-bullets li{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.06em;color:var(--muted);padding:.4rem 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:.6rem}.mode-bullets li:last-child{border-bottom:none}.mode-bullets li:before{content:'→';color:var(--gold2)}.mode-tcc{background:#0b0d0b;border-color:#1e2a1e}.mode-tcc .mode-header{border-color:#1e2a1e;background:rgba(11,13,11,.95)}.mode-tcc .mode-name{color:#6a9e5f}.mode-tcc .mode-title{color:#d0dcc8}.mode-tcc .mode-desc{color:#4a6644}.mode-tcc .mode-bullets li{border-color:#1e2a1e;color:#4a6644}.mode-tcc .mode-bullets li:before{color:#6a9e5f}.mode-work{background:#0a0d0a;border-color:#1a2a1a}.mode-work .mode-header{border-color:#1a2a1a;background:rgba(10,13,10,.95)}.mode-work .mode-name{color:#5a9e8f}.mode-work .mode-title{color:#c8dcd6}.mode-work .mode-desc{color:#3a6e60}.mode-work .mode-bullets li{border-color:#1a2a1a;color:#3a6e60}.mode-work .mode-bullets li:before{color:#5a9e8f}.mode-ai{background:#0d0c0b;border-color:#2a2520}.mode-ai .mode-header{border-color:#2a2520}.mode-ai .mode-name{color:#c9a96e}.mode-ai .mode-title{color:#d8d0c7}.mode-ai .mode-desc{color:#5a5248}.mode-ai .mode-bullets li{border-color:#2a2520;color:#5a5248}.mode-ai .mode-bullets li:before{color:#c9a96e}
        .pwa-strip{background:var(--ink);padding:2rem 3rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}.pwa-text{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.08em;color:#5a5248;text-transform:uppercase}.pwa-text strong{color:var(--gold)}.pwa-badges{display:flex;gap:.75rem}.pwa-badge{border:1px solid #3a3530;border-radius:20px;padding:5px 14px;font-family:'DM Mono',monospace;font-size:10px;color:#8a7d6e;letter-spacing:.05em}
        .cta-section{padding:9rem 3rem;text-align:center;position:relative;overflow:hidden}.cta-section:before{content:'docx';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:'Playfair Display',serif;font-style:italic;font-size:clamp(10rem,25vw,22rem);font-weight:700;color:rgba(0,0,0,.025);white-space:nowrap;pointer-events:none;z-index:0}.cta-inner{position:relative;z-index:1}.cta-section .section-label{justify-content:center}.cta-section .section-label:before{display:none}.cta-h2{font-family:'Playfair Display',serif;font-size:clamp(2.5rem,5vw,4rem);font-weight:400;line-height:1.15;color:var(--ink);margin:1rem 0 2rem}.cta-h2 em{color:var(--gold2)}.cta-sub{font-size:1.1rem;color:var(--muted);margin-bottom:2.5rem}footer{border-top:1px solid var(--border);padding:2rem 3rem;display:flex;align-items:center;justify-content:space-between;background:var(--parchment)}.footer-left{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.08em;color:var(--faint)}.footer-right{font-size:.85rem;color:var(--faint);font-style:italic}
        @keyframes fadeDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes floatPhone{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-18px) rotate(.5deg)}}@keyframes floatTag1{0%,100%{transform:translateY(0)}60%{transform:translateY(-12px) translateX(4px)}}@keyframes floatTag2{0%,100%{transform:translateY(0)}45%{transform:translateY(-16px)}}@keyframes floatTag3{0%,100%{transform:translateY(0)}70%{transform:translateY(-10px) translateX(-3px)}}@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}.cursor-blink{display:inline-block;width:2px;height:1em;background:var(--gold);vertical-align:text-bottom;animation:blink 1s step-end infinite}.reveal{opacity:0;transform:translateY(30px);transition:opacity .7s ease,transform .7s ease}.reveal.visible{opacity:1;transform:translateY(0)}
        @media (max-width:900px){.hero{grid-template-columns:1fr}.hero-right{display:none}.features-grid{grid-template-columns:1fr 1fr}.steps{grid-template-columns:1fr 1fr;gap:2rem}.steps:before{display:none}.modes-grid{grid-template-columns:1fr}nav{padding:1rem 1.5rem}.nav-links{display:none}.hero-left{padding:6rem 1.5rem 4rem}.features,.modes{padding:4rem 1.5rem}.cta-section{padding:5rem 1.5rem}.pwa-strip{flex-direction:column}footer{flex-direction:column;gap:.5rem;text-align:center}}
      `}</style>
    </>
  );
}
