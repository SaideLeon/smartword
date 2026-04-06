import { describe, expect, it } from 'vitest';
import { sanitizeMathMarkup } from '@/lib/math-markup-sanitizer';

describe('sanitizeMathMarkup', () => {
  it('remove scripts e event handlers', () => {
    const dirty = '<math onclick="alert(1)"><mrow>ok</mrow><script>alert(1)</script></math>';
    const clean = sanitizeMathMarkup(dirty);

    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick=');
    expect(clean).toContain('<math');
  });

  it('neutraliza javascript: em atributos href/src', () => {
    const dirty = '<a href="javascript:alert(1)">x</a><use xlink:href="javascript:evil()"></use>';
    const clean = sanitizeMathMarkup(dirty);

    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('href="#"');
  });
});
