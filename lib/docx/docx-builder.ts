import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImportedXmlComponent,
  ExternalHyperlink, IParagraphOptions, AlignmentType, convertMillimetersToTwip,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, VerticalAlign,
} from 'docx';
import { DocumentNode, InlineNode, TableRowNode, TableAlign } from './types';
import { convertLatexToOmml } from './math-converter';

// ── Constantes de layout ─────────────────────────────────────────────────────
// A4 com margens 30mm (esq) + 20mm (dir) → largura útil ≈ 9071 DXA
const PAGE_CONTENT_WIDTH_DXA = convertMillimetersToTwip(210 - 30 - 20); // ≈ 9071

// Cores da tabela (tons neutros, legíveis no Word e Google Docs)
const COLOR_HEADER_BG  = 'D9E1F2'; // azul-acinzentado suave
const COLOR_HEADER_FG  = '1F3864'; // azul escuro para texto do cabeçalho
const COLOR_ROW_ALT_BG = 'F2F2F2'; // cinza muito claro para linhas alternadas
const COLOR_BORDER     = 'BFBFBF'; // cinza médio para bordas

// ── Utilitário: aplanar arrays de qualquer profundidade ──────────────────────
// Resolve o bug de listas aninhadas que gerava XML inválido e impedia o Word
// de abrir os ficheiros (arrays dentro de arrays no children do Document).
function deepFlat(arr: any[]): any[] {
  const result: any[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) result.push(...deepFlat(item));
    else result.push(item);
  }
  return result;
}

// ── Bordas padrão de célula ──────────────────────────────────────────────────
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
const CELL_BORDERS = {
  top:    CELL_BORDER,
  bottom: CELL_BORDER,
  left:   CELL_BORDER,
  right:  CELL_BORDER,
};

// ── Alinhamento de célula a partir do alinhamento GFM ───────────────────────
function cellAlignment(align: TableAlign | null): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (align) {
    case 'center': return AlignmentType.CENTER;
    case 'right':  return AlignmentType.RIGHT;
    default:       return AlignmentType.LEFT;
  }
}

// ── Construir uma TableRow a partir de uma linha da AST ──────────────────────
async function buildTableRow(
  row: TableRowNode,
  colWidths: number[],
  aligns: (TableAlign | null)[],
  rowIndex: number,
): Promise<TableRow> {
  const cells = await Promise.all(
    row.cells.map(async (cell, colIdx) => {
      // Conteúdo inline da célula
      const inlineNodes = await Promise.all(cell.children.map(n => buildInline(n)));
      const runs = deepFlat(inlineNodes);

      // Estilo do texto: cabeçalho em negrito e cor escura
      const styledRuns = row.isHeader
        ? runs.map((run: any) => {
            // Clonar o TextRun com bold activado se ainda não tiver
            if (run instanceof TextRun) {
              return new TextRun({
                ...(run as any).options,
                bold: true,
                color: COLOR_HEADER_FG,
              });
            }
            return run;
          })
        : runs;

      const para = new Paragraph({
        alignment: cellAlignment(aligns[colIdx] ?? null),
        children: styledRuns,
        spacing: { before: 0, after: 0 },
      });

      const isEvenRow = rowIndex % 2 === 0; // para alternância de linhas de dados

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

  return new TableRow({
    children: cells,
    tableHeader: row.isHeader, // marca como linha de cabeçalho (repetição em multi-página)
  });
}

// ── Construir a Table completa ───────────────────────────────────────────────
async function buildTable(node: Extract<DocumentNode, { type: 'table' }>): Promise<Table> {
  const colCount = node.rows[0]?.cells.length ?? 1;
  const aligns   = node.align ?? [];

  // Distribuição de largura: colunas iguais por defeito.
  // Garante que somam exactamente PAGE_CONTENT_WIDTH_DXA (sem drift por arredondamento).
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

// ── Inline nodes ─────────────────────────────────────────────────────────────

interface TextOptions {
  bold?: boolean;
  italics?: boolean;
}

async function buildInline(node: InlineNode, options: TextOptions = {}): Promise<any> {
  switch (node.type) {
    case 'text':
      return new TextRun({ text: node.value, bold: options.bold, italics: options.italics });
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
      const children = await Promise.all(node.children.map(c => buildInline(c)));
      const headingMap: Record<number, any> = {
        1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
      };
      return new Paragraph({ ...options, children: children.flat(), heading: headingMap[node.level] });
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

    // ── Tabela ───────────────────────────────────────────────────────────────
    case 'table':
      return buildTable(node);
  }
}

// ── Documento completo ───────────────────────────────────────────────────────

export async function buildDocxDocument(ast: DocumentNode[]): Promise<Document> {
  const blocks = await Promise.all(ast.map(c => buildBlock(c)));

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 24 },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360, lineRule: 'auto' },
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
            spacing: { line: 240, lineRule: 'auto' },
            indent: { left: convertMillimetersToTwip(40) },
          },
        },
      ],
    },
    numbering: {
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
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(210),
            height: convertMillimetersToTwip(297),
          },
          margin: {
            top:    convertMillimetersToTwip(30),
            left:   convertMillimetersToTwip(30),
            bottom: convertMillimetersToTwip(20),
            right:  convertMillimetersToTwip(20),
          },
        },
      },
      // deepFlat: barreira final contra qualquer array aninhado que
      // corromperia o XML do Document e impediria o Word de abrir o ficheiro.
      children: deepFlat(blocks),
    }],
  });
}
