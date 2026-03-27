import { Paragraph, TextRun } from 'docx';
import type { ChartNode } from './types';

const CHART_SYMBOL: Record<ChartNode['chartType'], string> = {
  bar: '▇',
  line: '▁',
  pie: '◔',
  area: '▆',
};

function formatValue(value: number): string {
  if (Number.isFinite(value)) return `${value}`;
  return '0';
}

/**
 * Fallback textual representation for charts.
 *
 * The current `docx` package version used by this project does not export
 * chart classes (BarChart, LineChart, PieChart, etc.), so we render a
 * readable data summary instead of native Office chart XML.
 */
export function buildChart(node: ChartNode): Paragraph {
  const symbol = CHART_SYMBOL[node.chartType] ?? '•';
  const title = node.title?.trim() ? `${node.title.trim()} (${node.chartType})` : `Gráfico (${node.chartType})`;

  const lines = node.series.map((serie) => {
    const points = node.labels.map((label, idx) => `${label}: ${formatValue(serie.data[idx] ?? 0)}`);
    return `${symbol} ${serie.label} — ${points.join(' | ')}`;
  });

  return new Paragraph({
    spacing: { before: 200, after: 200 },
    children: [
      new TextRun({ text: title, bold: true }),
      new TextRun({ text: '\n' }),
      new TextRun({ text: lines.join('\n') || `${symbol} Sem dados` }),
    ],
  });
}
