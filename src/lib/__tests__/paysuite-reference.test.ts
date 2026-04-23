import { describe, expect, it } from 'vitest';
import { generatePaySuiteReference } from '@/lib/paysuite';

describe('generatePaySuiteReference', () => {
  it('gera referência apenas alfanumérica e com tamanho <= 50', () => {
    const ref = generatePaySuiteReference('plano_pro-2026', '550e8400-e29b-41d4-a716-446655440000');

    expect(ref).toMatch(/^[A-Z0-9]+$/);
    expect(ref.length).toBeLessThanOrEqual(50);
    expect(ref.startsWith('MNR')).toBe(true);
  });
});
