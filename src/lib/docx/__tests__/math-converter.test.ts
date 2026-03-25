import { describe, expect, it } from 'vitest';
import { convertLatexToOmml } from '../math-converter';

describe('convertLatexToOmml', () => {
  it('converte fórmula quadrática para OMML', async () => {
    const omml = await convertLatexToOmml('x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}', true);

    expect(omml).toContain('<m:oMath');
    expect(omml).toContain('m:r');
  });

  it('escapa operador "<" no XML final', async () => {
    const omml = await convertLatexToOmml('a<b', false);

    expect(omml).toContain('&lt;');
    expect(omml).not.toContain('<m:t><</m:t>');
  });

  it('converte expressão de logaritmo sem erro', async () => {
    const omml = await convertLatexToOmml('\\log_{10}(100)=2', false);

    expect(omml).toContain('<m:oMath');
  });
});
