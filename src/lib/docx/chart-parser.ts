import type { ChartNode, ChartSeries, ChartType } from './types';

const SUPPORTED_CHART_TYPES: ChartType[] = ['bar', 'line', 'pie', 'area'];

/**
 * Faz o parse de um bloco ```chart ... ``` em ChartNode.
 * Formato YAML mínimo — sem dependência externa de parser YAML.
 */
export function parseChartBlock(raw: string): ChartNode | null {
  const lines = raw.split('\n').map((line) => line.trimEnd());

  let chartType: ChartType = 'bar';
  let title: string | undefined;
  let labels: string[] = [];
  const series: ChartSeries[] = [];
  let currentSeries: ChartSeries | null = null;

  for (const line of lines) {
    const typeMatch = line.match(/^type:\s*(\w+)/);
    if (typeMatch) {
      const parsedType = typeMatch[1] as ChartType;
      if (SUPPORTED_CHART_TYPES.includes(parsedType)) {
        chartType = parsedType;
      }
      continue;
    }

    const titleMatch = line.match(/^title:\s*(.+)/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    const labelsMatch = line.match(/^labels:\s*\[([^\]]+)\]/);
    if (labelsMatch) {
      labels = labelsMatch[1].split(',').map((label) => label.trim());
      continue;
    }

    const seriesLabelMatch = line.match(/^\s+-\s+label:\s*(.+)/);
    if (seriesLabelMatch) {
      if (currentSeries) {
        series.push(currentSeries);
      }

      currentSeries = {
        label: seriesLabelMatch[1].trim(),
        data: [],
      };
      continue;
    }

    const dataMatch = line.match(/^\s+data:\s*\[([^\]]+)\]/);
    if (dataMatch && currentSeries) {
      currentSeries.data = dataMatch[1]
        .split(',')
        .map((value) => Number.parseFloat(value.trim()))
        .filter((value) => Number.isFinite(value));
    }
  }

  if (currentSeries) {
    series.push(currentSeries);
  }

  if (series.length === 0 || labels.length === 0) {
    return null;
  }

  return {
    type: 'chart',
    chartType,
    title,
    labels,
    series,
  };
}
