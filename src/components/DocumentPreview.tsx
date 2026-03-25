'use client';

import { Fragment, useMemo, type ElementType, type ReactNode } from 'react';
import temml from 'temml';
import { parseToAST } from '@/lib/docx/parser';
import type { DocumentNode, InlineNode, TableAlign, TableRowNode } from '@/lib/docx/types';

interface Props {
  markdown: string;
  isMobile?: boolean;
}

type PreviewPage = {
  key: string;
  nodes: DocumentNode[];
  startsNewSection: boolean;
};

export function DocumentPreview({ markdown, isMobile = false }: Props) {
  const pages = useMemo(() => buildPages(markdown), [markdown]);

  return (
    <section className="rounded-xl border border-[#d9cec0] bg-[#d8d8d8] p-3 md:p-6">
      <header className="mb-3 flex items-center justify-between gap-3 md:mb-4">
        <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4d4338]">Pré-visualização (A4)</h3>
        <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-[#6f6458]">Estilo Word · Times New Roman</span>
      </header>

      <div className="grid gap-4 md:gap-6">
        {pages.map((page, index) => (
          <article
            key={page.key}
            className="mx-auto w-full max-w-[794px] bg-white text-[#111] shadow-[0_10px_28px_rgba(0,0,0,0.16)]"
            style={{
              minHeight: isMobile ? '960px' : '1123px',
              padding: isMobile ? '56px 44px' : '96px',
              fontFamily: '"Times New Roman", Times, serif',
              fontSize: '16px',
              lineHeight: 1.5,
            }}
          >
            {page.startsNewSection && (
              <p style={{ margin: '0 0 1.2rem 0', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6d6458' }}>
                Nova secção
              </p>
            )}

            <div style={{ display: 'grid', gap: '0.9rem' }}>
              {page.nodes.length > 0
                ? page.nodes.map((node, nodeIndex) => <PreviewBlockNode key={nodeIndex} node={node} />)
                : <p style={{ margin: 0, color: '#6f665a' }}>Página em branco</p>}
            </div>

            <footer style={{ marginTop: '1.6rem', textAlign: 'center', fontSize: '12px', color: '#928575' }}>{index + 1}</footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function buildPages(markdown: string): PreviewPage[] {
  const nodes = parseToAST(markdown);
  const pages: PreviewPage[] = [];
  let currentNodes: DocumentNode[] = [];
  let pendingSection = false;

  const pushPage = () => {
    pages.push({
      key: `page-${pages.length + 1}`,
      nodes: currentNodes,
      startsNewSection: pendingSection,
    });
    currentNodes = [];
    pendingSection = false;
  };

  for (const node of nodes) {
    if (node.type === 'page_break') {
      pushPage();
      continue;
    }

    if (node.type === 'section_break') {
      pushPage();
      pendingSection = true;
      continue;
    }

    currentNodes.push(node);
  }

  if (currentNodes.length > 0 || pages.length === 0) {
    pushPage();
  }

  return pages;
}

function PreviewBlockNode({ node }: { node: DocumentNode }) {
  switch (node.type) {
    case 'paragraph':
      return <p style={{ margin: 0, textAlign: 'justify' }}>{renderInlineNodes(node.children)}</p>;
    case 'heading': {
      const HeadingTag = `h${node.level}` as ElementType;
      const sizeMap: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
        1: '34px',
        2: '28px',
        3: '24px',
        4: '21px',
        5: '18px',
        6: '16px',
      };

      return (
        <HeadingTag style={{ margin: '0.5rem 0 0.35rem 0', fontSize: sizeMap[node.level], lineHeight: 1.28, fontWeight: 700 }}>
          {renderInlineNodes(node.children)}
        </HeadingTag>
      );
    }
    case 'list': {
      const Tag = (node.ordered ? 'ol' : 'ul') as 'ol' | 'ul';
      return (
        <Tag style={{ margin: 0, paddingLeft: '1.5rem', display: 'grid', gap: '0.6rem' }}>
          {node.items.map((item, index) => (
            <li key={index}>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {item.map((child, childIndex) => (
                  <PreviewBlockNode key={childIndex} node={child} />
                ))}
              </div>
            </li>
          ))}
        </Tag>
      );
    }
    case 'blockquote':
      return (
        <blockquote style={{ margin: 0, borderLeft: '3px solid #c2c2c2', padding: '0.35rem 0 0.35rem 0.9rem', color: '#2d2d2d', display: 'grid', gap: '0.55rem' }}>
          {node.children.map((child, index) => <PreviewBlockNode key={index} node={child} />)}
        </blockquote>
      );
    case 'math_block':
      return <MathNode latex={node.latex} displayMode />;
    case 'table':
      return <TableNode rows={node.rows} align={node.align} />;
    default:
      return null;
  }
}

function TableNode({ rows, align }: { rows: TableRowNode[]; align: (TableAlign | null)[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '15px' }}>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} style={{ background: row.isHeader ? '#e8edf8' : 'transparent' }}>
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    border: '1px solid #8f8f8f',
                    padding: '0.45rem 0.55rem',
                    verticalAlign: 'top',
                    textAlign: align[cellIndex] ?? 'left',
                    fontWeight: row.isHeader ? 700 : 400,
                  }}
                >
                  {renderInlineNodes(cell.children)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInlineNodes(nodes: InlineNode[]): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;

    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.value}</Fragment>;
      case 'strong':
        return <strong key={key}>{renderInlineNodes(node.children)}</strong>;
      case 'emphasis':
        return <em key={key}>{renderInlineNodes(node.children)}</em>;
      case 'inline_code':
        return (
          <code key={key} style={{ background: '#f5f5f5', borderRadius: '4px', padding: '0.06rem 0.3rem', fontFamily: '"Courier New", monospace', fontSize: '0.94em' }}>
            {node.value}
          </code>
        );
      case 'link':
        return (
          <a key={key} href={node.url} target="_blank" rel="noreferrer" style={{ color: '#0f4aa8', textDecoration: 'underline' }}>
            {renderInlineNodes(node.children)}
          </a>
        );
      case 'math_inline':
        return <MathNode key={key} latex={node.latex} displayMode={false} />;
      default:
        return null;
    }
  });
}

function MathNode({ latex, displayMode }: { latex: string; displayMode: boolean }) {
  const mathMarkup = useMemo(() => {
    try {
      return temml.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return null;
    }
  }, [displayMode, latex]);

  if (!mathMarkup) {
    return <code>{latex}</code>;
  }

  return (
    <span
      style={{
        display: displayMode ? 'block' : 'inline-flex',
        width: displayMode ? '100%' : 'auto',
        justifyContent: displayMode ? 'center' : 'initial',
        overflowX: 'auto',
      }}
      dangerouslySetInnerHTML={{ __html: mathMarkup }}
    />
  );
}
