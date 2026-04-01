import { describe, expect, it } from 'vitest';
import { parseToAST } from '../parser';

describe('parseToAST', () => {
  it('interpreta marcadores estruturais especiais', () => {
    const ast = parseToAST('{pagebreak}\n\n{section}');

    expect(ast[0]?.type).toBe('page_break');
    expect(ast[1]?.type).toBe('section_break');
  });

  it('normaliza delimitadores matemáticos tipo \\( \\) e \\[ \\]', () => {
    const ast = parseToAST('Inline: \\(a+b\\)\n\n\\[x^2+y^2=z^2\\]');

    const paragraph = ast.find(node => node.type === 'paragraph');
    const blockMath = ast.find(node => node.type === 'math_block');

    if (!paragraph || paragraph.type !== 'paragraph') {
      throw new Error('Parágrafo não encontrado no AST');
    }

    const inlineMath = paragraph.children.find(child => child.type === 'math_inline');

    expect(inlineMath && inlineMath.type === 'math_inline' ? inlineMath.latex : null).toBe('a+b');
    expect(blockMath && blockMath.type === 'math_block' ? blockMath.latex : null).toBe('x^2+y^2=z^2');
  });


  it('converte bloco ```chart``` em nó de gráfico', () => {
    const markdown = [
      '```chart',
      'type: line',
      'title: Receita',
      'labels: [Jan, Fev, Mar]',
      'series:',
      '  - label: 2025',
      '    data: [10, 12, 18]',
      '```',
    ].join('\n');

    const ast = parseToAST(markdown);
    const chartNode = ast[0];

    expect(chartNode?.type).toBe('chart');
    if (!chartNode || chartNode.type !== 'chart') throw new Error('Gráfico não encontrado');

    expect(chartNode.chartType).toBe('line');
    expect(chartNode.labels).toEqual(['Jan', 'Fev', 'Mar']);
    expect(chartNode.series[0]?.data).toEqual([10, 12, 18]);
  });

  it('converte bloco de código comum em parágrafo com inline_code', () => {
    const ast = parseToAST('```ts\nconst x = 1;\n```');

    expect(ast[0]?.type).toBe('paragraph');
    if (!ast[0] || ast[0].type !== 'paragraph') throw new Error('Parágrafo não encontrado');

    expect(ast[0].children[0]).toEqual({
      type: 'inline_code',
      value: 'const x = 1;',
    });
  });

  it('mantém tabelas GFM no AST', () => {
    const markdown = [
      '| Coluna A | Coluna B |',
      '| --- | ---: |',
      '| 1 | 2 |',
    ].join('\n');

    const ast = parseToAST(markdown);
    const table = ast.find(node => node.type === 'table');

    expect(table?.type).toBe('table');
    if (!table || table.type !== 'table') throw new Error('Tabela não encontrada');
    expect(table.rows.length).toBe(2);
    expect(table.rows[0].isHeader).toBe(true);
    expect(table.rows[1].isHeader).toBe(false);
  });

  it('preserva título HTML acima da tabela', () => {
    const markdown = [
      '<p><strong>Tabela 1:</strong> Distribuição por classe</p>',
      '',
      '| Classe | Total |',
      '| --- | ---: |',
      '| A | 12 |',
    ].join('\n');

    const ast = parseToAST(markdown);

    expect(ast[0]?.type).toBe('paragraph');
    if (!ast[0] || ast[0].type !== 'paragraph') throw new Error('Parágrafo do título não encontrado');
    expect(ast[0].children[0]).toEqual({
      type: 'text',
      value: 'Tabela 1: Distribuição por classe',
    });

    const table = ast.find(node => node.type === 'table');
    expect(table?.type).toBe('table');
  });
});
