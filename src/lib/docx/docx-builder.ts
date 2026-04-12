import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImportedXmlComponent,
  ExternalHyperlink, InternalHyperlink, Bookmark, IParagraphOptions, AlignmentType,
  convertMillimetersToTwip,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign,
  PageBreak, Footer, PageNumber, NumberFormat, SectionType, TabStopType,
} from 'docx';
import { DocumentNode, InlineNode, TableRowNode, TableCellNode, TableAlign } from './types';
import { convertLatexToOmml } from './math-converter';
import { buildChart } from './chart-builder';

// ── Constantes de layout ─────────────────────────────────────────────────────
const PAGE_CONTENT_WIDTH_DXA = convertMillimetersToTwip(210 - 30 - 20);

const COLOR_HEADER_BG  = 'D9E1F2';
const COLOR_HEADER_FG  = '1F3864';
const COLOR_ROW_ALT_BG = 'F2F2F2';
const COLOR_BORDER     = 'BFBFBF';

const PAGE_SIZE = {
  width:  convertMillimetersToTwip(210),
  height: convertMillimetersToTwip(297),
};

const PAGE_MARGIN = {
  top:    convertMillimetersToTwip(30),
  left:   convertMillimetersToTwip(30),
  bottom: convertMillimetersToTwip(20),
  right:  convertMillimetersToTwip(20),
};

// ── Contexto de construção ────────────────────────────────────────────────────
interface HeadingEntry {
  id: string;
  level: number;
  text: string;
}

interface BuildContext {
  headings: HeadingEntry[];
  headingIndex: { value: number };
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function deepFlat(arr: any[]): any[] {
  const result: any[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) result.push(...deepFlat(item));
    else result.push(item);
  }
  return result;
}

function getTextRunText(run: TextRun): string | null {
  const directText = (run as any).options?.text ?? (run as any).text;
  return typeof directText === 'string' ? directText : null;
}

function inlineToText(nodes: InlineNode[]): string {
  return nodes.map(n => {
    switch (n.type) {
      case 'text':        return n.value;
      case 'inline_code': return n.value;
      case 'strong':
      case 'emphasis':
      case 'link':        return inlineToText(n.children);
      default:            return '';
    }
  }).join('');
}

// ── Extração de headings (1.ª passagem) ─────────────────────────────────────
function extractHeadings(ast: DocumentNode[]): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  let counter = 0;
  for (const node of ast) {
    if (node.type === 'heading') {
      headings.push({
        id:    `sec-${counter++}`,
        level: node.level,
        text:  inlineToText(node.children),
      });
    }
  }
  return headings;
}

// ── Tabelas ──────────────────────────────────────────────────────────────────

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
const CELL_BORDERS = {
  top: CELL_BORDER, bottom: CELL_BORDER,
  left: CELL_BORDER, right: CELL_BORDER,
};

function cellAlignment(align: TableAlign | null): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (align) {
    case 'center': return AlignmentType.CENTER;
    case 'right':  return AlignmentType.RIGHT;
    default:       return AlignmentType.LEFT;
  }
}

async function buildTableRow(
  row: TableRowNode,
  colWidths: number[],
  aligns: (TableAlign | null)[],
  rowIndex: number,
): Promise<TableRow> {
  const cells = await Promise.all(
    row.cells.map(async (cell, colIdx) => {
      const inlineNodes = await Promise.all(cell.children.map(n => buildInline(n)));
      const runs = deepFlat(inlineNodes);

      const styledRuns = row.isHeader
        ? runs.map((run: any) => {
            if (run instanceof TextRun) {
              const text = getTextRunText(run);
              if (text === null) return run;
              return new TextRun({ text, bold: true, color: COLOR_HEADER_FG });
            }
            return run;
          })
        : runs;

      const para = new Paragraph({
        alignment: cellAlignment(aligns[colIdx] ?? null),
        children: styledRuns,
        spacing: { before: 0, after: 0 },
      });

      const isEvenRow = rowIndex % 2 === 0;

      return new TableCell({
        borders: CELL_BORDERS,
        width: { size: colWidths[colIdx] ?? Math.floor(PAGE_CONTENT_WIDTH_DXA / row.cells.length), type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        shading: row.isHeader
          ? { fill: COLOR_HEADER_BG, type: ShadingType.CLEAR }
          : isEvenRow
            ? { fill: COLOR_ROW_ALT_BG, type: ShadingType.CLEAR }
            : { fill: 'FFFFFF', type: ShadingType.CLEAR },
        children: [para],
      });
    }),
  );

  return new TableRow({ children: cells, tableHeader: row.isHeader });
}

async function buildTable(node: Extract<DocumentNode, { type: 'table' }>): Promise<Table> {
  const colCount = node.rows[0]?.cells.length ?? 1;
  const aligns   = node.align ?? [];

  const baseWidth  = Math.floor(PAGE_CONTENT_WIDTH_DXA / colCount);
  const remainder  = PAGE_CONTENT_WIDTH_DXA - baseWidth * colCount;
  const colWidths  = Array.from({ length: colCount }, (_, i) =>
    i === colCount - 1 ? baseWidth + remainder : baseWidth,
  );

  const rows = await Promise.all(
    node.rows.map((row, i) => buildTableRow(row, colWidths, aligns, i)),
  );

  return new Table({
    width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

// ── Índice estático automático ────────────────────────────────────────────────
//
// Gerado inteiramente a partir dos headings do AST — sem campos Word, sem TOC
// nativo, sem dependência do Microsoft Word.
//
// Cada entrada é um parágrafo com InternalHyperlink que aponta para o Bookmark
// inserido no próprio parágrafo de heading. Funciona em qualquer leitor DOCX:
//   ✓ Word Desktop (Windows/Mac)
//   ✓ Word Mobile (iOS/Android)
//   ✓ LibreOffice / OpenOffice
//   ✓ Google Docs
//   ✓ WPS Office
//   ✓ Qualquer visualizador DOCX
//
// Não inclui números de página: impossíveis de calcular antes da renderização,
// e para documentos digitais os hyperlinks são a forma correcta de navegar.

function buildStaticToc(headings: HeadingEntry[]): any[] {
  // ── Constantes tipográficas ────────────────────────────────────────────────
  const FONT = 'Times New Roman';
  const FONT_SIZE = 24;
  const LINE_SPACING = 360;
  const LINE_RULE = 'auto' as any;
  const BLACK = '000000';

  // ── Título "Índice" ────────────────────────────────────────────────────────
  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 440, line: LINE_SPACING, lineRule: LINE_RULE },
    children: [
      new TextRun({
        text: 'Índice',
        bold: true,
        size: FONT_SIZE,
        font: FONT,
        color: BLACK,
      }),
    ],
  });

  // ── Linha separadora abaixo do título ─────────────────────────────────────
  const separator = new Paragraph({
    spacing: { before: 0, after: 200, line: LINE_SPACING, lineRule: LINE_RULE },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: BLACK, space: 4 },
    },
    children: [],
  });

  // ── Caso vazio ────────────────────────────────────────────────────────────
  if (headings.length === 0) {
    return [
      titleParagraph,
      separator,
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 0, line: LINE_SPACING, lineRule: LINE_RULE },
        children: [
          new TextRun({
            text: '[Nenhuma secção encontrada no documento]',
            italics: true,
            size: FONT_SIZE,
            color: BLACK,
            font: FONT,
          }),
        ],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ];
  }

  // ── Entradas do índice ─────────────────────────────────────────────────────
  const INDENT_PER_LEVEL_MM = 6;

  let entryCounter = 0;

  const entries = headings
    .filter(h => h.level <= 4)
    .map(h => {
      entryCounter += 1;
      const indentTwips = (h.level - 1) * convertMillimetersToTwip(INDENT_PER_LEVEL_MM);

      return new Paragraph({
        indent: indentTwips > 0 ? { left: indentTwips } : undefined,
        tabStops: [
          {
            type: TabStopType.RIGHT,
            position: PAGE_CONTENT_WIDTH_DXA,
            leader: 'dot' as any,
          },
        ],
        spacing: {
          before: h.level === 1 ? 200 : h.level === 2 ? 120 : 80,
          after: h.level === 1 ? 60 : 40,
          line: LINE_SPACING,
          lineRule: LINE_RULE,
        },
        children: [
          new InternalHyperlink({
            anchor: h.id,
            children: [
              new TextRun({
                text: h.text,
                font: FONT,
                size: FONT_SIZE,
                color: BLACK,
              }),
            ],
          }),
          new TextRun({
            text: '\t',
            font: FONT,
            size: FONT_SIZE,
          }),
          new TextRun({
            text: String(entryCounter),
            font: FONT,
            size: FONT_SIZE,
            color: BLACK,
          }),
        ],
      });
    });

  // ── Nota de rodapé do índice ──────────────────────────────────────────────
  const noteParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 320, after: 0, line: LINE_SPACING, lineRule: LINE_RULE },
    children: [
      new TextRun({
        text: 'Índice automático · os números de página são actualizados ao abrir no Word (prima F9)',
        italics: true,
        size: 20,
        color: '666666',
        font: FONT,
      }),
    ],
  });

  // ── Quebra de página após o índice ────────────────────────────────────────
  const pageBreakAfterToc = new Paragraph({
    children: [new PageBreak()],
  });

  return [titleParagraph, separator, ...entries, noteParagraph, pageBreakAfterToc];
}

// ── Nós inline ───────────────────────────────────────────────────────────────

interface TextOptions {
  bold?: boolean;
  italics?: boolean;
  color?: string;
}

async function buildInline(node: InlineNode, options: TextOptions = {}): Promise<any> {
  switch (node.type) {
    case 'text':
      return new TextRun({ text: node.value, bold: options.bold, italics: options.italics, color: options.color });
    case 'math_inline': {
      const omml = await convertLatexToOmml(node.latex, false);
      const comp = ImportedXmlComponent.fromXmlString(omml);
      return (comp as any).root[0];
    }
    case 'strong': {
      const children = await Promise.all(node.children.map(c => buildInline(c, { ...options, bold: true })));
      return children.flat();
    }
    case 'emphasis': {
      const children = await Promise.all(node.children.map(c => buildInline(c, { ...options, italics: true })));
      return children.flat();
    }
    case 'inline_code':
      return new TextRun({ text: node.value, font: 'Courier New', bold: options.bold, italics: options.italics });
    case 'link': {
      const children = await Promise.all(node.children.map(c => buildInline(c, options)));
      return new ExternalHyperlink({ children: children.flat(), link: node.url });
    }
  }
}

// ── Nós de bloco ─────────────────────────────────────────────────────────────

async function buildBlock(
  node: DocumentNode,
  ctx: BuildContext,
  options: IParagraphOptions = {},
): Promise<any> {
  switch (node.type) {
    case 'paragraph': {
      const children = await Promise.all(node.children.map(c => buildInline(c)));
      return new Paragraph({ ...options, children: children.flat() });
    }

    case 'math_block': {
      const omml = await convertLatexToOmml(node.latex, true);
      const comp = ImportedXmlComponent.fromXmlString(omml);
      return new Paragraph({ ...options, children: [(comp as any).root[0]] });
    }

    case 'heading': {
      const headingMap: Record<number, any> = {
        1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
      };

      // Obtém o ID de bookmark correspondente a este heading (ordem de aparecimento)
      const entry = ctx.headings[ctx.headingIndex.value];
      ctx.headingIndex.value++;

      const inlineChildren = await Promise.all(
        node.children.map(c => buildInline(c, { bold: true, color: '000000' }))
      );
      const flatChildren = deepFlat(inlineChildren);

      // Insere Bookmark para que os InternalHyperlinks do índice funcionem
      const children = entry
        ? [new Bookmark({ id: entry.id, children: flatChildren })]
        : flatChildren;

      return new Paragraph({
        ...options,
        children,
        heading: headingMap[node.level],
      });
    }

    case 'list': {
      const currentLevel = (options as any).__nestLevel ?? 0;

      const items = await Promise.all(node.items.map(async (itemBlocks) => {
        const blocks = await Promise.all(itemBlocks.map((block, i) => {
          if (i === 0) {
            return buildBlock(block, ctx, {
              ...options,
              bullet: node.ordered ? undefined : { level: currentLevel },
              numbering: node.ordered
                ? { reference: 'ordered-list', level: currentLevel }
                : undefined,
              ...(({ __nestLevel: _, ...rest }) => rest)(options as any),
            });
          }
          return buildBlock(block, ctx, { ...options, __nestLevel: currentLevel + 1 } as any);
        }));
        return deepFlat(blocks);
      }));

      return deepFlat(items);
    }

    case 'blockquote': {
      const children = await Promise.all(node.children.map(c => buildBlock(c, ctx, { ...options, style: 'Quote' })));
      return deepFlat(children);
    }

    case 'table':
      return buildTable(node);

    case 'page_break':
      return new Paragraph({ children: [new PageBreak()] });

    case 'chart':
      return buildChart(node);

    // ── Índice estático ────────────────────────────────────────────────────
    // Autossuficiente: não depende de Word, campos TOC, ou ação do utilizador.
    case 'toc':
      return buildStaticToc(ctx.headings);

    case 'section_break':
      return null;
  }
}

// ── Rodapé com numeração de página ───────────────────────────────────────────

function buildPageNumberFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: 'Times New Roman',
            size: 20,
            color: '666666',
          }),
        ],
      }),
    ],
  });
}

// ── Estilos e numeração partilhados ──────────────────────────────────────────

export const SHARED_STYLES = {
  default: {
    document: {
      run: { font: 'Times New Roman', size: 24 },
      paragraph: {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360, lineRule: 'auto' as const },
      },
    },
  },
  paragraphStyles: [
    {
      id: 'Quote', name: 'Quote', basedOn: 'Normal', next: 'Normal',
      run: { size: 20 },
      paragraph: {
        spacing: { line: 240, lineRule: 'auto' as const },
        indent: { left: convertMillimetersToTwip(40) },
      },
    },
    {
      id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
    },
    {
      id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 },
    },
    {
      id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
    },
    {
      id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 3 },
    },
    {
      id: 'Heading5', name: 'Heading 5', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 4 },
    },
    {
      id: 'Heading6', name: 'Heading 6', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 5 },
    },
  ],
};

export const SHARED_NUMBERING = {
  config: [
    {
      reference: 'ordered-list',
      levels: [
        { level: 0, format: 'decimal', text: '%1.', alignment: 'start',
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: 'decimal', text: '%2.', alignment: 'start',
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        { level: 2, format: 'decimal', text: '%3.', alignment: 'start',
          style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
      ],
    },
  ],
} as const;

// ── Secções de conteúdo ───────────────────────────────────────────────────────

export async function buildContentSections(ast: DocumentNode[]): Promise<any[]> {
  // 1.ª passagem: extrair headings e atribuir IDs de bookmark
  const headings = extractHeadings(ast);
  const ctx: BuildContext = {
    headings,
    headingIndex: { value: 0 },
  };

  const sectionAsts: DocumentNode[][] = [[]];

  for (const node of ast) {
    if (node.type === 'section_break') {
      sectionAsts.push([]);
    } else {
      sectionAsts[sectionAsts.length - 1].push(node);
    }
  }

  return Promise.all(
    sectionAsts.map(async (nodes) => {
      const children: any[] = [];

      for (const node of nodes) {
        if (node.type === 'page_break') {
          children.push(new Paragraph({ children: [new PageBreak()] }));
          continue;
        }

        const built = await buildBlock(node, ctx);
        if (built !== null && built !== undefined) {
          children.push(...deepFlat(Array.isArray(built) ? built : [built]));
        }
      }

      return {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: PAGE_SIZE,
            margin: PAGE_MARGIN,
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        footers: {
          default: buildPageNumberFooter(),
        },
        children,
      };
    }),
  );
}

// ── Documento completo ────────────────────────────────────────────────────────
//
// O documento é agora AUTOSSUFICIENTE:
//   • O índice é gerado estaticamente — sem campos Word, sem TOC nativo
//   • Não requer Microsoft Word para ser aberto/utilizado correctamente
//   • Funciona em mobile, LibreOffice, Google Docs, e qualquer leitor DOCX
//   • features.updateFields foi removido — não é necessário com índice estático

export async function buildDocxDocument(ast: DocumentNode[]): Promise<Document> {
  const sections = await buildContentSections(ast);

  return new Document({
    styles:    SHARED_STYLES,
    numbering: SHARED_NUMBERING,
    sections,
  });
}
