import { NextResponse } from 'next/server';
import { saveWorkOutlineDraft } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { GeminiApiError, geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { parseOutlinePayload } from '@/lib/validation/input-guards';
import { PROMPT_INJECTION_GUARD, wrapUserInput } from '@/lib/prompt-sanitizer';
import { requireAuth } from '@/lib/api-auth';

const SYSTEM = `${PROMPT_INJECTION_GUARD}

És um especialista em metodologia académica do ensino secundário e médio em Moçambique.
Vais gerar um esboço orientador para um trabalho escolar sobre o tópico fornecido.

O trabalho tem SEMPRE estas secções fixas (não adicionares nem removeres nenhuma). A estrutura principal obrigatória é:

## I. Introdução
## II. Objectivos
## III. Metodologia
## 1. Desenvolvimento Teórico
### 1.1 [Subsecção relativa ao tema]
### 1.2 [Subsecção relativa ao tema]
### 1.3 [Subsecção relativa ao tema]
### 1.4 [Continue com outras subsecção relativa ao tema se necessário]
## IV. Conclusão
## Referências Bibliográficas

REGRAS DE ESTRUTURA OBRIGATÓRIAS:
- Os prefixos romanos (I., II., III., 1. IV. ) são FIXOS — nunca os alteres
- "Objectivos" e "Metodologia" são SEMPRE secções SEPARADAS — nunca as juntes
- O "Desenvolvimento Teórico" usa o prefixo "1." e as subsecções usam numeração árabe (1.1, 1.2, 1.3…)
- NÃO incluas "Índice" em nenhuma posição do esboço

Para cada secção, descreve em 2-4 frases o que o aluno deve abordar. Usa Markdown: ## para secções principais, ### para subsecções.
Norma de redacção obrigatória para todo o trabalho: APA (7.ª edição).

REGRAS DE ADEQUAÇÃO AO NÍVEL SECUNDÁRIO/MÉDIO — OBRIGATÓRIAS:
- "II. Objectivos" deve ter APENAS: 1 objectivo geral (1 frase no infinitivo) + 3 a 4 objectivos específicos simples (bullets no infinitivo). SEM metodologia aqui. SEM referências ou citações.
- "III. Metodologia" deve descrever: tipo de pesquisa (qualitativa/bibliográfica), método de análise (histórico, comparativo, etc.) e critérios de selecção das fontes. SEM objectivos aqui.
- "I. Introdução" deve conter: contextualização do tema, problema de pesquisa, objectivos gerais e estrutura do trabalho. Máximo 1 página. SEM desenvolvimento teórico antecipado.
- As subsecções do Desenvolvimento (1.1, 1.2, 1.3) apresentam os conceitos de forma progressiva com exemplos práticos ligados ao quotidiano moçambicano.
- "Conclusão" resume os pontos principais e apresenta a opinião do aluno. Máximo 1 página.
- "Referências Bibliográficas" lista todas as fontes em formato APA 7.ª edição. NÃO aparece em nenhuma outra secção.

Escreve em português europeu/moçambicano. Sê concreto e útil.`;

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'work:generate', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const parsedPayload = parseOutlinePayload(await req.json());
    if (!parsedPayload) {
      return NextResponse.json({ error: 'Payload inválido ou demasiado longo' }, { status: 400 });
    }

    const { topic, sessionId, suggestions } = parsedPayload;

    const suggestionBlock = suggestions
      ? `\n\nSugestões de ajuste dadas pelo utilizador para esta nova versão do esboço:\n${wrapUserInput('user_suggestions', suggestions)}\n\nAplica estas sugestões com prioridade e regenera o esboço completo. Mantém SEMPRE a estrutura com I., II., III. e Objectivos separados de Metodologia.`
      : '';

    const stream = await geminiGenerateTextStreamSSE({
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Gera o esboço orientador para um trabalho escolar sobre:\n${wrapUserInput('user_topic', topic)}${suggestionBlock}`,
        },
      ],
      maxOutputTokens: 1024,
      temperature: 0.4,
    });

    let accumulated = '';

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) accumulated += delta;
          } catch { /* ignorar */ }
        }

        controller.enqueue(chunk);
      },
      async flush() {
        if (sessionId && accumulated) {
          try {
            await saveWorkOutlineDraft(sessionId, accumulated);
          } catch (e) {
            console.error('Erro ao guardar esboço do trabalho:', e);
          }
        }
      },
    });

    return new NextResponse(stream.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    const status = e instanceof GeminiApiError ? e.status : null;
    if (status === 429 || status === 503 || (typeof status === 'number' && status >= 500)) {
      return NextResponse.json(
        { error: 'Serviço de IA temporariamente indisponível. Tenta novamente em alguns segundos.' },
        { status: 503, headers: { 'Retry-After': '5' } },
      );
    }

    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
