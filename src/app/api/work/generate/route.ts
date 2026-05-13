import { NextResponse } from 'next/server';
import { saveWorkOutlineDraft } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { GeminiApiError, geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { parseOutlinePayload } from '@/lib/validation/input-guards';
import { PROMPT_INJECTION_GUARD, wrapUserInput } from '@/lib/prompt-sanitizer';
import { requireAuth } from '@/lib/api-auth';

const SYSTEM = `${PROMPT_INJECTION_GUARD}

És um especialista em metodologia académica para trabalhos de nível 
Vais gerar um esboço orientador para um trabalho escolar sobre o tópico fornecido.

O trabalho tem SEMPRE esta estrutura fixa (não adicionares nem removeres secções):

## 1. Introdução
### 1.1 Objetivo
#### 1.1.1 Objetivo Geral
#### 1.1.2 Objetivos Específicos
## 2. Metodologia
### 2.1 Problematização
### 2.2 Justificativa
## 3. Enquadramento Teórico
### 3.1 Análise FOFA
### 3.2 Localização do projeto
### 3.3 Recursos Humanos
## 4. Implementação do projeto
### 4.1 Análise financeira / Despesas
### 4.2 Lucro
## 5. Marketing
## 6. Conclusão
## Referência Bibliográfica

REGRAS DE ESTRUTURA OBRIGATÓRIAS:
- Mantém a numeração exactamente como acima (1, 1.1, 1.1.1, ... 6)
- Usa ## para secções principais, ### para subsecções e #### para sub-subsecções
- "2.1 Problematização" deve conter UMA única problematização clara
- NÃO incluas "Índice" em nenhuma posição do esboço

REGRAS DE CONTEÚDO OBRIGATÓRIAS:
- 1.1.1 Objetivo Geral: uma frase no infinitivo
- 1.1.2 Objetivos Específicos: 3 a 4 bullets no infinitivo
- 3.1 Análise FOFA: incluir Forças, Oportunidades, Fraquezas e Ameaças
- 3.2 Localização do projeto: incluir exemplo de localização e enquadramento com legislação moçambicana aplicável
- 3.3 Recursos Humanos: número de funcionários, funções, níveis e tempo de capacitação
- 4.1 Análise financeira / Despesas: incluir tabela com despesas correntes (energia, água, transporte, alimentação) e fixas (aluguer, salários)
- 4.2 Lucro: apresentar estimativa de lucro (com valor base quando necessário)
- 5. Marketing: plano de marketing objectivo para o projecto
- Referência Bibliográfica: listar fontes em APA 7.ª edição

Para cada secção, descreve em 2-4 frases o que o aluno deve abordar, com exemplos contextualizados para Moçambique.

Escreve em português europeu/moçambicano. Sê concreto e útil para o nível seleccionado.`;

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

    const { topic, sessionId, suggestions, nivelEnsino } = parsedPayload;

    const suggestionBlock = suggestions
      ? `\n\nSugestões de ajuste dadas pelo utilizador para esta nova versão do esboço:\n${wrapUserInput('user_suggestions', suggestions)}\n\nAplica estas sugestões com prioridade e regenera o esboço completo. Mantém SEMPRE a estrutura fixa numerada (1 a 6, com níveis 1.1 e 1.1.1 quando aplicável).`
      : '';

    const stream = await geminiGenerateTextStreamSSE({
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: `${SYSTEM}${nivelEnsino} em Moçambique.` },
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
