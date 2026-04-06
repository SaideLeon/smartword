'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react';
import temml from 'temml';
import { parseToAST } from '@/lib/docx/parser';
import type { DocumentNode, InlineNode, TableAlign, TableRowNode } from '@/lib/docx/types';

interface Props {
  markdown: string;
  originalMarkdown?: string;
  isMobile?: boolean;
}

type PreviewPage = {
  key: string;
  nodeIndexes: number[];
  startsNewSection: boolean;
  hasOversizedBlock: boolean;
};

// ─── Constantes de layout ─────────────────────────────────────────────────
const PAGE_WIDTH           = 620;
const PAGE_HEIGHT_DESKTOP  = 877;  // proporção A4 (210×297 mm)
const PAGE_HEIGHT_MOBILE   = 780;
// Margens aproximadas ABNT: sup/esq 3 cm, inf/dir 2 cm
// 620 px ≈ 210 mm → 1 mm ≈ 2.95 px → padding ~80 px (≈ 2.7 cm) para simplificar
const PAGE_PADDING_DESKTOP = 80;
const PAGE_PADDING_MOBILE  = 52;
const FOOTER_RESERVED_SPACE = 28;

// ─── Tipografia ABNT NBR 14724 ────────────────────────────────────────────
// Fonte: Times New Roman 12 pt
// Área útil A4 (3+2 cm margens) = 155 mm = 457 pt → 620 px → 1 pt ≈ 1.357 px
// 12 pt × 1.357 ≈ 16.3 px → 16 px (desktop)
const BODY_FONT_SIZE_DESKTOP = 16;
const BODY_FONT_SIZE_MOBILE  = 12;

// Espaçamento entre linhas 1,5 (ABNT)
const LINE_HEIGHT = 1.5;

// Recuo de parágrafo 1,25 cm → 1,25 × 10 mm × 2.95 px/mm ≈ 37 px
const PARAGRAPH_INDENT_DESKTOP = 37;
const PARAGRAPH_INDENT_MOBILE  = 24;

// Tamanhos de título por nível (em px, escala desktop)
// ABNT usa 12 pt para todos; escalamos H1 e H2 para dar hierarquia visual
const HEADING_PX: Record<1|2|3|4|5|6, number> = {
  1: 22,  // ≈ 16 pt — capítulos (MAIÚSCULAS NEGRITO centrado)
  2: 19,  // ≈ 14 pt — secções (Negrito)
  3: 16,  // ≈ 12 pt — sub-secções (Negrito Itálico)
  4: 16,  // ≈ 12 pt — quaternárias (Itálico)
  5: 16,  // ≈ 12 pt — quinárias (Normal)
  6: 15,  // ≈ 11 pt — senárias (Normal)
};

// Margem antes / depois de cada nível de título
const HEADING_MARGIN: Record<1|2|3|4|5|6, { before: string; after: string }> = {
  1: { before: '1.6rem', after: '0.6rem' },
  2: { before: '1.2rem', after: '0.5rem' },
  3: { before: '1.0rem', after: '0.4rem' },
  4: { before: '0.85rem', after: '0.35rem' },
  5: { before: '0.75rem', after: '0.3rem' },
  6: { before: '0.65rem', after: '0.3rem' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────
function extractText(nodes: InlineNode[]): string {
  return nodes.map(n => {
    if (n.type === 'text') return n.value;
    if (n.type === 'strong' || n.type === 'emphasis' || n.type === 'link') return extractText(n.children);
    return '';
  }).join('');
}

// ─── Índice (TOC) ─────────────────────────────────────────────────────────
function PreviewTocNode({
  allNodes,
  originalNodes,
  bodyFontSize,
}: {
  allNodes: DocumentNode[];
  originalNodes: DocumentNode[];
  bodyFontSize: number;
}) {
  const sourceNodes = originalNodes.length > 0 ? originalNodes : allNodes;

  const headings = useMemo(
    () =>
      sourceNodes.filter(
        (n): n is Extract<DocumentNode, { type: 'heading' }> =>
          n.type === 'heading' && n.level <= 6,
      ),
    [sourceNodes],
  );

  const labelSize = bodyFontSize * 0.72;
  const entrySize = bodyFontSize * 0.875;
  const titleSize = bodyFontSize * 0.95;

  return (
    <div style={{ fontFamily: '"Times New Roman", Times, serif', margin: '0.25rem 0 0.75rem' }}>
      <p style={{ margin: '0 0 0.9rem 0', textAlign: 'center', fontWeight: 700, fontSize: `${titleSize}px`, letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: '1px solid #ccc', paddingBottom: '0.4rem' }}>
        Índice
      </p>
      {headings.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: `${labelSize}px`, textAlign: 'center', fontStyle: 'italic' }}>
          Ainda não há títulos no documento.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          {headings.map((heading, i) => {
            const text   = extractText(heading.children);
            const indent = Math.max(0, heading.level - 1) * 18;
            const isMain = heading.level <= 2;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', paddingLeft: `${indent}px`, gap: '3px' }}>
                <span style={{ fontWeight: isMain ? 700 : 400, fontSize: `${isMain ? entrySize : entrySize * 0.94}px`, flexShrink: 0, maxWidth: '78%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#111' }}>
                  {text}
                </span>
                <span style={{ flex: 1, height: '1px', borderBottom: '1px dotted #bbb', marginBottom: '3px', marginLeft: '5px', marginRight: '5px', minWidth: '16px' }} />
                <span style={{ fontSize: `${labelSize}px`, color: '#999', flexShrink: 0, fontStyle: 'italic' }}>
                  {i + 1}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p style={{ marginTop: '0.85rem', textAlign: 'center', fontSize: `${labelSize}px`, color: '#aaa', fontStyle: 'italic' }}>
        Índice automático · os números de página são actualizados ao abrir no Word
      </p>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────
export function DocumentPreview({ markdown, originalMarkdown, isMobile = false }: Props) {
  const documentNodes = useMemo(() => parseToAST(markdown), [markdown]);
  const originalNodes = useMemo(
    () => (originalMarkdown ? parseToAST(originalMarkdown) : []),
    [originalMarkdown],
  );

  const measureRefs        = useRef<Record<number, HTMLDivElement | null>>({});
  const previewScrollRef   = useRef<HTMLDivElement>(null);
  const previousMarkdownRef = useRef(markdown);
  const [nodeHeights, setNodeHeights] = useState<Record<number, number>>({});
  const [measureTick, setMeasureTick] = useState(0);

  const pageHeight     = isMobile ? PAGE_HEIGHT_MOBILE    : PAGE_HEIGHT_DESKTOP;
  const pagePadding    = isMobile ? PAGE_PADDING_MOBILE   : PAGE_PADDING_DESKTOP;
  const pageBodyHeight = pageHeight - pagePadding * 2 - FOOTER_RESERVED_SPACE;
  const bodyFontSize   = isMobile ? BODY_FONT_SIZE_MOBILE : BODY_FONT_SIZE_DESKTOP;
  const paraIndent     = isMobile ? PARAGRAPH_INDENT_MOBILE : PARAGRAPH_INDENT_DESKTOP;

  useEffect(() => {
    const onResize = () => setMeasureTick((c) => c + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    const measured: Record<number, number> = {};
    for (let i = 0; i < documentNodes.length; i += 1) {
      const node = documentNodes[i];
      if (node.type === 'page_break' || node.type === 'section_break' || node.type === 'toc') continue;
      const element = measureRefs.current[i];
      if (!element) continue;
      measured[i] = Math.ceil(element.getBoundingClientRect().height);
    }
    setNodeHeights((current) => {
      const measuredKeys = Object.keys(measured);
      if (Object.keys(current).length === measuredKeys.length) {
        let equal = true;
        for (const key of measuredKeys) {
          if (Math.abs((current[Number(key)] ?? 0) - measured[Number(key)]) > 1) { equal = false; break; }
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

  useEffect(() => {
    const previous = previousMarkdownRef.current;
    const grewByAppend = markdown.length > previous.length && markdown.startsWith(previous);
    previousMarkdownRef.current = markdown;
    if (!grewByAppend) return;
    const container = previewScrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => { container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' }); });
  }, [markdown, pages.length]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--parchment)]">
      <div ref={previewScrollRef} className="no-scrollbar flex-1 overflow-y-auto p-3">
        <div className="grid gap-3">
          {pages.map((page, index) => (
            <Fragment key={page.key}>
              <article
                className="mx-auto w-full max-w-[620px] rounded-[4px] bg-white text-[#111] shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
                style={{
                  minHeight: `${pageHeight}px`,
                  padding: `${pagePadding}px`,
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: `${bodyFontSize}px`,
                  lineHeight: LINE_HEIGHT,
                }}
              >
                {page.startsNewSection && (
                  <p style={{ margin: '0 0 1.2rem 0', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6d6458' }}>
                    Nova secção
                  </p>
                )}

                {/* Conteúdo da página — sem gap fixo; cada bloco gere as próprias margens */}
                <div>
                  {page.nodeIndexes.length > 0
                    ? page.nodeIndexes.map((nodeIndex) => {
                        const node = documentNodes[nodeIndex];
                        if (node.type === 'toc') {
                          return (
                            <PreviewTocNode
                              key={`${page.key}-${nodeIndex}-toc`}
                              allNodes={documentNodes}
                              originalNodes={originalNodes}
                              bodyFontSize={bodyFontSize}
                            />
                          );
                        }
                        return (
                          <PreviewBlockNode
                            key={`${page.key}-${nodeIndex}`}
                            node={node}
                            bodyFontSize={bodyFontSize}
                            paraIndent={paraIndent}
                          />
                        );
                      })
                    : <p style={{ margin: 0, color: '#6f665a' }}>Página em branco</p>}
                </div>

                {page.hasOversizedBlock && (
                  <div style={{ marginTop: '1rem', borderTop: '1px dashed #d9d9d9', paddingTop: '0.5rem', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '11px', color: '#807667' }}>
                    Bloco longo demais para caber numa única página — mantendo íntegro para evitar cortes.
                  </div>
                )}

                {/* Número de página (Times New Roman, mesmo tamanho corpo) */}
                <footer style={{ marginTop: 'auto', paddingTop: '1.2rem', textAlign: 'center', fontSize: `${bodyFontSize}px`, color: '#666', fontFamily: '"Times New Roman", Times, serif' }}>
                  {index + 1}
                </footer>
              </article>

              {index < pages.length - 1 && (
                <div style={{ margin: '0 auto', width: '100%', maxWidth: '620px', borderTop: '1px dashed #2f2f2f', background: '#171717', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', letterSpacing: '0.04em', color: '#606060', userSelect: 'none' }}>
                  quebra automática de página
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Área de medição oculta — mesma fonte/tamanho do desktop */}
      <div aria-hidden style={{ position: 'absolute', inset: '-99999px auto auto -99999px', width: `${PAGE_WIDTH}px`, visibility: 'hidden' }}>
        <div style={{ width: `${PAGE_WIDTH - PAGE_PADDING_DESKTOP * 2}px`, fontFamily: '"Times New Roman", Times, serif', fontSize: `${BODY_FONT_SIZE_DESKTOP}px`, lineHeight: LINE_HEIGHT }}>
          {documentNodes.map((node, index) => {
            if (node.type === 'page_break' || node.type === 'section_break' || node.type === 'toc') return null;
            return (
              <div key={`measure-${index}`} ref={(el) => { measureRefs.current[index] = el; }}>
                <PreviewBlockNode
                  node={node}
                  bodyFontSize={BODY_FONT_SIZE_DESKTOP}
                  paraIndent={PARAGRAPH_INDENT_DESKTOP}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Paginação ───────────────────────────────────────────────────────────
function paginateNodes(nodes: DocumentNode[], heights: Record<number, number>, maxPageBodyHeight: number): PreviewPage[] {
  const pages: PreviewPage[] = [];
  let currentNodeIndexes: number[] = [];
  let currentHeight = 0;
  let pendingSection = false;
  let pageHasOversizedBlock = false;

  const openNewPage = () => {
    pages.push({ key: `page-${pages.length + 1}`, nodeIndexes: currentNodeIndexes, startsNewSection: pendingSection, hasOversizedBlock: pageHasOversizedBlock });
    currentNodeIndexes = [];
    currentHeight = 0;
    pendingSection = false;
    pageHasOversizedBlock = false;
  };

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.type === 'page_break') { openNewPage(); continue; }
    if (node.type === 'section_break') { openNewPage(); pendingSection = true; continue; }
    const nodeHeight = heights[index] ?? estimateFallbackHeight(node);
    if (currentNodeIndexes.length > 0 && currentHeight + nodeHeight > maxPageBodyHeight) openNewPage();
    if (nodeHeight > maxPageBodyHeight) pageHasOversizedBlock = true;
    currentNodeIndexes.push(index);
    currentHeight += nodeHeight;
  }

  if (currentNodeIndexes.length > 0 || pages.length === 0) openNewPage();
  return pages;
}

function estimateFallbackHeight(node: DocumentNode): number {
  switch (node.type) {
    case 'heading':    return node.level <= 2 ? 60 : 44;
    case 'list':       return Math.max(80, node.items.length * 36);
    case 'table':      return Math.max(100, node.rows.length * 40);
    case 'math_block': return 88;
    case 'blockquote': return 80;
    case 'toc':        return 380;
    case 'paragraph':  return 40;
    default:           return 40;
  }
}

// ─── Estilos de título (ABNT NBR 14724) ──────────────────────────────────
//   H1 — MAIÚSCULAS NEGRITO centrado  (capítulo / seção primária)
//   H2 — Negrito alinhado à esquerda  (seção secundária)
//   H3 — Negrito Itálico              (seção terciária)
//   H4 — Itálico                      (seção quaternária)
//   H5 — Normal                       (seção quinária)
//   H6 — Normal (tamanho ligeiramente menor)
function headingStyle(level: number, bodyFontSize: number): React.CSSProperties {
  const normalizedLevel = Math.min(6, Math.max(1, Number(level) || 1)) as 1 | 2 | 3 | 4 | 5 | 6;
  const ratio = bodyFontSize / BODY_FONT_SIZE_DESKTOP;
  const fontSize = Math.round(HEADING_PX[normalizedLevel] * ratio);
  const { before, after } = HEADING_MARGIN[normalizedLevel];

  const perLevel: Record<
    1 | 2 | 3 | 4 | 5 | 6,
    Pick<React.CSSProperties, 'fontWeight' | 'fontStyle' | 'textAlign' | 'textTransform'>
  > = {
    1: { fontWeight: 700, fontStyle: 'normal', textAlign: 'center', textTransform: 'uppercase' },
    2: { fontWeight: 700, fontStyle: 'normal', textAlign: 'left', textTransform: 'none' },
    3: { fontWeight: 700, fontStyle: 'italic', textAlign: 'left', textTransform: 'none' },
    4: { fontWeight: 400, fontStyle: 'italic', textAlign: 'left', textTransform: 'none' },
    5: { fontWeight: 400, fontStyle: 'normal', textAlign: 'left', textTransform: 'none' },
    6: { fontWeight: 400, fontStyle: 'normal', textAlign: 'left', textTransform: 'none' },
  };

  return {
    margin: `${before} 0 ${after} 0`,
    fontSize: `${fontSize}px`,
    lineHeight: LINE_HEIGHT,
    fontFamily: '"Times New Roman", Times, serif',
    letterSpacing: 'normal',
    ...perLevel[normalizedLevel],
  };
}

// ─── Bloco de conteúdo ────────────────────────────────────────────────────
interface BlockNodeProps {
  node: DocumentNode;
  bodyFontSize: number;
  paraIndent: number;
}

function PreviewBlockNode({ node, bodyFontSize, paraIndent }: BlockNodeProps) {
  const lineGap = `${LINE_HEIGHT * bodyFontSize * 0.3}px`;

  switch (node.type) {

    case 'paragraph':
      return (
        <p style={{
          margin: 0,
          paddingTop: lineGap,
          paddingBottom: lineGap,
          textIndent: paraIndent > 0 ? `${paraIndent}px` : undefined,
          textAlign: 'justify',
          textJustify: 'inter-word',
          hyphens: 'auto',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          lineHeight: LINE_HEIGHT,
          fontSize: `${bodyFontSize}px`,
          fontFamily: '"Times New Roman", Times, serif',
        }}>
          {renderInlineNodes(node.children)}
        </p>
      );

    case 'heading': {
      const HeadingTag = `h${node.level}` as ElementType;
      return (
        <HeadingTag style={headingStyle(Number(node.level), bodyFontSize)}>
          {renderInlineNodes(node.children)}
        </HeadingTag>
      );
    }

    case 'list': {
      const Tag = (node.ordered ? 'ol' : 'ul') as 'ol' | 'ul';
      return (
        <Tag style={{
          margin: `${lineGap} 0`,
          paddingLeft: `${paraIndent + 18}px`,
          lineHeight: LINE_HEIGHT,
          fontSize: `${bodyFontSize}px`,
          fontFamily: '"Times New Roman", Times, serif',
        }}>
          {node.items.map((item, i) => (
            <li key={i} style={{ marginBottom: `${LINE_HEIGHT * bodyFontSize * 0.1}px` }}>
              <div>
                {item.map((child, ci) => (
                  <PreviewBlockNode key={ci} node={child} bodyFontSize={bodyFontSize} paraIndent={0} />
                ))}
              </div>
            </li>
          ))}
        </Tag>
      );
    }

    case 'blockquote':
      return (
        <blockquote style={{
          margin: `${lineGap} ${paraIndent}px`,
          borderLeft: '3px solid #bbb',
          paddingLeft: '0.75rem',
          color: '#2d2d2d',
          fontSize: `${bodyFontSize * 0.94}px`,
          lineHeight: LINE_HEIGHT,
          fontFamily: '"Times New Roman", Times, serif',
        }}>
          {node.children.map((child, i) => (
            <PreviewBlockNode key={i} node={child} bodyFontSize={bodyFontSize} paraIndent={0} />
          ))}
        </blockquote>
      );

    case 'math_block':
      return (
        <div style={{ margin: `${lineGap} 0` }}>
          <MathNode latex={node.latex} displayMode />
        </div>
      );

    case 'table':
      return (
        <div style={{ margin: `${LINE_HEIGHT * bodyFontSize * 0.5}px 0` }}>
          <TableNode rows={node.rows} align={node.align} bodyFontSize={bodyFontSize} />
        </div>
      );

    default:
      return null;
  }
}

// ─── Tabela ───────────────────────────────────────────────────────────────
function TableNode({
  rows,
  align,
  bodyFontSize,
}: {
  rows: TableRowNode[];
  align: (TableAlign | null)[];
  bodyFontSize: number;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: `${bodyFontSize}px`,
        lineHeight: LINE_HEIGHT,
        fontFamily: '"Times New Roman", Times, serif',
      }}>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    border: '1px solid #555',
                    padding: '0.3rem 0.5rem',
                    verticalAlign: 'top',
                    textAlign: align[cellIndex] ?? 'left',
                    fontWeight: row.isHeader ? 700 : 400,
                    background: row.isHeader ? '#f0ece6' : 'transparent',
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

// ─── Inline nodes ─────────────────────────────────────────────────────────
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
          <code key={key} style={{
            background: '#f5f5f5',
            borderRadius: '3px',
            padding: '0.05rem 0.28rem',
            fontFamily: '"Courier New", monospace',
            fontSize: '0.92em',
          }}>
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

// ─── MathNode ─────────────────────────────────────────────────────────────
function MathNode({ latex, displayMode }: { latex: string; displayMode: boolean }) {
  const mathMarkup = useMemo(() => {
    try {
      return temml.renderToString(latex, { displayMode, throwOnError: false, strict: false });
    } catch {
      return null;
    }
  }, [displayMode, latex]);

  if (!mathMarkup) return <code>{latex}</code>;

  return (
    <span
      style={{
        display: displayMode ? 'block' : 'inline-flex',
        width: displayMode ? '100%' : 'auto',
        justifyContent: displayMode ? 'center' : 'initial',
        overflowX: 'auto',
        lineHeight: LINE_HEIGHT,
      }}
      dangerouslySetInnerHTML={{ __html: mathMarkup }}
    />
  );
}
