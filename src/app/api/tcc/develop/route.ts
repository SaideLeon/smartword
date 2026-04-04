// app/api/tcc/develop/route.ts

import { NextResponse } from 'next/server';
import { getSession, saveSectionContent } from '@/lib/tcc/service';
import { compressContextIfNeeded, buildOptimisedContext } from '@/lib/tcc/context-compressor';
import type { TccSection } from '@/lib/tcc/types';
import { enforceRateLimit } from '@/lib/rate-limit';
import { groqFetch } from '@/lib/groq-resilient';

const SECTIONS_THAT_ALLOW_CLOSING = new Set([
  'conclusão',
  'conclusion',
  'referências',
  'referencias',
  'referências bibliográficas',
  'referencias bibliograficas',
  'bibliography',
  'referências e bibliografia',
]);

function sectionAllowsClosing(title: string): boolean {
  return SECTIONS_THAT_ALLOW_CLOSING.has(title.toLowerCase().trim());
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[ivxlcdm]+\.\s*/i, '')
    .replace(/^\d+(\.\d+)?\.\s*/, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SPURIOUS_HEADING_PATTERN = /^#{1,3}\s*(conclus[aã]o|consider[aã]es\s+finais|refere?ncias?(\s+bibliogr[aá]ficas?)?|bibliography|notas?\s+finais?|síntese|synthesis)\s*$/im;
const SPURIOUS_CLOSING_PHRASES = /\n+(em\s+(suma|conclus[aã]o|síntese)|portanto,\s+conclui-se|por\s+fim,\s+(pode|é\s+poss[ií]vel)|conclui-se\s+(assim|que|portanto)|desta\s+(forma|maneira|feita),\s+(conclui|verifica|observa)-se)[^]*/i;
const SPURIOUS_REFERENCE_BLOCK = /\n+(#{1,3}\s*refere?ncias?[^\n]*\n+)?([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^.\n]{2,60}\.\s*\(\d{4}\)[^\n]*\n){2,}[^]*/;

function stripSpuriousBlocks(content: string, sectionTitle: string): string {
  if (sectionAllowsClosing(sectionTitle)) return content;

  let cleaned = content;

  const headingMatch = SPURIOUS_HEADING_PATTERN.exec(cleaned);
  if (headingMatch && headingMatch.index !== undefined) {
    cleaned = cleaned.slice(0, headingMatch.index).trimEnd();
  }

  cleaned = cleaned.replace(SPURIOUS_CLOSING_PHRASES, '').trimEnd();
  cleaned = cleaned.replace(SPURIOUS_REFERENCE_BLOCK, '').trimEnd();

  return cleaned;
}

function getSectionInstruction(normalizedName: string, isSubsection: boolean): string {
  if (isSubsection) {
    return `Desenvolve esta subsecção com profundidade universitária e rigor científico. Deve:
- Explicar o conceito central com precisão técnica e enquadramento teórico
- Incluir pelo menos 1 exemplo prático quando isso ajudar a compreensão
- Integrar citações no corpo do texto em norma APA (7.ª edição)
- Manter entre 300 e 500 palavras
- Usar Markdown (negrito para termos-chave, listas e ### quando fizer sentido)
- NÃO repetir conteúdo já desenvolvido noutras secções
- NÃO incluir conclusão nem lista final de referências nesta secção`;
  }

  if (normalizedName === 'introducao' || normalizedName === 'introdução') {
    return `Escreve uma introdução académica de nível universitário para TCC. Deve:
- Contextualizar o tema com relevância científica e académica
- Delimitar o problema de investigação de forma clara
- Apresentar objectivo geral e orientação analítica do trabalho
- Resumir a estrutura dos capítulos de forma breve e lógica
- Incluir citações no corpo do texto em APA (7.ª edição)
- Manter entre 300 e 600 palavras
- NÃO antecipar discussão conclusiva`;
  }

  if (normalizedName === 'objectivos' || normalizedName === 'objetivos') {
    return `Escreve APENAS a secção de objectivos em formato técnico e directo.

Estrutura obrigatória:
**Objectivo Geral**
- Uma frase em infinitivo que explicite o propósito central do TCC

**Objectivos Específicos**
- Lista de 3 a 5 bullets, cada um com uma acção mensurável em infinitivo

Regras:
- Manter entre 300 e 600 palavras
- Linguagem académica precisa, sem metodologia detalhada
- Quando houver citação contextual, manter APA (7.ª edição) no corpo do texto
- NÃO incluir conclusão nem lista final de referências`;
  }

  if (normalizedName === 'metodologia') {
    return `Escreve APENAS a metodologia do TCC, com precisão científica.

Estrutura recomendada:
1. **Abordagem e natureza da investigação**
2. **Métodos e técnicas de recolha/análise de dados**
3. **Fontes, critérios de selecção e delimitações**
4. **Procedimentos de validação, ética e limitações metodológicas**

Regras:
- Fundamentar escolhas com citações no corpo do texto (APA 7.ª edição)
- Manter linguagem técnica universitária
- Manter entre 300 e 600 palavras
- NÃO escrever objectivos nem conclusão nesta secção`;
  }

  if (normalizedName === 'conclusao' || normalizedName === 'conclusão') {
    return `Escreve uma conclusão académica consistente e crítica. Deve:
- Sintetizar os principais resultados discutidos no desenvolvimento
- Responder explicitamente ao problema de investigação
- Avaliar contributos, implicações e limitações do estudo
- Apresentar recomendações futuras quando pertinente
- Manter entre 300 e 600 palavras
- Não introduzir dados novos não discutidos anteriormente`;
  }

  if (normalizedName.includes('referencia') || normalizedName.includes('bibliografia')) {
    return `Apresenta APENAS as referências bibliográficas em APA (7.ª edição). Deve:
- Listar fontes efectivamente utilizadas no texto
- Ordenar alfabeticamente pelo apelido do primeiro autor
- Manter consistência formal de pontuação e itálico conforme APA
- Não incluir comentários explicativos fora das referências`;
  }

  return `Desenvolve a secção com rigor universitário, coerência argumentativa e base em fontes académicas. Usa citações no corpo do texto em APA (7.ª edição), mantém entre 300 e 600 palavras, e não incluas conclusão nem lista final de referências.`;
}

function buildSystemPrompt(
  topic: string,
  outline: string,
  researchBrief: string | null,
  contextSummary: string | null,
  recentSectionsContent: string,
  currentSection: TccSection,
  compressionActive: boolean,
): string {
  const historicalContext = compressionActive && contextSummary
    ? `\n[CONTEXTO HISTÓRICO COMPRIMIDO]\n${contextSummary}\n`
    : '';

  const recentContext = recentSectionsContent
    ? `\n[SECÇÕES RECENTES COMPLETAS]\n${recentSectionsContent}\n`
    : '';

  const contextNote = compressionActive
    ? `\n[NOTA DE COMPRESSÃO]\nAs secções mais antigas foram comprimidas para optimizar a janela de contexto. As secções recentes foram mantidas integralmente para preservar continuidade local.\n`
    : '';

  const researchContext = researchBrief
    ? `\n[FICHA DE PESQUISA]\n${researchBrief}\n`
    : '\n[FICHA DE PESQUISA]\n(não disponível)\n';

  const isSubsection = /^\d+\.\d+/.test(currentSection.title);
  const normalizedName = normalizeTitle(currentSection.title);
  const specificInstruction = getSectionInstruction(normalizedName, isSubsection);

  const antiClosingInstruction = !sectionAllowsClosing(currentSection.title)
    ? `
PROIBIÇÕES ABSOLUTAS PARA ESTA SECÇÃO:
❌ NÃO escrevas "Em conclusão", "Em suma", "Conclui-se que", "Por fim" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas no final desta secção
❌ NÃO cries cabeçalhos ## Conclusão, ## Referências, ### Considerações Finais
❌ NÃO fechas com parágrafo de encerramento — termina no último ponto de desenvolvimento
O trabalho tem secções próprias para Conclusão e Referências — não as antecipes aqui.`
    : '';

  return `IDENTIDADE E PAPEL
==================
És um especialista académico para TCC de nível universitário.
Produzes texto técnico, rigoroso e cientificamente fundamentado, em português europeu.
A norma de referenciação é APA (7.ª edição) e deve ser respeitada em todo o trabalho.

CONTEXTO DO PROJECTO (fornecido pelo sistema a cada chamada)
============================================================
[TÓPICO DO TCC]
${topic}

[ESBOÇO APROVADO]
${outline}
${historicalContext}${recentContext}${contextNote}${researchContext}
REGRAS DE ADEQUAÇÃO AO CONTEXTO MOÇAMBICANO
===========================================
Aplica contexto moçambicano APENAS quando:
- O tema é de natureza social, económica, histórica, geográfica ou cívica
- O exemplo moçambicano clarifica o conceito melhor do que um exemplo genérico
- O esboço ou a ficha de pesquisa já referenciam dados ou contexto moçambicano

NÃO forces contexto moçambicano quando:
- O tema é universal e abstracto (ex: Matemática, Física, Química, Filosofia geral, Literatura clássica)
- A menção seria artificial ou reduziria a qualidade académica do texto
- O autor não pediu explicitamente esse ângulo

INSTRUÇÃO DA TAREFA ACTUAL
==========================
Desenvolve APENAS o conteúdo interno da secção: "${currentSection.title}"

Instrução específica para esta secção:
${specificInstruction}
${antiClosingInstruction}

REGRAS DE ESCRITA — OBRIGATÓRIAS
================================
- Começa directamente pelo conteúdo académico
- NÃO incluas o título da secção no início
- Texto académico técnico em português europeu
- Mantém coerência terminológica com o contexto fornecido
- Usa a ficha de pesquisa como base factual — não inventes dados nem autores
- Usa citações APA no corpo do texto em todas as secções de desenvolvimento
- Usa Markdown (negrito, listas, ### para sub-títulos)
- Extensão: entre 300 e 600 palavras
- Não repitas conteúdo já presente no contexto histórico ou recente
- NÃO faças nova pesquisa — toda a informação está no contexto acima

PROIBIÇÕES ABSOLUTAS (excepto Conclusão e Referências)
=======================================================
❌ NÃO escrevas "Em conclusão", "Em suma", "Conclui-se que", "Por fim" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas no final desta secção
❌ NÃO cries cabeçalhos ## Conclusão, ## Referências, ### Considerações Finais
❌ NÃO fechas com parágrafo de encerramento — termina no último ponto de desenvolvimento
O trabalho tem secções próprias para Conclusão e Referências — não as antecipes aqui.`.trim();
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:develop', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  let sessionId: string | null = null;
  let sectionIndex: number | null = null;

  try {
    const payload = await req.json();
    sessionId = payload?.sessionId ?? null;
    sectionIndex = typeof payload?.sectionIndex === 'number' ? payload.sectionIndex : null;

    if (!sessionId || sectionIndex === null) {
      console.error('[api/tcc/develop] Payload inválido', {
        sessionId,
        sectionIndex,
        payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload as Record<string, unknown>) : [],
      });
      return NextResponse.json({ error: 'Payload inválido: sessionId e sectionIndex são obrigatórios' }, { status: 400 });
    }

    let session = await getSession(sessionId);
    if (!session) {
      console.error('[api/tcc/develop] Sessão não encontrada', { sessionId, sectionIndex });
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }
    if (!session.outline_approved) {
      console.error('[api/tcc/develop] Esboço não aprovado', { sessionId, sectionIndex });
      return NextResponse.json({ error: 'Esboço ainda não aprovado' }, { status: 400 });
    }

    const currentSection = session.sections.find(s => s.index === sectionIndex);
    if (!currentSection) {
      console.error('[api/tcc/develop] Secção não encontrada', {
        sessionId,
        sectionIndex,
        availableSectionIndexes: session.sections.map(s => s.index),
      });
      return NextResponse.json({ error: 'Secção não encontrada' }, { status: 404 });
    }

    session = await compressContextIfNeeded(session, sectionIndex);
    const optimised = buildOptimisedContext(session, sectionIndex);

    const systemPrompt = buildSystemPrompt(
      session.topic,
      optimised.outline,
      session.research_brief,
      optimised.contextSummary,
      optimised.recentSectionsContent,
      currentSection,
      optimised.compressionActive,
    );

    const response = await groqFetch((_key, _attempt) => ({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Desenvolve a secção "${currentSection.title}" do TCC. Escreve APENAS o conteúdo desta secção, sem conclusão nem lista de referências no final. Respeita rigorosamente os limites e instruções da secção.`,
        },
      ],
      stream: true,
      max_tokens: 2048,
      temperature: 0.5,
    }));

    let accumulated = '';
    const compressionWasActive = optimised.compressionActive;

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
          } catch {
            // ignorar chunks malformados
          }
        }

        controller.enqueue(chunk);
      },

      async flush() {
        if (sessionId && accumulated) {
          try {
            const cleaned = stripSpuriousBlocks(accumulated, currentSection.title);
            await saveSectionContent(sessionId, sectionIndex, cleaned, session.sections);
          } catch (e) {
            console.error('[api/tcc/develop] Erro ao guardar secção', {
              sessionId,
              sectionIndex,
              sectionTitle: currentSection.title,
              error: e,
            });
          }
        }
      },
    });

    return new NextResponse(response.body!.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Context-Compressed': compressionWasActive ? 'true' : 'false',
        'X-Summary-Covers-Up-To': String(session.summary_covers_up_to ?? -1),
      },
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('[api/tcc/develop] Erro inesperado', {
      sessionId,
      sectionIndex,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
