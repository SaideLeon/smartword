'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react';
import temml from 'temml';
import { parseToAST } from '@/lib/docx/parser';
import type { DocumentNode, InlineNode, TableAlign, TableRowNode } from '@/lib/docx/types';

interface Props {
  markdown: string;
  isMobile?: boolean;
}

type PreviewPage = {
  key: string;
  nodeIndexes: number[];
  startsNewSection: boolean;
  hasOversizedBlock: boolean;
};

const PAGE_WIDTH = 620;
const PAGE_HEIGHT_DESKTOP = 880;
const PAGE_HEIGHT_MOBILE = 780;
const PAGE_PADDING_DESKTOP = 72;
const PAGE_PADDING_MOBILE = 52;
const FOOTER_RESERVED_SPACE = 28;
const BODY_FONT_SIZE_DESKTOP = 16;
const BODY_FONT_SIZE_MOBILE = 12;

export function DocumentPreview({ markdown, isMobile = false }: Props) {
  const documentNodes = useMemo(() => parseToAST(markdown), [markdown]);
  const measureRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [nodeHeights, setNodeHeights] = useState<Record<number, number>>({});
  const [measureTick, setMeasureTick] = useState(0);

  const pageHeight = isMobile ? PAGE_HEIGHT_MOBILE : PAGE_HEIGHT_DESKTOP;
  const pagePadding = isMobile ? PAGE_PADDING_MOBILE : PAGE_PADDING_DESKTOP;
  const pageBodyHeight = pageHeight - pagePadding * 2 - FOOTER_RESERVED_SPACE;
  const bodyFontSize = isMobile ? BODY_FONT_SIZE_MOBILE : BODY_FONT_SIZE_DESKTOP;

  useEffect(() => {
    const onResize = () => setMeasureTick((current) => current + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    const measured: Record<number, number> = {};

    for (let i = 0; i < documentNodes.length; i += 1) {
      const node = documentNodes[i];
      if (node.type === 'page_break' || node.type === 'section_break') continue;

      const element = measureRefs.current[i];
      if (!element) continue;

      measured[i] = Math.ceil(element.getBoundingClientRect().height);
    }

    setNodeHeights((current) => {
      const currentKeys = Object.keys(current);
      const measuredKeys = Object.keys(measured);

      if (currentKeys.length === measuredKeys.length) {
        let equal = true;
        for (const key of measuredKeys) {
          if (Math.abs((current[Number(key)] ?? 0) - measured[Number(key)]) > 1) {
            equal = false;
            break;
          }
        }
        if (equal) return current;
      }

      return measured;
    });
  }, [documentNodes, measureTick]);

  const pages = useMemo(
    () => paginateNodes(documentNodes, nodeHeights, pageBodyHeight),
    [documentNodes, nodeHeights, pageBodyHeight],
  );

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-3 py-2">
        <h3 className="mono text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Canvas A4</h3>
        <span className="mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Paginação automática</span>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto p-4">
        <div className="grid gap-4">
        {pages.map((page, index) => (
          <Fragment key={page.key}>
            <article
              className="mx-auto w-full max-w-[620px] rounded-[4px] bg-white text-[#111] shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
              style={{
                minHeight: `${pageHeight}px`,
                padding: `${pagePadding}px`,
                fontFamily: '"Times New Roman", Times, serif',
                fontSize: `${bodyFontSize}px`,
                lineHeight: 1.5,
              }}
            >
              {page.startsNewSection && (
                <p style={{ margin: '0 0 1.2rem 0', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6d6458' }}>
                  Nova secção
                </p>
              )}

              <div style={{ display: 'grid', gap: '0.9rem' }}>
                {page.nodeIndexes.length > 0
                  ? page.nodeIndexes.map((nodeIndex) => (
                      <PreviewBlockNode key={`${page.key}-${nodeIndex}`} node={documentNodes[nodeIndex]} />
                    ))
                  : <p style={{ margin: 0, color: '#6f665a' }}>Página em branco</p>}
              </div>

              {page.hasOversizedBlock && (
                <div style={{ marginTop: '1rem', borderTop: '1px dashed #d9d9d9', paddingTop: '0.5rem', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', color: '#807667' }}>
                  Bloco longo demais para caber numa única página — mantendo íntegro para evitar cortes.
                </div>
              )}

              <footer style={{ marginTop: '1.6rem', textAlign: 'center', fontSize: '12px', color: '#928575' }}>{index + 1}</footer>
            </article>

            {index < pages.length - 1 && (
              <div
                style={{
                  margin: '0 auto',
                  width: '100%',
                  maxWidth: '620px',
                  borderTop: '1px dashed #2f2f2f',
                  background: '#171717',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  letterSpacing: '0.04em',
                  color: '#606060',
                  userSelect: 'none',
                }}
              >
                quebra automática de página
              </div>
            )}
          </Fragment>
        ))}
        </div>
      </div>

      <div aria-hidden style={{ position: 'absolute', inset: '-99999px auto auto -99999px', width: `${PAGE_WIDTH}px`, visibility: 'hidden' }}>
        <div
          style={{
            width: `${PAGE_WIDTH - pagePadding * 2}px`,
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: `${bodyFontSize}px`,
            lineHeight: 1.5,
          }}
        >
          {documentNodes.map((node, index) => {
            if (node.type === 'page_break' || node.type === 'section_break') return null;

            return (
              <div
                key={`measure-${index}`}
                ref={(element) => {
                  measureRefs.current[index] = element;
                }}
                style={{ marginBottom: '0.9rem' }}
              >
                <PreviewBlockNode node={node} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function paginateNodes(nodes: DocumentNode[], heights: Record<number, number>, maxPageBodyHeight: number): PreviewPage[] {
  const pages: PreviewPage[] = [];
  let currentNodeIndexes: number[] = [];
  let currentHeight = 0;
  let pendingSection = false;
  let pageHasOversizedBlock = false;

  const openNewPage = () => {
    pages.push({
      key: `page-${pages.length + 1}`,
      nodeIndexes: currentNodeIndexes,
      startsNewSection: pendingSection,
      hasOversizedBlock: pageHasOversizedBlock,
    });
    currentNodeIndexes = [];
    currentHeight = 0;
    pendingSection = false;
    pageHasOversizedBlock = false;
  };

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    if (node.type === 'page_break') {
      openNewPage();
      continue;
    }

    if (node.type === 'section_break') {
      openNewPage();
      pendingSection = true;
      continue;
    }

    const nodeHeight = heights[index] ?? estimateFallbackHeight(node);

    if (currentNodeIndexes.length > 0 && currentHeight + nodeHeight > maxPageBodyHeight) {
      openNewPage();
    }

    if (nodeHeight > maxPageBodyHeight) {
      pageHasOversizedBlock = true;
    }

    currentNodeIndexes.push(index);
    currentHeight += nodeHeight;
  }

  if (currentNodeIndexes.length > 0 || pages.length === 0) {
    openNewPage();
  }

  return pages;
}

function estimateFallbackHeight(node: DocumentNode): number {
  switch (node.type) {
    case 'heading':
      return 72;
    case 'list':
      return Math.max(90, node.items.length * 44);
    case 'table':
      return Math.max(120, node.rows.length * 46);
    case 'math_block':
      return 100;
    case 'blockquote':
      return 92;
    case 'paragraph':
      return 44;
    default:
      return 44;
  }
}

function PreviewBlockNode({ node }: { node: DocumentNode }) {
  switch (node.type) {
    case 'paragraph':
      return (
        <p
          style={{
            margin: 0,
            textAlign: 'justify',
            textJustify: 'inter-word',
            hyphens: 'auto',
            wordBreak: 'normal',
            overflowWrap: 'break-word',
          }}
        >
          {renderInlineNodes(node.children)}
        </p>
      );
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
