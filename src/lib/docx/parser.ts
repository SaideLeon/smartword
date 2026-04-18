import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import { DocumentNode, InlineNode, TableRowNode, TableCellNode, TableAlign, TextAlign } from './types';
import { parseChartBlock } from './chart-parser';

// ── Extracção de text-align a partir de atributos HTML ───────────────────────
// O tiptap-markdown com html:true serializa parágrafos alinhados como:
//   <p style="text-align: center">texto</p>
// O remarkParse com allowDangerousHtml expõe estes como nós "html".

const STYLE_TEXT_ALIGN_RE = /text-align:\s*(left|center|right|justify)/i;

/**
 * Extrai o valor de text-align de um atributo style inline.
 * Retorna undefined se não houver alinhamento declarado.
 */
function extractTextAlign(styleAttr: string): TextAlign | undefined {
  const match = styleAttr.match(STYLE_TEXT_ALIGN_RE);
  if (!match) return undefined;
  const value = match[1].toLowerCase();
  if (value === 'left' || value === 'center' || value === 'right' || value === 'justify') {
    return value as TextAlign;
  }
  return undefined;
}

/**
 * Tenta extrair o atributo style e o conteúdo interno de um nó HTML
 * de parágrafo ou heading emitido pelo tiptap-markdown.
 *
 * Exemplos de input:
 *   <p style="text-align: center">Texto centrado</p>
 *   <h2 style="text-align: right">Título à direita</h2>
 *   <p>Texto sem alinhamento</p>   ← retorna null (sem alinhamento especial)
 *
 * Retorna { tag, textAlign, innerHtml } ou null se não for um bloco reconhecido.
 */
function parseAlignedHtmlBlock(raw: string): {
  tag: string;
  textAlign: TextAlign | undefined;
  innerHtml: string;
} | null {
  // Aceita p, h1-h6
  const blockRe = /^<(p|h[1-6])([^>]*)>([\s\S]*?)<\/\1>\s*$/i;
  const match = raw.trim().match(blockRe);
  if (!match) return null;

  const tag = match[1].toLowerCase();
  const attrs = match[2];
  const innerHtml = match[3];

  const styleMatch = attrs.match(/style="([^"]*)"/i);
  const textAlign = styleMatch ? extractTextAlign(styleMatch[1]) : undefined;

  return { tag, textAlign, innerHtml };
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

export function parseToAST(markdown: string): DocumentNode[] {
  // Preprocess Gemini-style math delimiters to standard markdown math delimiters
  const preprocessed = markdown
    .replace(/\\\((.*?)\\\)/g, '$$$1$$')         // \( ... \) → $...$
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$'); // \[ ... \] → $$...$$

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath);

  const ast = processor.parse(preprocessed);

  function processInline(node: any): InlineNode | null {
    switch (node.type) {
      case 'text':
        return { type: 'text', value: node.value };
      case 'inlineMath':
        return { type: 'math_inline', latex: node.value };
      case 'strong':
        return {
          type: 'strong',
          children: node.children.map(processInline).filter(Boolean) as InlineNode[],
        };
      case 'emphasis':
        return {
          type: 'emphasis',
          children: node.children.map(processInline).filter(Boolean) as InlineNode[],
        };
      case 'inlineCode':
        return { type: 'inline_code', value: node.value };
      case 'link':
        return {
          type: 'link',
          url: node.url,
          children: node.children.map(processInline).filter(Boolean) as InlineNode[],
        };
      case 'html': {
        const text = htmlToPlainText(node.value as string);
        if (!text) return null;
        return { type: 'text', value: text };
      }
      default:
        return null;
    }
  }

  function processBlock(node: any): DocumentNode | null {
    switch (node.type) {
      case 'paragraph': {
        // ── Marcadores estruturais especiais ────────────────────────────────
        if (node.children.length === 1 && node.children[0].type === 'text') {
          const marker = (node.children[0].value as string).trim();
          if (marker === '{pagebreak}') return { type: 'page_break' };
          if (marker === '{section}')   return { type: 'section_break' };
          if (marker === '{toc}')       return { type: 'toc' };
        }
        return {
          type: 'paragraph',
          children: node.children.map(processInline).filter(Boolean) as InlineNode[],
        };
      }
      case 'math':
        return { type: 'math_block', latex: node.value };
      case 'heading':
        return {
          type: 'heading',
          level: node.depth as any,
          children: node.children.map(processInline).filter(Boolean) as InlineNode[],
        };
      case 'list':
        return {
          type: 'list',
          ordered: node.ordered,
          items: node.children.map((item: any) =>
            item.children.map(processBlock).filter(Boolean) as DocumentNode[],
          ),
        };
      case 'blockquote':
        return {
          type: 'blockquote',
          children: node.children.map(processBlock).filter(Boolean) as DocumentNode[],
        };

      case 'html': {
        const raw = node.value as string;

        // ── Bloco HTML com alinhamento (emitido pelo tiptap-markdown) ───────
        // Exemplo: <p style="text-align: center">Texto</p>
        const aligned = parseAlignedHtmlBlock(raw);
        if (aligned) {
          const { tag, textAlign, innerHtml } = aligned;
          const plainText = htmlToPlainText(innerHtml);

          if (!plainText) return null;

          // Determinar o nível do heading, se aplicável
          const headingMatch = tag.match(/^h([1-6])$/);
          if (headingMatch) {
            const level = parseInt(headingMatch[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
            const result: DocumentNode = {
              type: 'heading',
              level,
              children: [{ type: 'text', value: plainText }],
            };
            if (textAlign) result.textAlign = textAlign;
            return result;
          }

          // Parágrafo HTML com ou sem alinhamento
          const result: DocumentNode = {
            type: 'paragraph',
            children: [{ type: 'text', value: plainText }],
          };
          if (textAlign) result.textAlign = textAlign;
          return result;
        }

        // ── HTML genérico sem alinhamento (tabelas, spans, etc.) ─────────────
        const text = htmlToPlainText(raw);
        if (!text) return null;
        return {
          type: 'paragraph',
          children: [{ type: 'text', value: text }],
        };
      }

      // ── Tabelas GFM ──────────────────────────────────────────────────────
      case 'code': {
        if (node.lang === 'chart') {
          return parseChartBlock(node.value as string);
        }

        return {
          type: 'paragraph',
          children: [{ type: 'inline_code', value: node.value }],
        };
      }

      case 'table': {
        const rows: TableRowNode[] = node.children.map((row: any, rowIndex: number) => {
          const cells: TableCellNode[] = row.children.map((cell: any) => ({
            children: cell.children.map(processInline).filter(Boolean) as InlineNode[],
          }));
          return { isHeader: rowIndex === 0, cells };
        });

        return {
          type: 'table',
          align: (node.align ?? []) as (TableAlign | null)[],
          rows,
        };
      }

      default:
        return null;
    }
  }

  return ast.children.map(processBlock).filter(Boolean) as DocumentNode[];
}
