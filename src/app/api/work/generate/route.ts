import { NextResponse } from 'next/server';
import { saveWorkOutlineDraft } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM = `És um especialista em metodologia académica do ensino secundário e médio em Moçambique.
Vais gerar um esboço orientador para um trabalho escolar sobre o tópico fornecido.

O trabalho tem SEMPRE estas secções fixas (não adicionares nem removeres nenhuma), na secção "Desenvolvimento Teórico" deve haver subsecções com numeração árabe (1.1, 1.2, 1.3…) relativas ao tema. A estrutura principal obrigatória é:

## I. Introdução
## II. Objectivos
## III. Metodologia
## Desenvolvimento Teórico
### 1.1 [Subsecção relativa ao tema]
### 1.2 [Subsecção relativa ao tema]
### 1.3 [Subsecção relativa ao tema]
## Conclusão
## Referências Bibliográficas

REGRAS DE ESTRUTURA OBRIGATÓRIAS:
- Os prefixos romanos (I., II., III.) e a ausência de número em Conclusão e Referências são FIXOS — nunca os alteres
- "Objectivos" e "Metodologia" são SEMPRE secções SEPARADAS — nunca as juntes numa única secção
- O "Desenvolvimento Teórico" NÃO é inserido directamente — apenas as suas subsecções (1.1, 1.2, 1.3…) são desenvolvidas
- NÃO incluas "Índice" em nenhuma posição do esboço

Para cada secção, descreve em 2-4 frases o que o aluno deve abordar, tendo em conta o tópico. Usa Markdown: ## para secções principais, ### para subsecções.
Norma de redacção obrigatória para todo o trabalho: APA (7.ª edição).

REGRAS DE ADEQUAÇÃO AO NÍVEL SECUNDÁRIO/MÉDIO — OBRIGATÓRIAS:
- "II. Objectivos" deve ter APENAS: 1 objectivo geral (1 frase) + 3 a 4 objectivos específicos simples (bullets curtos). SEM metodologia aqui.
- "III. Metodologia" deve ter APENAS: 1 parágrafo breve (máximo 4 linhas) descrevendo como o trabalho foi desenvolvido (pesquisa em livros e internet, análise de exemplos, etc.). SEM objectivos aqui.
- "I. Introdução" deve ser simples: contextualizar o tema, dizer porque é importante e apresentar a estrutura do trabalho. Máximo 1 página. SEM questão de investigação formal.
- As subsecções do Desenvolvimento (1.1, 1.2, 1.3) apresentam os conceitos de forma clara e progressiva, com exemplos práticos simples ligados ao quotidiano moçambicano.
- "Conclusão" resume os pontos principais e apresenta a opinião do aluno. Máximo 1 página.
- A linguagem de TODO o trabalho deve ser clara e adequada ao ensino secundário.

Escreve em português europeu/moçambicano. Sê concreto e útil — o esboço serve de guia para o desenvolvimento posterior.`;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'work:generate', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { topic, sessionId, suggestions } = await req.json();
    const cleanedSuggestions = typeof suggestions === 'string' ? suggestions.trim() : '';
    const suggestionBlock = cleanedSuggestions
      ? `\n\nSugestões de ajuste dadas pelo utilizador para esta nova versão do esboço:\n${cleanedSuggestions}\n\nAplica estas sugestões com prioridade e regenera o esboço completo. Mantém SEMPRE a estrutura com I., II., III. e Objectivos separados de Metodologia.`
      : '';

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Gera o esboço orientador para um trabalho escolar sobre: "${topic}"${suggestionBlock}` },
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

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

    return new NextResponse(response.body!.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
