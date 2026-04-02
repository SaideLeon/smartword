import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImportedXmlComponent,
  ExternalHyperlink, IParagraphOptions, AlignmentType, convertMillimetersToTwip,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign,
  PageBreak, Footer, PageNumber, NumberFormat, SectionType,
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

// Aplana recursivamente apenas arrays — preserva objetos docx (TableOfContents, Paragraph, etc.)
function deepFlat(arr: any[]): any[] {
  const result: any[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...deepFlat(item));
    } else {
      result.push(item);
    }
  }
  return result;
}

function getTextRunText(run: TextRun): string | null {
  const directText = (run as any).options?.text ?? (run as any).text;
  return typeof directText === 'string' ? directText : null;
}

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
const CELL_BORDERS = {
  top:    CELL_BORDER,
  bottom: CELL_BORDER,
  left:   CELL_BORDER,
  right:  CELL_BORDER,
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

// ── Índice automático (TOC nativo do Word via campo direto) ──────────────────
//
// Não usamos TableOfContents da biblioteca docx porque esta envolve o campo
// num <w:sdt> (Structured Document Tag) que impede o Word de processar
// automaticamente o campo TOC ao abrir o documento.
//
// Em vez disso, injectamos o XML do campo directamente via ImportedXmlComponent,
// produzindo w:fldChar + w:instrText sem wrapper sdt — idêntico ao que o Word
// gera quando inseres um índice nativo via Referências → Índice.
//
// Instrução TOC:
//   \h  → entradas com hiperligação (Ctrl+click para navegar)
//   \o "1-3" → captura Heading 1, 2 e 3
//   \z  → oculta nº de página no Web Layout (opcional, boa prática)
//   \u  → usa os estilos de parágrafo usados no documento
//
// REQUISITO: o Document DEVE ter features: { updateFields: true }

function buildToc(): any[] {
  // Título "ÍNDICE" centrado e em maiúsculas
  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240, line: 240, lineRule: 'auto' as any },
    children: [
      new TextRun({
        text: 'ÍNDICE',
        bold: true,
        size: 24,
        font: 'Times New Roman',
      }),
    ],
  });

  // Campo TOC injectado como XML puro — sem w:sdt.
  //
  // O Word processa este campo ao abrir com updateFields=true e preenche
  // as entradas automaticamente com base nos headings do documento.
  // O texto "— Índice será gerado..." é o placeholder visível antes da atualização.
  const tocXml =
    `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>` +
      `<w:r><w:instrText xml:space="preserve"> TOC \\h \\o &quot;1-3&quot; \\z \\u </w:instrText></w:r>` +
      `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
      `<w:r>` +
        `<w:rPr><w:color w:val="888888"/><w:sz w:val="20"/></w:rPr>` +
        `<w:t xml:space="preserve">&#x2014; Abrir no Word e clicar em Actualizar &#x2014;</w:t>` +
      `</w:r>` +
      `<w:r><w:fldChar w:fldCharType="end"/></w:r>` +
    `</w:p>`;

  const tocComponent = ImportedXmlComponent.fromXmlString(tocXml);

  // Nota de instrução ao utilizador
  const noteParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 0, line: 240, lineRule: 'auto' as any },
    children: [
      new TextRun({
        text: '[Ao abrir no Word: clique com o botão direito no índice → Actualizar campo]',
        italics: true,
        size: 18,
        color: '888888',
        font: 'Times New Roman',
      }),
    ],
  });

  // Extrair o nó XML do componente (equivalente a como math-converter.ts faz)
  return [titleParagraph, (tocComponent as any).root[0], noteParagraph];
}

// ── Inline nodes ─────────────────────────────────────────────────────────────

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

// ── Block nodes ──────────────────────────────────────────────────────────────

async function buildBlock(node: DocumentNode, options: IParagraphOptions = {}): Promise<any> {
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

      const children = await Promise.all(
        node.children.map(c => buildInline(c, { bold: true, color: '000000' }))
      );

      return new Paragraph({
        ...options,
        children: children.flat(),
        heading: headingMap[node.level],
      });
    }

    case 'list': {
      const currentLevel = (options as any).__nestLevel ?? 0;

      const items = await Promise.all(node.items.map(async (itemBlocks) => {
        const blocks = await Promise.all(itemBlocks.map((block, i) => {
          if (i === 0) {
            return buildBlock(block, {
              ...options,
              bullet: node.ordered ? undefined : { level: currentLevel },
              numbering: node.ordered
                ? { reference: 'ordered-list', level: currentLevel }
                : undefined,
              ...(({ __nestLevel: _, ...rest }) => rest)(options as any),
            });
          }
          return buildBlock(block, { ...options, __nestLevel: currentLevel + 1 } as any);
        }));
        return deepFlat(blocks);
      }));

      return deepFlat(items);
    }

    case 'blockquote': {
      const children = await Promise.all(node.children.map(c => buildBlock(c, { ...options, style: 'Quote' })));
      return deepFlat(children);
    }

    case 'table':
      return buildTable(node);

    case 'page_break':
      return new Paragraph({ children: [new PageBreak()] });

    case 'chart':
      return buildChart(node);

    // ── Índice automático ──────────────────────────────────────────────────
    case 'toc':
      return buildToc();

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
      id: 'Quote',
      name: 'Quote',
      basedOn: 'Normal',
      next: 'Normal',
      run: { size: 20 },
      paragraph: {
        spacing: { line: 240, lineRule: 'auto' as const },
        indent: { left: convertMillimetersToTwip(40) },
      },
    },
    {
      id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 240, after: 120 } },
    },
    {
      id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 200, after: 100 } },
    },
    {
      id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 160, after: 80 } },
    },
    {
      id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 120, after: 60 } },
    },
    {
      id: 'Heading5', name: 'Heading 5', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 120, after: 60 } },
    },
    {
      id: 'Heading6', name: 'Heading 6', basedOn: 'Normal', next: 'Normal',
      run: { bold: true, color: '000000', size: 24 },
      paragraph: { spacing: { before: 120, after: 60 } },
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
  const sectionAsts: DocumentNode[][] = [[]];

  for (const node of ast) {
    if (node.type === 'section_break') {
      sectionAsts.push([]);
    } else {
      sectionAsts[sectionAsts.length - 1].push(node);
    }
  }

  return Promise.all(
    sectionAsts.map(async (nodes, sectionIndex) => {
      const children: any[] = [];

      for (const node of nodes) {
        if (node.type === 'page_break') {
          children.push(new Paragraph({ children: [new PageBreak()] }));
          continue;
        }

        const built = await buildBlock(node);
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
// CRÍTICO: features.updateFields = true é obrigatório para que o Word
// processe o campo {TOC} e mostre as entradas do índice ao abrir o documento.

export async function buildDocxDocument(ast: DocumentNode[]): Promise<Document> {
  const sections = await buildContentSections(ast);

  return new Document({
    features: { updateFields: true },   // ← faz o Word actualizar o TOC ao abrir
    styles:    SHARED_STYLES,
    numbering: SHARED_NUMBERING,
    sections,
  });
}
