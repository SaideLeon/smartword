import { describe, expect, it } from 'vitest';
import { parseChartBlock } from '../chart-parser';

describe('parseChartBlock', () => {
  it('faz parse de um gráfico com labels e múltiplas séries', () => {
    const chart = parseChartBlock([
      'type: bar',
      'title: Vendas por Trimestre',
      'labels: [Q1, Q2, Q3, Q4]',
      'series:',
      '  - label: 2024',
      '    data: [120, 150, 130, 180]',
      '  - label: 2023',
      '    data: [100, 130, 110, 160]',
    ].join('\n'));

    expect(chart).not.toBeNull();
    expect(chart?.type).toBe('chart');
    expect(chart?.chartType).toBe('bar');
    expect(chart?.labels).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(chart?.series).toHaveLength(2);
    expect(chart?.series[0]).toEqual({ label: '2024', data: [120, 150, 130, 180] });
  });

  it('retorna null quando faltam labels ou séries', () => {
    const chart = parseChartBlock('type: line\ntitle: Sem dados');

    expect(chart).toBeNull();
  });
});
