import { describe, expect, it } from 'vitest';
import { analyseCompressionNeed, buildOptimisedContext } from '@/lib/tcc/context-compressor';
import type { TccSession } from '@/lib/tcc/types';

function makeSession(): TccSession {
  return {
    id: 'sess-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    topic: 'Tema',
    outline_draft: null,
    outline_approved: '## Secções',
    sections: [
      { index: 0, title: 'Introdução', status: 'developed', content: 'Conteúdo 0' },
      { index: 1, title: 'Revisão', status: 'developed', content: 'Conteúdo 1' },
      { index: 2, title: 'Metodologia', status: 'pending', content: '' },
    ],
    status: 'in_progress',
    context_summary: 'Resumo anterior',
    summary_covers_up_to: 0,
    summary_updated_at: new Date().toISOString(),
    total_tokens_estimate: 0,
    research_keywords: null,
    research_brief: null,
    research_generated_at: null,
    cover_data: null,
  };
}

describe('context-compressor', () => {
  it('mantém somente a última secção completa e comprime o restante', () => {
    const session = makeSession();
    const decision = analyseCompressionNeed(session, 2);

    expect(decision.shouldCompress).toBe(true);
    expect(decision.recentSections.map(s => s.index)).toEqual([1]);
    expect(decision.developedButUncompressed.map(s => s.index)).toEqual([1]);
  });

  it('usa apenas a última secção como contexto completo para a IA', () => {
    const session = makeSession();
    const optimised = buildOptimisedContext(session, 2);

    expect(optimised.recentSectionsContent).toContain('### Revisão');
    expect(optimised.recentSectionsContent).not.toContain('### Introdução');
  });
});
