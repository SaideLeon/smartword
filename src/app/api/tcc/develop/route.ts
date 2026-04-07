// src/app/api/tcc/develop/route.ts

import { NextResponse } from 'next/server';
import { getSession, saveSectionContent } from '@/lib/tcc/service';
import { compressContextIfNeeded, buildOptimisedContext } from '@/lib/tcc/context-compressor';
import type { TccSection } from '@/lib/tcc/types';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';
import { geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { buildContextInstruction, type ContextType } from '@/lib/tcc/context-detector';
import { parseSessionPayload } from '@/lib/validation/input-guards';
import { wrapUserInput, PROMPT_INJECTION_GUARD } from '@/lib/prompt-sanitizer';

// ---------------------------------------------------------------------------
// Constantes de classificação de secções
// ---------------------------------------------------------------------------

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

const PRE_TEXTUAL_SECTION_KEYWORDS = [
  'introducao',
  'introdução',
  'resumo',
  'abstract',
  'dedicatoria',
  'dedicatória',
  'agradecimentos',
  'epigrafe',
  'epígrafe',
  'lista de abreviaturas',
  'lista de siglas',
  'lista de figuras',
  'lista de tabelas',
];

// Subsecções que pertencem à Introdução — devem ter extensão muito reduzida
// para evitar que a introdução acabe a ocupar 3–4 páginas.
const INTRO_SUBSECTION_KEYWORDS = [
  'contextualizacao',
  'contextualização',
  'contexto',
  'problema de pesquisa',
  'problema de investigacao',
  'problema de investigação',
  'justificativa',
  'justificacao',
  'justificação',
  'relevancia',
  'relevância',
  'delimitacao',
  'delimitação',
  'pergunta de investigacao',
  'pergunta de investigação',
  'hipotese',
  'hipótese',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function isPreTextualSection(normalizedName: string): boolean {
  return PRE_TEXTUAL_SECTION_KEYWORDS.some(k => normalizedName.includes(k));
}

function isIntroSubsection(title: string, normalizedName: string): boolean {
  // Detecta subsecções numéricas da introdução (1.1, 1.2, etc.)
  // combinadas com palavras-chave típicas de introdução.
  const isNumberedSubsection = /^1\.\d/.test(title.trim());
  const hasIntroKeyword = INTRO_SUBSECTION_KEYWORDS.some(k => normalizedName.includes(k));
  return isNumberedSubsection && hasIntroKeyword;
}

// ---------------------------------------------------------------------------
// Remoção de blocos espúrios (conclusões antecipadas, referências, etc.)
// ---------------------------------------------------------------------------

const SPURIOUS_HEADING_PATTERN =
  /^#{1,3}\s*(conclus[aã]o|consider[aã]es\s+finais|refere?ncias?(\s+bibliogr[aá]ficas?)?|bibliography|notas?\s+finais?|síntese|synthesis)\s*$/im;

const SPURIOUS_CLOSING_PHRASES =
  /\n+(em\s+(suma|conclus[aã]o|síntese)|portanto,\s+conclui-se|por\s+fim,\s+(pode|é\s+poss[ií]vel)|conclui-se\s+(assim|que|portanto)|desta\s+(forma|maneira|feita),\s+(conclui|verifica|observa)-se)[^]*/i;

const SPURIOUS_REFERENCE_BLOCK =
  /\n+(#{1,3}\s*refere?ncias?[^\n]*\n+)?([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^.\n]{2,60}\.\s*\(\d{4}\)[^\n]*\n){2,}[^]*/;

function stripSpuriousBlocks(content: string, sectionTitle: string): string {
  if (sectionAllowsClosing(sectionTitle)) return content;

  let cleaned = content;

  const headingMatch = SPURIOUS_HEADING_PATTERN.exec(cleaned);
  if (headingMatch?.index !== undefined) {
    cleaned = cleaned.slice(0, headingMatch.index).trimEnd();
  }

  cleaned = cleaned.replace(SPURIOUS_CLOSING_PHRASES, '').trimEnd();
  cleaned = cleaned.replace(SPURIOUS_REFERENCE_BLOCK, '').trimEnd();

  return cleaned;
}

// ---------------------------------------------------------------------------
// Instrução específica por secção
// ---------------------------------------------------------------------------

function getSectionInstruction(
  normalizedName: string,
  originalTitle: string,
  isSubsection: boolean,
): string {
  // ── Subsecções da Introdução ──────────────────────────────────────────────
  // A introdução deve ser sintética. Cada subsecção (1.1, 1.2...) é limitada
  // a 80–120 palavras para que a introdução total não ultrapasse 1 página.
  if (isIntroSubsection(originalTitle, normalizedName)) {
    const specificGuidance: Record<string, string> = {
      contextuali: 'Apresenta o tema com enquadramento geral. Sem estatísticas densas — estas pertencem ao desenvolvimento.',
      'problema de pesquisa': 'Delimita o problema de investigação de forma directa e clara. Uma ou duas frases de enquadramento teórico mínimo.',
      'problema de investigac': 'Delimita o problema de investigação de forma directa e clara.',
      justifica: 'Justifica brevemente a relevância do estudo. Sem aprofundamento — reserva-o para o desenvolvimento.',
      relevanc: 'Indica a relevância do tema de forma concisa. Não repitas a contextualização.',
    };

    const guidance = Object.entries(specificGuidance).find(([key]) =>
      normalizedName.includes(key),
    )?.[1] ?? 'Desenvolve este ponto introdutório de forma breve e coesa.';

    return `Esta é uma subsecção da Introdução. Regras estritas:
- MÁXIMO 120 palavras — qualquer extensão além disto é um erro
- Tom: geral, contextualizador, sem dados quantitativos precisos
- SEM exemplos práticos — pertencem ao Desenvolvimento
- SEM teoria aprofundada — pertence ao Desenvolvimento  
- SEM estatísticas detalhadas — pertencem ao Desenvolvimento
- Orientação específica: ${guidance}
- Termina de forma que o leitor queira avançar para o desenvolvimento`;
  }

  // ── Subsecções genéricas ──────────────────────────────────────────────────
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

  // ── Introdução principal ──────────────────────────────────────────────────
  if (normalizedName === 'introducao' || normalizedName === 'introducao') {
    return `Escreve uma introdução académica de nível universitário para TCC. Estrutura obrigatória em 3 parágrafos:

**§1 — Enquadramento geral (40–60 palavras)**
Situa o tema no debate académico mais amplo. Tom: geral e contextualizador.
SEM dados quantitativos precisos — esses pertencem ao desenvolvimento.

**§2 — Problema e objectivos (60–80 palavras)**
Delimita o problema de investigação e enuncia o objectivo geral.
Uma frase de enquadramento teórico mínimo é suficiente.

**§3 — Estrutura do trabalho (40–60 palavras)**
Descreve brevemente como o trabalho está organizado secção a secção.

Total: máximo 200 palavras. SEM exemplos práticos. SEM estatísticas detalhadas.
Directa e coesa — os detalhes pertencem ao desenvolvimento.`;
  }

  if (normalizedName === 'objectivos' || normalizedName === 'objetivos') {
    return `Escreve APENAS a secção de objectivos em formato técnico e directo.

Estrutura obrigatória:
**Objectivo Geral**
- Uma frase em infinitivo que explicite o propósito central do TCC

**Objectivos Específicos**
- Lista de 3 a 5 bullets, cada um com uma acção mensurável em infinitivo

Regras:
- Manter entre 150 e 300 palavras
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

// ---------------------------------------------------------------------------
// Construção do system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  topic: string,
  outline: string,
  researchBrief: string | null,
  contextSummary: string | null,
  recentSectionsContent: string,
  currentSection: TccSection,
  compressionActive: boolean,
  contextType: ContextType,
): string {
  const historicalContext = compressionActive && contextSummary
    ? `\n[CONTEXTO HISTÓRICO COMPRIMIDO]\n${wrapUserInput('user_context_summary', contextSummary)}\n`
    : '';

  const recentContext = recentSectionsContent
    ? `\n[SECÇÕES RECENTES COMPLETAS]\n${wrapUserInput('user_recent_sections', recentSectionsContent)}\n`
    : '';

  const contextNote = compressionActive
    ? `\n[NOTA DE COMPRESSÃO]\nAs secções mais antigas foram comprimidas para optimizar a janela de contexto. As secções recentes foram mantidas integralmente para preservar continuidade local.\n`
    : '';

  const researchContext = researchBrief
    ? `\n[FICHA DE PESQUISA]\n${wrapUserInput('user_research_brief', researchBrief)}\n`
    : '\n[FICHA DE PESQUISA]\n(não disponível)\n';

  const isSubsection   = /^\d+\.\d+/.test(currentSection.title);
  const normalizedName = normalizeTitle(currentSection.title);
  const specificInstruction = getSectionInstruction(
    normalizedName,
    currentSection.title,
    isSubsection,
  );

  const preTextualLimitInstruction = isPreTextualSection(normalizedName)
    ? `
LIMITE OBRIGATÓRIO DE EXTENSÃO PARA ELEMENTOS PRÉ-TEXTUAIS:
- Esta secção é pré-textual e NÃO pode ultrapassar 1 página equivalente.
- Mantém o texto coeso, objectivo e sintético, sem detalhamento extensivo.
- Evita aprofundamento analítico: reserva os detalhes para as secções de desenvolvimento.`
    : '';

  const antiClosingInstruction = !sectionAllowsClosing(currentSection.title)
    ? `
PROIBIÇÕES ABSOLUTAS PARA ESTA SECÇÃO:
❌ NÃO escrevas "Em conclusão", "Em suma", "Conclui-se que", "Por fim" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas no final desta secção
❌ NÃO cries cabeçalhos ## Conclusão, ## Referências, ### Considerações Finais
❌ NÃO fechas com parágrafo de encerramento — termina no último ponto de desenvolvimento
O trabalho tem secções próprias para Conclusão e Referências — não as antecipes aqui.`
    : '';

  // Instrução de contextualização geográfica calculada uma vez em /approve
  // e injectada aqui de forma consistente em todos os develops.
  const contextInstruction = buildContextInstruction(contextType);

  return `IDENTIDADE E PAPEL
==================
És um especialista académico para TCC de nível universitário.
Produzes texto técnico, rigoroso e cientificamente fundamentado, em português europeu.
A norma de referenciação é APA (7.ª edição) e deve ser respeitada em todo o trabalho.

${PROMPT_INJECTION_GUARD}

CONTEXTO DO PROJECTO (fornecido pelo sistema a cada chamada)
============================================================
[TÓPICO DO TCC]
${wrapUserInput('user_topic', topic)}

[ESBOÇO APROVADO]
${wrapUserInput('user_outline', outline)}
${historicalContext}${recentContext}${contextNote}${researchContext}

${contextInstruction}

INSTRUÇÃO DA TAREFA ACTUAL
==========================
Desenvolve APENAS o conteúdo interno da secção: "${currentSection.title}"

Instrução específica para esta secção:
${specificInstruction}
${preTextualLimitInstruction}
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

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'tcc:develop', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'tcc');
  if (planError) return planError;

  let sessionId: string | null = null;
  let sectionIndex: number | null = null;

  try {
    const payload = await req.json();
    const parsedPayload = parseSessionPayload(payload);

    if (!parsedPayload) {
      console.error('[api/tcc/develop] Payload inválido', {
        sessionId,
        sectionIndex,
        payloadKeys: payload && typeof payload === 'object'
          ? Object.keys(payload as Record<string, unknown>)
          : [],
      });
      return NextResponse.json(
        { error: 'Payload inválido: sessionId e sectionIndex são obrigatórios' },
        { status: 400 },
      );
    }

    sessionId = parsedPayload.sessionId;
    sectionIndex = parsedPayload.sectionIndex;

    const parsedSectionIndex = parsedPayload.sectionIndex;

    let session = await getSession(sessionId);
    if (!session) {
      console.error('[api/tcc/develop] Sessão não encontrada', { sessionId, sectionIndex });
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }
    if (!session.outline_approved) {
      console.error('[api/tcc/develop] Esboço não aprovado', { sessionId, sectionIndex });
      return NextResponse.json({ error: 'Esboço ainda não aprovado' }, { status: 400 });
    }

    const currentSection = session.sections.find(s => s.index === parsedSectionIndex);
    if (!currentSection) {
      console.error('[api/tcc/develop] Secção não encontrada', {
        sessionId,
        sectionIndex,
        availableSectionIndexes: session.sections.map(s => s.index),
      });
      return NextResponse.json({ error: 'Secção não encontrada' }, { status: 404 });
    }

    session = await compressContextIfNeeded(session, parsedSectionIndex);
    const optimised = buildOptimisedContext(session, parsedSectionIndex);

    // context_type persistido em approve; usa 'comparative' como fallback seguro
    // caso a sessão tenha sido criada antes desta migração.
    const contextType: ContextType = (session.context_type as ContextType) ?? 'comparative';

    const systemPrompt = buildSystemPrompt(
      session.topic,
      optimised.outline,
      session.research_brief,
      optimised.contextSummary,
      optimised.recentSectionsContent,
      currentSection,
      optimised.compressionActive,
      contextType,
    );

    const stream = await geminiGenerateTextStreamSSE({
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Desenvolve a secção "${currentSection.title}" do TCC. Escreve APENAS o conteúdo desta secção, sem conclusão nem lista de referências no final. Respeita rigorosamente os limites e instruções da secção.`,
        },
      ],
      maxOutputTokens: 2048,
      temperature: 0.5,
    });

    let accumulated = '';
    const compressionWasActive = optimised.compressionActive;

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text  = new TextDecoder().decode(chunk);
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const json  = JSON.parse(data);
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
            await saveSectionContent(sessionId, parsedSectionIndex, cleaned, session.sections);
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

    return new NextResponse(stream.pipeThrough(transformStream), {
      headers: {
        'Content-Type':              'text/event-stream',
        'Cache-Control':             'no-cache',
        'Connection':                'keep-alive',
        'X-Context-Compressed':      compressionWasActive ? 'true' : 'false',
        'X-Summary-Covers-Up-To':    String(session.summary_covers_up_to ?? -1),
        'X-Context-Type':            contextType,
      },
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('[api/tcc/develop] Erro inesperado', {
      sessionId,
      sectionIndex,
      message: error.message,
      stack:   error.stack,
      cause:   error.cause,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
