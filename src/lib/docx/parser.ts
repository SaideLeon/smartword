import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import { DocumentNode, InlineNode, TableRowNode, TableCellNode, TableAlign } from './types';
import { parseChartBlock } from './chart-parser';

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
      default:
        return null;
    }
  }

  function processBlock(node: any): DocumentNode | null {
    switch (node.type) {
      case 'paragraph': {
        // ── Marcadores estruturais especiais ────────────────────────────────
        // Uma linha com apenas {pagebreak} → quebra de página (sem nova secção)
        // Uma linha com apenas {section}   → nova secção (reinicia paginação)
        // Uma linha com apenas {toc}       → índice automático
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
