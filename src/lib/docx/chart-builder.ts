import { BarChart, ChartAxisTickMark, type IChartOptions, LineChart, Paragraph, PieChart } from 'docx';
import type { ChartNode } from './types';

const CHART_COLORS = [
  '1F3864',
  '2E75B6',
  '70AD47',
  'ED7D31',
  'FFC000',
  '5A96A0',
  'C55A11',
  '833C00',
];

function buildChartOptions(node: ChartNode): IChartOptions {
  const data = node.series.map((serie, index) => ({
    name: serie.label,
    labels: node.labels,
    values: serie.data,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return {
    title: node.title,
    data,
    series: node.series.map((serie, index) => ({
      name: serie.label,
      color: CHART_COLORS[index % CHART_COLORS.length],
    })),
    width: 16_200_000,
    height: 8_000_000,
    axisTick: {
      x: { major: ChartAxisTickMark.OUTSIDE },
      y: { major: ChartAxisTickMark.OUTSIDE },
    },
  };
}

export function buildChart(node: ChartNode): Paragraph {
  const options = buildChartOptions(node);

  switch (node.chartType) {
    case 'bar':
      return new Paragraph({ children: [new BarChart(options)] });

    case 'line':
      return new Paragraph({ children: [new LineChart(options)] });

    case 'pie':
      return new Paragraph({
        children: [
          new PieChart({
            ...options,
            data: [options.data[0]],
          }),
        ],
      });

    case 'area':
      return new Paragraph({
        children: [
          new LineChart({
            ...options,
            smooth: false,
          }),
        ],
      });

    default:
      return new Paragraph({ children: [new BarChart(options)] });
  }
}
