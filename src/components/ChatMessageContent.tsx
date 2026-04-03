'use client';

/**
 * ChatMessageContent
 *
 * Renderiza mensagens com:
 *  - LaTeX display:  $$…$$  ou  \[…\]  ou  ```math … ```  ou  ```latex … ```
 *  - LaTeX inline:   $…$   ou  \(…\)
 *  - Markdown leve: **bold**, *italic*, `code`, > blockquote, # headings, ---
 *  - Blocos de código com syntax highlight mínimo
 *  - Segurança: nunca usa dangerouslySetInnerHTML sem sanitização
 */

import { useEffect, useRef, type ReactNode } from 'react';

// ── KaTeX loader (CDN fallback se não estiver instalado) ─────────────────────

declare global {
  interface Window {
    katex?: {
      renderToString: (tex: string, opts?: object) => string;
    };
  }
}

let katexLoaded = false;
let katexLoading = false;
const katexCallbacks: Array<() => void> = [];

function loadKaTeX(cb: () => void) {
  if (katexLoaded) { cb(); return; }
  katexCallbacks.push(cb);
  if (katexLoading) return;
  katexLoading = true;

  // CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css';
  document.head.appendChild(link);

  // JS
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js';
  script.onload = () => {
    katexLoaded = true;
    katexCallbacks.forEach(fn => fn());
    katexCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

// ── Renderiza LaTeX num elemento ─────────────────────────────────────────────

function KatexBlock({ tex, display }: { tex: string; display: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const render = () => {
      if (!ref.current || !window.katex) return;
      try {
        ref.current.innerHTML = window.katex.renderToString(tex, {
          displayMode: display,
          throwOnError: false,
          strict: false,
        });
      } catch {
        if (ref.current) ref.current.textContent = tex;
      }
    };
    loadKaTeX(render);
  }, [tex, display]);

  return (
    <span
      ref={ref}
      style={display ? {
        display: 'block',
        overflowX: 'auto',
        padding: '14px 18px',
        margin: '10px 0',
        background: 'var(--math-bg, #1a1a1a)',
        border: '1px solid var(--math-border, #2e2e2e)',
        borderRadius: 8,
        textAlign: 'center',
        fontSize: '1.05em',
      } : { display: 'inline' }}
    >
      {tex}
    </span>
  );
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type Token =
  | { type: 'math-display'; value: string }
  | { type: 'math-inline'; value: string }
  | { type: 'code-block'; lang: string; value: string }
  | { type: 'text'; value: string };

function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];

  // Regex por ordem de prioridade (mais específico primeiro)
  const RE = new RegExp(
    // 1. Bloco de código com linguagem math/latex → display math
    '```(?:math|latex)\\n?([\\s\\S]*?)```' +
    // 2. Bloco de código genérico
    '|```(?:(\\w*)\\n)?([\\s\\S]*?)```' +
    // 3. Display math: $$…$$
    '|\\$\\$([\\s\\S]*?)\\$\\$' +
    // 4. Display math: \[…\]
    '|\\\\\\[([\\s\\S]*?)\\\\\\]' +
    // 5. Inline math: \(…\)
    '|\\\\\\(([\\s\\S]*?)\\\\\\)' +
    // 6. Inline math: $…$ (não confundir com $$)
    '|(?<!\\$)\\$(?!\\$)([^$\n]+?)(?<!\\$)\\$(?!\\$)',
    'g',
  );

  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = RE.exec(raw)) !== null) {
    if (m.index > last) {
      tokens.push({ type: 'text', value: raw.slice(last, m.index) });
    }

    if (m[1] !== undefined) {
      // math/latex code block → display math
      tokens.push({ type: 'math-display', value: m[1].trim() });
    } else if (m[3] !== undefined) {
      // generic code block
      tokens.push({ type: 'code-block', lang: m[2] ?? '', value: m[3] });
    } else if (m[4] !== undefined) {
      tokens.push({ type: 'math-display', value: m[4].trim() });
    } else if (m[5] !== undefined) {
      tokens.push({ type: 'math-display', value: m[5].trim() });
    } else if (m[6] !== undefined) {
      tokens.push({ type: 'math-inline', value: m[6].trim() });
    } else if (m[7] !== undefined) {
      tokens.push({ type: 'math-inline', value: m[7].trim() });
    }

    last = RE.lastIndex;
  }

  if (last < raw.length) {
    tokens.push({ type: 'text', value: raw.slice(last) });
  }

  return tokens;
}

// ── Markdown leve para texto simples ─────────────────────────────────────────

function renderInlineMarkdown(text: string): ReactNode[] {
  // Processa: **bold**, *italic*, `code`
  const parts: ReactNode[] = [];
  const RE = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2]) parts.push(<strong key={key++} style={{ color: 'var(--chat-text, #f0f0f0)', fontWeight: 700 }}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={key++}>{m[3]}</em>);
    else if (m[4]) parts.push(
      <code key={key++} style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.88em',
        padding: '1px 5px',
        borderRadius: 4,
        background: 'var(--inline-code-bg, #2a2a2a)',
        border: '1px solid var(--chat-border, #2f2f2f)',
        color: 'var(--chat-accent, #f59e0b)',
      }}>{m[4]}</code>
    );
    last = RE.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderTextBlock(raw: string): ReactNode {
  const lines = raw.split('\n');
  const nodes: ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Heading
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      const sizes = ['1.15em', '1.05em', '0.98em', '0.93em'];
      nodes.push(
        <Tag key={key++} style={{
          fontSize: sizes[level - 1],
          fontWeight: 700,
          color: 'var(--chat-text, #f0f0f0)',
          margin: '14px 0 6px',
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
        }}>
          {renderInlineMarkdown(hMatch[2])}
        </Tag>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--chat-border, #2f2f2f)', margin: '12px 0' }} />);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={key++} style={{
          borderLeft: '3px solid var(--chat-accent, #f59e0b)',
          paddingLeft: 10,
          margin: '6px 0',
          color: 'var(--chat-text-muted, #b5b5b5)',
          fontStyle: 'italic',
          fontSize: '0.93em',
        }}>
          {renderInlineMarkdown(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Lista com bullet
    if (/^[-*•]\s/.test(line)) {
      nodes.push(
        <li key={key++} style={{
          listStyle: 'none',
          paddingLeft: 14,
          position: 'relative',
          margin: '3px 0',
          lineHeight: 1.6,
          color: 'var(--chat-text, #f0f0f0)',
        }}>
          <span style={{
            position: 'absolute',
            left: 0,
            color: 'var(--chat-accent, #f59e0b)',
            fontSize: '0.7em',
            top: '0.35em',
          }}>◆</span>
          {renderInlineMarkdown(line.replace(/^[-*•]\s/, ''))}
        </li>
      );
      continue;
    }

    // Lista numerada
    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      nodes.push(
        <li key={key++} style={{
          listStyle: 'none',
          paddingLeft: 22,
          position: 'relative',
          margin: '3px 0',
          lineHeight: 1.6,
          color: 'var(--chat-text, #f0f0f0)',
        }}>
          <span style={{
            position: 'absolute',
            left: 0,
            color: 'var(--chat-accent, #f59e0b)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.8em',
            top: '0.15em',
          }}>{numMatch[1]}.</span>
          {renderInlineMarkdown(numMatch[2])}
        </li>
      );
      continue;
    }

    // Linha vazia → espaço
    if (line.trim() === '') {
      if (nodes.length > 0) nodes.push(<div key={key++} style={{ height: 6 }} />);
      continue;
    }

    // Parágrafo normal
    nodes.push(
      <p key={key++} style={{
        margin: '3px 0',
        lineHeight: 1.7,
        color: 'var(--chat-text, #f0f0f0)',
      }}>
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  return <>{nodes}</>;
}

// ── Bloco de código com header ────────────────────────────────────────────────

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div style={{
      margin: '10px 0',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--chat-border, #2f2f2f)',
    }}>
      {lang && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 12px',
          background: 'var(--code-header-bg, #252525)',
          borderBottom: '1px solid var(--chat-border, #2f2f2f)',
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--chat-accent, #f59e0b)',
            textTransform: 'uppercase',
          }}>{lang}</span>
        </div>
      )}
      <pre style={{
        margin: 0,
        padding: '12px 14px',
        overflowX: 'auto',
        background: 'var(--code-bg, #181818)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.84em',
        lineHeight: 1.6,
        color: 'var(--code-text, #d4d4d4)',
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  content: string;
  role: 'user' | 'assistant';
}

export function ChatMessageContent({ content, role }: Props) {
  const tokens = tokenize(content);

  return (
    <div style={{
      fontFamily: role === 'user'
        ? 'JetBrains Mono, monospace'
        : 'system-ui, -apple-system, sans-serif',
      fontSize: role === 'user' ? '0.88em' : '0.9em',
      lineHeight: 1.65,
      color: 'var(--chat-text, #f0f0f0)',
    }}>
      {tokens.map((token, i) => {
        switch (token.type) {
          case 'math-display':
            return <KatexBlock key={i} tex={token.value} display={true} />;
          case 'math-inline':
            return <KatexBlock key={i} tex={token.value} display={false} />;
          case 'code-block':
            return <CodeBlock key={i} lang={token.lang} code={token.value} />;
          case 'text':
            return <span key={i}>{renderTextBlock(token.value)}</span>;
          default:
            return null;
        }
      })}
    </div>
  );
}
