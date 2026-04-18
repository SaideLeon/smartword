export type ChartType = 'bar' | 'line' | 'pie' | 'area';

export interface ChartSeries {
  label: string;
  data: number[];
}

export interface ChartNode {
  type: 'chart';
  chartType: ChartType;
  title?: string;
  labels: string[];
  series: ChartSeries[];
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type TableAlign = 'left' | 'center' | 'right';

export type DocumentNode =
  | { type: 'paragraph'; children: InlineNode[]; textAlign?: TextAlign }
  | { type: 'math_block'; latex: string }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[]; textAlign?: TextAlign }
  | { type: 'list'; ordered: boolean; items: DocumentNode[][] }
  | { type: 'blockquote'; children: DocumentNode[] }
  | { type: 'table'; align: (TableAlign | null)[]; rows: TableRowNode[] }
  | { type: 'page_break' }
  | { type: 'section_break' }
  | { type: 'toc' }
  | ChartNode;

export interface TableRowNode {
  isHeader: boolean;
  cells: TableCellNode[];
}

export interface TableCellNode {
  children: InlineNode[];
}

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'math_inline'; latex: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'emphasis'; children: InlineNode[] }
  | { type: 'link'; url: string; children: InlineNode[] }
  | { type: 'inline_code'; value: string };
