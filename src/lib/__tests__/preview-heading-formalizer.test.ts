import { describe, expect, it } from 'vitest';
import { formalizePreviewHeadings } from '@/lib/preview-heading-formalizer';

describe('formalizePreviewHeadings', () => {
  it('converte headings de nível 1 a 5 para nível 6', () => {
    const input = [
      '# Título',
      '## Subtítulo',
      '### Seção',
      '#### Parte',
      '##### Item',
    ].join('\n');

    const output = formalizePreviewHeadings(input);

    expect(output).toBe([
      '###### Título',
      '###### Subtítulo',
      '###### Seção',
      '###### Parte',
      '###### Item',
    ].join('\n'));
  });

  it('mantém headings já no nível 6', () => {
    expect(formalizePreviewHeadings('###### Mantém')).toBe('###### Mantém');
  });

  it('não altera linhas comuns', () => {
    const input = 'Texto normal\n- lista\nsem heading';
    expect(formalizePreviewHeadings(input)).toBe(input);
  });
});
