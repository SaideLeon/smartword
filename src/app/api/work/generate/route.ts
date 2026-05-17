import { NextResponse } from 'next/server';
import { saveWorkOutlineDraft } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { GeminiApiError, geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { parseOutlinePayload } from '@/lib/validation/input-guards';
import { PROMPT_INJECTION_GUARD, wrapUserInput } from '@/lib/prompt-sanitizer';
import { requireAuth } from '@/lib/api-auth';
import type { WorkType } from '@/lib/work/types';

// ── Sistema prompt: trabalho académico clássico ────────────────────────────────

const SYSTEM_ACADEMIC = `${PROMPT_INJECTION_GUARD}

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

// ── Sistema prompt: projecto empresarial / empreendedor ───────────────────────

const SYSTEM_PROJECT = `${PROMPT_INJECTION_GUARD}

És um especialista em elaboração de projectos empresariais e empreendedorismo para o ensino secundário e médio em Moçambique.
Vais gerar um esboço orientador para um projecto sobre o tópico fornecido.

O projecto tem SEMPRE esta estrutura fixa (não adicionares nem removeres secções):

### 1. Introdução
### 1.1 Objetivo
#### 1.1.1 Objetivo Geral
#### 1.1.2 Objetivos Específicos
### 2. Metodologia
### 2.1 Problematização
### 2.2 Justificativa
### 3. Enquadramento Teórico
### 3.1 Análise FOFA
### 3.2 Localização do projeto
### 3.3 Recursos Humanos
### 4. Implementação do projeto
### 4.1 Análise financeira / Despesas
### 4.2 Lucro
## 5. Marketing
## 6. Conclusão
## Referência Bibliográfica

REGRAS DE ESTRUTURA OBRIGATÓRIAS:
- Os prefixos numéricos são FIXOS — nunca os alteres (1., 2., 3.1, 4.1.1, etc.)
- Os Objetivos ficam SEMPRE dentro de 1.1, com subníveis #### para Geral e Específicos
- NÃO incluas "Índice" em nenhuma posição do esboço
- Usa ## para secções principais, ### para subsecções, #### para subsubsecções
- REGRA EXPLÍCITA E OBRIGATÓRIA: embora sejam secções-pai, "Introdução", "Metodologia" e "Enquadramento Teórico" devem ser escritas obrigatoriamente com ### (não usar ## nestes 3 títulos).

Para cada secção/subsecção, descreve em 2-4 frases o que o aluno deve abordar. Norma APA 7.ª edição.

GUIA DE CONTEÚDO POR SECÇÃO:
- "1.1.1 Objetivo Geral": 1 frase no infinitivo que resume a ambição do projecto
- "1.1.2 Objetivos Específicos": 3-4 bullets no infinitivo, mensuráveis
- "2.1 Problematização": problema real identificado que o projecto resolve
- "2.2 Justificativa": porquê este projecto é relevante para o contexto moçambicano
- "3.1 Análise FOFA": Forças, Oportunidades, Fraquezas e Ameaças (tabela ou bullets) aplicadas ao projecto concreto — sem teoria
- "3.2 Localização do projeto": onde será implementado e porquê essa localização
- "3.3 Recursos Humanos": equipa necessária, funções e qualificações

- "4.1 Análise financeira / Despesas": esta secção tem QUATRO blocos obrigatórios e separados:
    1. **Investimento Inicial** — gasto único para arrancar o negócio (equipamentos, mobiliário, stock inicial, licenças), apresentado em tabela com valores em MT
    2. **Grupo A — Despesas Correntes** — despesas cujo valor VARIA de mês para mês conforme o consumo (ex: compra de água — hoje pago 20 MT, amanhã pago 30 MT; produtos, matéria-prima, transporte para compras), apresentadas em tabela com 3 meses de projecção
    3. **Grupo B — Despesas Fixas** — despesas com valor DEFINIDO pagas uma vez por mês independentemente do volume de trabalho (ex: renda do espaço, energia eléctrica, salário fixo), com o mesmo valor nos três meses
    4. **Total Geral de Despesas** — tabela resumo que soma os dois grupos (Correntes + Fixas) por mês
    Todos os valores em Metical Moçambicano (MT). NÃO incluir receitas nem lucro nesta secção.

- "4.2 Lucro": esta secção tem TRÊS blocos obrigatórios e separados:
    1. **Tabela de Receitas** — lista os serviços/produtos com preço unitário, número estimado de clientes por mês (crescente entre meses) e total mensal em MT
    2. **Cálculo do Lucro** — tabela com: (+) Total de Receitas | (−) Total de Despesas [exactamente o TOTAL GERAL de 4.1] | (=) Lucro Líquido | (%) Margem de Lucro
    3. **Análise do Retorno** — 2 a 3 parágrafos sobre viabilidade: quando o negócio começa a ser lucrativo e em quantos meses recupera o investimento inicial
    NÃO repetir a lista de despesas — apenas usar o total vindo de 4.1.

- "5. Marketing": público-alvo, estratégia de comunicação, canais de divulgação, preço e distribuição (4 Ps)
- "6. Conclusão": síntese dos pontos-chave e viabilidade do projecto
- "Referência Bibliográfica": fontes em APA 7.ª edição

Escreve em português europeu/moçambicano. Sê concreto, prático e orientado ao negócio.`;

function getSystemPrompt(workType: WorkType): string {
  return workType === 'project' ? SYSTEM_PROJECT : SYSTEM_ACADEMIC;
}

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

    const { topic, sessionId, suggestions, workType = 'academic' } = parsedPayload as typeof parsedPayload & { workType?: WorkType };

    const SYSTEM = getSystemPrompt(workType);

    const suggestionBlock = suggestions
      ? `\n\nSugestões de ajuste dadas pelo utilizador para esta nova versão do esboço:\n${wrapUserInput('user_suggestions', suggestions)}\n\nAplica estas sugestões com prioridade e regenera o esboço completo. Mantém SEMPRE a estrutura de secções definida.`
      : '';

    const stream = await geminiGenerateTextStreamSSE({
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: `Gera o esboço orientador para um ${workType === 'project' ? 'projecto' : 'trabalho escolar'} sobre:\n${wrapUserInput('user_topic', topic)}${suggestionBlock}`,
        },
      ],
      maxOutputTokens: 1200,
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
