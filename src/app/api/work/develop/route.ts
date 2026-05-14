import { NextResponse } from 'next/server';
import { saveWorkOutlineDraft } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { GeminiApiError, geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { parseOutlinePayload } from '@/lib/validation/input-guards';
import { PROMPT_INJECTION_GUARD, wrapUserInput } from '@/lib/prompt-sanitizer';
import { requireAuth } from '@/lib/api-auth';

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Geração de esboço orientador
// Actualizado com exemplos reais de erros académicos e versões corrigidas.
// ─────────────────────────────────────────────────────────────────────────────

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

══════════════════════════════════════════════════════════
REGRAS OBRIGATÓRIAS — OBJETIVO GERAL E OBJETIVOS ESPECÍFICOS
══════════════════════════════════════════════════════════

ERRO ACADÉMICO GRAVE — nunca reproduzir este padrão:
┌─────────────────────────────────────────────────────────────────┐
│ ERRADO — Objetivo Geral extenso (exemplo real de trabalho reprovado):         │
│                                                                 │
│ "O objetivo geral deste projeto consiste na implementação de    │
│ uma escola de confeitaria especializada em bolos de formas       │
│ simples, estruturada para promover a autonomia financeira dos   │
│ formandos através da aquisição de competências técnicas         │
│ práticas. A iniciativa visa colmatar o skill gap — ou lacuna    │
│ de competências — identificado no setor da pastelaria artesanal │
│ em Moçambique, onde a procura por formação profissionalizante   │
│ de curta duração é elevada, mas a oferta de qualidade permanece │
│ limitada (ILO, 2021). A proposta pedagógica centra-se na        │
│ padronização de receitas [...] Um exemplo prático desta         │
│ capacitação é a transição de uma produção doméstica irregular   │
│ para a criação de um catálogo de produtos com preço de venda    │
│ tecnicamente calculado. [...]"                                  │
│                                                                 │
│ PORQUÊ ESTÁ ERRADO: o Objetivo Geral tem vários parágrafos,     │
│ exemplos práticos, citações (ILO, 2021), contextualizações e    │
│ argumentações. Isso é corpo do trabalho, não objetivo.          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ERRADO — Objetivos Específicos com explicações (exemplo real):  │
│                                                                 │
│ "● Gestão de custos e precificação: É imperativo que os         │
│ formandos compreendam a lógica do ponto de equilíbrio           │
│ (break-even point). Este objetivo visa ensinar o cálculo        │
│ rigoroso do custo unitário de cada produto, considerando o      │
│ valor dos insumos e as despesas operacionais. Por exemplo,      │
│ um formando aprenderá a contabilizar o custo exato de cada      │
│ grama de farinha ou açúcar [...] (Gisslen, 2016)"               │
│                                                                 │
│ PORQUÊ ESTÁ ERRADO: cada objetivo tem parágrafos explicativos,  │
│ exemplos e citações de autor. Isso pertence ao enquadramento    │
│ teórico, não aos objetivos.                                     │
└─────────────────────────────────────────────────────────────────┘

VERSÃO CORRETA — seguir sempre este formato exacto:

**1.1.1 Objetivo Geral**

> [UMA única frase, verbo no infinitivo, resume o propósito central do trabalho. Máximo 40 palavras.]

Exemplo:
> Implementar uma escola de confeitaria especializada em bolos de formas simples como instrumento de capacitação técnica e promoção da autonomia financeira de pequenos empreendedores em Moçambique.

**1.1.2 Objetivos Específicos**

- [Verbo infinitivo] + [complemento directo, sem explicação];
- [Verbo infinitivo] + [complemento directo, sem explicação];
- [Verbo infinitivo] + [complemento directo, sem explicação];
- [Verbo infinitivo] + [complemento directo, sem explicação];
- [Verbo infinitivo] + [complemento directo, sem explicação].

Exemplo:
- Capacitar os formandos nas técnicas fundamentais de confeção de bolos de formas simples;
- Ensinar métodos de cálculo de custos de produção e precificação de produtos;
- Aplicar normas de higiene e segurança alimentar no contexto da pastelaria artesanal;
- Desenvolver competências de gestão de microempresas nos formandos;
- Promover o empreendedorismo gastronómico como via de inclusão económica local.

REGRA PRÁTICA INVIOLÁVEL:
- Objetivo Geral = 1 frase, verbo no infinitivo, sem explicações, sem exemplos, sem citações.
- Objetivos Específicos = lista de 4 a 5 bullets curtos, verbo no infinitivo, SEM qualquer texto a seguir ao bullet.
- Todo o detalhe, contexto e fundamentação vão para o Enquadramento Teórico — nunca nos objetivos.

══════════════════════════════════════════════════════════
REGRAS OBRIGATÓRIAS — PROBLEMATIZAÇÃO E JUSTIFICATIVA
══════════════════════════════════════════════════════════

ERRO ACADÉMICO GRAVE — nunca reproduzir este padrão:
┌─────────────────────────────────────────────────────────────────┐
│ ERRADO — Problematização com múltiplos problemas (exemplo real):│
│                                                                 │
│ "A problematização deste projeto centra-se na identificação de  │
│ um skill gap [...]. A ausência de formação técnica estruturada  │
│ manifesta-se em três eixos críticos:                            │
│ ● Deficiência técnica: A falta de domínio sobre as propriedades │
│ físico-químicas dos ingredientes leva ao desperdício [...]      │
│ ● Gestão financeira rudimentar: Muitos padecem de uma           │
│ incapacidade de calcular o custo real de produção [...]         │
│ ● Inobservância de normas sanitárias: A falta de formação em    │
│ higiene [...]                                                   │
│ Um exemplo prático desta problemática observa-se na             │
│ precificação de bolos simples: frequentemente, o empreendedor   │
│ contabiliza apenas o custo da farinha e do açúcar [...]"        │
│                                                                 │
│ PORQUÊ ESTÁ ERRADO: a Problematização lista 3 problemas com     │
│ bullets, exemplos práticos e citações. Ela deve identificar     │
│ UM único problema em UMA única frase. O resto pertence à        │
│ Justificativa ou ao Enquadramento Teórico.                      │
└─────────────────────────────────────────────────────────────────┘

VERSÃO CORRETA:

**2.1 Problematização**

> [UMA única frase que identifica o problema central. Máximo 35 palavras. Sem bullets, sem exemplos, sem citações.]

Exemplo:
> A ausência de formação técnica estruturada em confeitaria impede que pequenos empreendedores moçambicanos padronizem os seus produtos, calculem custos reais de produção e operem de forma sustentável no mercado informal.

**2.2 Justificativa**

[2 a 3 parágrafos que:
  1. Explicam por que o problema identificado é relevante
  2. Descrevem como o projeto/trabalho vai resolver ou abordar esse problema
  3. Incluem contexto social/económico e referências se aplicável]

REGRA PRÁTICA INVIOLÁVEL:
- Problematização = 1 frase que nomeia o problema. Nada mais.
- Justificativa = detalha o problema e apresenta como o trabalho o resolve.
- O erro mais comum é usar a Problematização para justificar — quando ela deve apenas nomear o problema com precisão.

══════════════════════════════════════════════════════════
REGRAS GERAIS DE ESTRUTURA
══════════════════════════════════════════════════════════

- Mantém a numeração exactamente como acima (1, 1.1, 1.1.1, ... 6)
- Usa ## para secções principais, ### para subsecções e #### para sub-subsecções
- NÃO incluas "Índice" em nenhuma posição do esboço

REGRAS DE CONTEÚDO:
- 1. Introdução: definição do tema + resumo breve (regra 20/80: apenas ~20% das informações para orientar o leitor)
- 3.1 Análise FOFA: incluir Forças, Oportunidades, Fraquezas e Ameaças
- 3.2 Localização do projeto: exemplo de localização e enquadramento com legislação moçambicana aplicável
- 3.3 Recursos Humanos: número de funcionários, funções, níveis e tempo de capacitação
- 4.1 Análise financeira / Despesas: tabela com despesas correntes (energia, água, transporte) e fixas (aluguer, salários)
- 4.2 Lucro: estimativa de lucro com valor monetário base constante quando for projecto de negócio
- 5. Marketing: plano de marketing objetivo para o projecto
- Referência Bibliográfica: fontes em APA 7.ª edição

Escreve em português europeu/moçambicano. Sê concreto e útil para o nível seleccionado.`;

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'work:develop', maxRequests: 10, windowMs: 60_000 });
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
        { role: 'system', content: `${SYSTEM}\n\nNível de ensino do aluno: ${nivelEnsino} em Moçambique.` },
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
