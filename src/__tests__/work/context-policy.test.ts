import { describe, expect, it } from 'vitest';
import { buildWorkContextPolicyInstruction, detectWorkContextPolicy } from '../../lib/work/context-policy';

describe('work context policy', () => {
  it('classifica temas matemáticos como universais para evitar exemplos moçambicanos artificiais', () => {
    const policy = detectWorkContextPolicy('Multiplicação de monómios');

    expect(policy).toBe('universal');
    expect(buildWorkContextPolicyInstruction(policy)).toContain('NÃO incluas contexto moçambicano por padrão');
  });

  it('mantém contexto moçambicano quando o tópico pede essa âncora local', () => {
    expect(detectWorkContextPolicy('Impacto da economia informal em Moçambique')).toBe('mozambique');
  });

  it('mantém projectos empresariais em contexto local', () => {
    expect(detectWorkContextPolicy('Criação de uma papelaria escolar', 'project')).toBe('project');
  });
});
