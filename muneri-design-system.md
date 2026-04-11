# Muneri Design System

> Sistema visual editorial do produto **Muneri** — gerador automático de trabalhos académicos.  
> Quelimane, Moçambique · Next.js 14+ · TypeScript · Tailwind CSS

---

## Índice

1. [Filosofia Visual](#filosofia-visual)
2. [Tokens de Cor](#tokens-de-cor)
3. [Estrutura de Tema](#estrutura-de-tema)
4. [Tipografia](#tipografia)
5. [Botões](#botões)
6. [Inputs e Forms](#inputs-e-forms)
7. [Cards e Grids](#cards-e-grids)
8. [Secções](#secções)
9. [Navegação](#navegação)
10. [Footer](#footer)
11. [Tabelas](#tabelas)
12. [Feedback de Estado](#feedback-de-estado)
13. [Logo Muneri](#logo-muneri)
14. [Checklist de Migração](#checklist-de-migração)
15. [Mapeamento de Tokens Antigos](#mapeamento-de-tokens-antigos)

---

## Filosofia Visual

O Muneri Design System é **editorial, não corporativo**. Caracteriza-se por:

- **Paleta de pergaminho, ouro e tinta** — sem azuis, roxos ou gradientes genéricos de SaaS
- **Tipografia mista** — `font-serif` para títulos, `font-mono` para labels/badges, sans-serif para corpo
- **Dark mode por defeito** com toggle disponível ao utilizador
- **Dark/light mode controlado por CSS custom properties** no `<main>` — nunca por classes `dark:` do Tailwind
- **Densidade editorial** — espaços generosos, bordas subtis, zero sombras pesadas
- **`<em>` para ênfase em títulos** (nunca `<span>`)

---

## Tokens de Cor

### Dark Mode (padrão)

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#f1e8da` | Texto principal — creme claro |
| `--parchment` | `#0f0e0d` | Fundo — quase preto |
| `--gold` | `#d4b37b` | Ouro primário — gradiente `from` |
| `--gold2` | `#c9a96e` | Ouro secundário — gradiente `to`, links de ênfase |
| `--muted` | `#c8bfb4` | Texto secundário |
| `--faint` | `#8a7d6e` | Texto terciário, labels, metadados |
| `--green` | `#6ea886` | Sucesso, categoria universitária |
| `--teal` | `#61aa9d` | Variante verde-azulada |
| `--border` | `#2c2721` | Bordas de cards e separadores |
| `--navBg` | `#0f0e0d` | Fundo da nav com backdrop-blur |
| `--heroRight` | `#090908` | Fundo escuro fixo — **sempre escuro em ambos os temas** |

### Light Mode

| Token | Valor |
|---|---|
| `--ink` | `#0f0e0d` |
| `--parchment` | `#f5f0e8` |
| `--gold` | `#c9a96e` |
| `--gold2` | `#8b6914` |
| `--muted` | `#6b6254` |
| `--faint` | `#c4b8a4` |
| `--green` | `#4a7c59` |
| `--teal` | `#3a8a7a` |
| `--border` | `#d8ceb8` |
| `--navBg` | `#f5f0e8` |
| `--heroRight` | `#1e1a14` |

---

## Estrutura de Tema

### Hook de tema

```ts
// @/hooks/useThemeMode
// Retorna: { themeMode: 'dark' | 'light', toggleThemeMode: () => void }
import { useThemeMode } from '@/hooks/useThemeMode';
```

### String `themeVars` (copiar directamente)

```tsx
const themeVars =
  themeMode === 'dark'
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';
```

### Estrutura obrigatória de qualquer página

```tsx
'use client';
import { useThemeMode } from '@/hooks/useThemeMode';

export default function NomeDaPagina() {
  const { themeMode, toggleThemeMode } = useThemeMode();

  const themeVars =
    themeMode === 'dark'
      ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--navBg:#0f0e0d] [--heroRight:#090908]'
      : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--navBg:#f5f0e8] [--heroRight:#1e1a14]';

  return (
    <main className={`${themeVars} min-h-screen bg-[var(--parchment)] text-[var(--ink)]`}>
      {/* conteúdo */}
    </main>
  );
}
```

> **Nunca usar:** `data-theme`, `--bg-base`, `--bg-surface`, `--text-primary`, `dark:` Tailwind.

---

## Tipografia

| Uso | Classe Tailwind |
|---|---|
| H1 principal | `font-serif text-[1.9rem] leading-[1.2] sm:text-4xl md:text-5xl lg:text-6xl` |
| H2 de secção | `font-serif text-2xl leading-snug sm:text-3xl md:text-4xl lg:text-5xl` |
| H3 de card | `font-serif text-xl sm:text-2xl` |
| Label / badge | `font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--faint)]` |
| Label de destaque | `font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--green)]` |
| Corpo | `text-base leading-relaxed text-[var(--muted)] sm:text-lg` |
| Ênfase em título | `<em className="text-[var(--gold2)]">texto</em>` |

> Usar sempre `<em>` para ênfases, nunca `<span>`.

---

## Botões

```tsx
{/* Primário — acção principal */}
<button className="flex items-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink)] shadow-lg">
  <ArrowDown size={13} /> Acção principal
</button>

{/* Secundário */}
<button className="flex items-center gap-1.5 rounded border border-[var(--border)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">
  Secundário
</button>

{/* Link sublinhado */}
<a href="#" className="flex items-center gap-1 border-b border-[var(--border)] pb-0.5 font-mono text-xs uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--ink)]">
  Ver mais <ChevronRight size={12} />
</a>

{/* Escuro — usado na nav */}
<Link href="/app" className="flex items-center gap-1.5 rounded bg-[var(--ink)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]">
  <ArrowDown size={12} /> Abrir app
</Link>
```

---

## Inputs e Forms

```tsx
{/* Label */}
<label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
  Nome do campo
</label>

{/* Input */}
<input className="mt-1.5 w-full rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] placeholder-[var(--faint)] outline-none transition focus:border-[var(--gold2)]" />

{/* Select */}
<select className="mt-1.5 w-full rounded border border-[var(--border)] bg-[var(--parchment)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold2)]">
  <option value="a">Opção A</option>
</select>

{/* Textarea */}
<textarea rows={4} className="mt-1.5 w-full resize-none rounded border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] placeholder-[var(--faint)] outline-none transition focus:border-[var(--gold2)]" />
```

---

## Cards e Grids

### Grid de cards (padrão gap-px)

```tsx
<div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-[var(--border)] sm:grid-cols-2 md:grid-cols-3">
  {items.map(({ icon, title, desc }) => (
    <article key={title} className="space-y-3 bg-[var(--parchment)] p-6 sm:p-8">
      <div className="text-[var(--gold2)]">{icon}</div>
      <h3 className="font-serif text-xl sm:text-2xl">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--muted)]">{desc}</p>
    </article>
  ))}
</div>
```

### Card individual (planos, itens)

```tsx
<article className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-6 sm:p-8">
  <div className="flex items-start justify-between gap-2">
    <div>
      <h3 className="font-serif text-2xl">Título</h3>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">categoria</p>
    </div>
    <span className="rounded border border-[var(--border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
      Badge
    </span>
  </div>
  <div className="rounded-lg border border-[var(--border)] p-4">
    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">Destaque</p>
    <p className="mt-1 font-serif text-3xl text-[var(--gold2)]">Valor</p>
  </div>
  <ul className="space-y-1 text-sm text-[var(--muted)]">
    <li>• Feature: <span className="text-[var(--ink)]">normal</span></li>
    <li>• Activa: <span className="text-[var(--green)]">Sim</span></li>
    <li>• Inactiva: <span className="text-[var(--faint)]">Não</span></li>
  </ul>
</article>
```

---

## Secções

### Spacing de secção

| Situação | Classe |
|---|---|
| Standard | `px-5 py-12 sm:px-6 md:px-12 md:py-16` |
| Com max-width centrado | + `mx-auto w-full max-w-7xl` |
| Com borda top+bottom | + `border-y border-[var(--border)]` |
| Espaço label → H2 | `mb-3` no `<p>` rótulo |
| Espaço H2 → conteúdo | `mt-8` |

### Hero de página interna

```tsx
<section className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-6 md:px-12 md:py-16">
  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--green)]">
    Muneri · Subtítulo da página
  </p>
  <h1 className="mt-3 font-serif text-[1.9rem] leading-[1.2] sm:text-4xl md:text-5xl md:leading-tight lg:text-6xl">
    Título principal com{' '}
    <em className="text-[var(--gold2)]">ênfase aqui.</em>
  </h1>
  <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
    Descrição da página.
  </p>
</section>
```

### Secção com rótulo + H2

```tsx
<section id="anchor" className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-6 md:px-12 md:py-16">
  <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">
    Rótulo da secção
  </p>
  <h2 className="font-serif text-2xl leading-snug sm:text-3xl md:text-4xl lg:text-5xl">
    Título com <em className="text-[var(--gold2)]">ênfase.</em>
  </h2>
</section>
```

### Secção escura fixa ("Como funciona")

> `--heroRight` é **sempre escuro** em ambos os temas. Dentro, usar cores fixas.

```tsx
<section className="bg-[var(--heroRight)] px-5 py-12 sm:px-6 md:px-12 md:py-16">
  <div className="mx-auto w-full max-w-7xl">
    <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">Rótulo</p>
    <h2 className="font-serif text-2xl text-[#f1e8da] sm:text-3xl md:text-4xl lg:text-5xl">
      Título <em className="text-[var(--gold)]">ênfase.</em>
    </h2>
    <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
      {steps.map(({ num, title, desc }) => (
        <div key={num} className="space-y-3">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-[#3a3530] bg-[#1a1714] font-mono text-xs text-[var(--gold)]">
            {num}
          </div>
          <h3 className="font-serif text-lg text-[#f1e8da]">{title}</h3>
          <p className="text-sm leading-relaxed text-[#c8bfb4]">{desc}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

### CTA Final (igual em todas as páginas)

```tsx
<section className="border-y border-[var(--border)] px-5 py-12 text-center sm:px-6 md:px-12 md:py-16">
  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">Começa agora</p>
  <h2 className="mt-4 font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
    O teu próximo documento <em className="text-[var(--gold2)]">começa aqui.</em>
  </h2>
  <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
    Grátis. Simples. Feito para quem quer terminar o trabalho com tranquilidade.
  </p>
  <div className="mt-8 flex justify-center">
    <Link href="/app" className="flex items-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-7 py-3 font-mono text-[13px] uppercase tracking-[0.08em] text-[var(--ink)] sm:px-8 sm:py-[14px]">
      <ArrowDown size={14} /> Começar agora — é grátis
    </Link>
  </div>
  <p className="mt-8 font-mono text-[10px] tracking-[0.08em] text-[var(--faint)]">
    Muneri · Trabalhos acadêmicos automáticos · Quelimane, Moçambique
  </p>
</section>
```

---

## Navegação

```tsx
import { Sun, Moon, ArrowDown } from 'lucide-react';
import Link from 'next/link';

function MuneriNav({
  themeMode,
  onToggleTheme,
  activeHref = '/planos',
}: {
  themeMode: 'dark' | 'light';
  onToggleTheme: () => void;
  activeHref?: string;
}) {
  const navLinks = [
    { href: '/#features', label: 'Vantagens' },
    { href: '/#modos', label: 'Para quem é' },
    { href: '/#resultado', label: 'Resultado final' },
    { href: '/planos', label: 'Planos' },
  ];

  const ThemeToggle = ({ size = 12 }: { size?: number }) => (
    <button
      type="button"
      onClick={onToggleTheme}
      className="flex items-center gap-1.5 rounded border border-[var(--border)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
    >
      {themeMode === 'dark' ? <><Sun size={size} /> Claro</> : <><Moon size={size} /> Escuro</>}
    </button>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)]/80 bg-[var(--navBg)]/90 px-4 py-3 backdrop-blur md:px-12 md:py-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
        {/* Logo + mobile controls */}
        <div className="flex items-center justify-between md:justify-start md:gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">∂</div>
            <span className="font-serif text-xl italic text-[var(--gold2)]">Muneri</span>
          </Link>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle size={11} />
            <Link href="/app" className="flex items-center gap-1 rounded bg-[var(--ink)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]">
              <ArrowDown size={11} /> Abrir
            </Link>
          </div>
        </div>
        {/* Links desktop */}
        <ul className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] md:flex">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={href === activeHref ? 'text-[var(--gold2)]' : 'hover:text-[var(--gold2)]'}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
        {/* Actions desktop */}
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle size={12} />
          <Link href="/app" className="flex items-center gap-1.5 rounded bg-[var(--ink)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--parchment)] transition hover:bg-[var(--gold2)]">
            <ArrowDown size={12} /> Abrir app
          </Link>
        </div>
        {/* Links mobile */}
        <ul className="flex w-full items-center gap-5 overflow-x-auto pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] md:hidden">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={`whitespace-nowrap ${href === activeHref ? 'text-[var(--gold2)]' : 'hover:text-[var(--gold2)]'}`}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
```

---

## Footer

```tsx
<footer className="flex flex-col gap-2 px-5 py-6 text-center sm:px-6 md:flex-row md:items-center md:justify-between md:px-12 md:text-left">
  <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
    Muneri · Gerador automático de trabalhos académicos · 2026
  </div>
  <div className="text-sm italic text-[var(--faint)]">feito com ∂ em Quelimane, Moçambique</div>
</footer>
```

---

## Tabelas

```tsx
<div className="overflow-x-auto rounded-xl border border-[var(--border)]">
  <table className="w-full min-w-[680px] border-collapse text-left text-sm">
    <thead>
      <tr className="border-b border-[var(--border)] bg-[var(--heroRight)]">
        {cols.map((c) => (
          <th key={c} className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#c8bfb4]">{c}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.id} className="border-b border-[var(--border)]/70 transition hover:bg-[var(--border)]/20">
          <td className="px-5 py-3 font-serif text-base">{row.label}</td>
          <td className="px-5 py-3 font-mono text-sm text-[var(--gold2)]">{row.value}</td>
          <td className="px-5 py-3 text-sm text-[var(--muted)]">{row.meta}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Feedback de Estado

```tsx
{/* Sucesso */}
<div className="rounded border border-[var(--green)]/40 bg-[var(--green)]/10 px-3 py-2 font-mono text-[11px] text-[var(--green)]">
  Mensagem de sucesso
</div>

{/* Erro */}
<div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
  Mensagem de erro
</div>
```

---

## Logo Muneri

```tsx
<div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] font-mono text-sm font-bold text-black">∂</div>
<span className="font-serif text-xl italic text-[var(--gold2)]">Muneri</span>
```

> O símbolo `∂` (derivada parcial) é o ícone do produto. **Nunca substituir por outro ícone.**

---

## Checklist de Migração

Antes de fazer commit de qualquer página ou componente, verificar:

- [ ] `themeVars` com os 11 tokens aplicada no `<main>`
- [ ] `useThemeMode` importado e utilizado
- [ ] Nenhum `data-theme` ou variável CSS de sistema antigo (`--bg-base`, `--text-primary`, etc.)
- [ ] Nenhuma cor Tailwind hardcoded para backgrounds/textos principais (`bg-gray-950`, `text-white`, etc.)
- [ ] Títulos em `font-serif`, labels em `font-mono`, botão primário com gradiente gold
- [ ] Nav com toggle de tema
- [ ] Footer com assinatura Muneri
- [ ] `<em>` para ênfases em títulos (nunca `<span>`)
- [ ] Inputs com `bg-transparent focus:border-[var(--gold2)]`
- [ ] Feedback de sucesso em `var(--green)`, erro em `red-400`

---

## Mapeamento de Tokens Antigos

| Antigo / hardcoded | Muneri |
|---|---|
| `--bg-base`, `bg-gray-950`, `bg-zinc-900`, `bg-black` | `bg-[var(--parchment)]` |
| `--text-primary`, `text-white`, `text-gray-100` | `text-[var(--ink)]` |
| `--text-muted`, `text-gray-400` | `text-[var(--muted)]` |
| `--text-secondary`, `text-gray-500` | `text-[var(--faint)]` |
| `border-zinc-700`, `border-gray-800` | `border-[var(--border)]` |
| `--bg-surface`, `--bg-card`, `bg-zinc-800` | `bg-[var(--parchment)]` + `border-[var(--border)]` |
| `bg-blue-500`, `bg-indigo-600` (acção primária) | `bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)]` |
| `text-blue-400`, accent links | `text-[var(--gold2)]` |
| `text-emerald-400`, sucesso | `text-[var(--green)]` |
| Fundo escuro fixo (hero, "como funciona") | `bg-[var(--heroRight)]` |

---

*Muneri · Quelimane, Moçambique · feito com ∂*
