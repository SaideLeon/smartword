// app/api/work/develop/route.ts
// A responsabilidade de inserir {pagebreak} pertence EXCLUSIVAMENTE ao cliente (WorkPanel.tsx).
// O servidor devolve conteúdo puro, sem marcadores estruturais.
//
// ── ARQUITECTURA ADAPTATIVA ──────────────────────────────────────────────────
//
// COM documentos RAG carregados → arquitectura de 2 passes:
//   PASS 1: rascunho rápido ~300 palavras via geminiGenerateText
//   AGENTE REVISOR: 10 perguntas → busca RAG → matriz de conhecimento
//   PASS 2 (stream): refinamento com enrichedContext como base obrigatória
//
// SEM documentos RAG → passe único directo:
//   PASS 2 (stream): geração directa com conhecimento nativo do modelo
//   (sem RAG, sem revisor, sem embeddings desnecessários)
//
// SSE custom events emitidos antes do streaming (apenas com RAG activo):
//   {"type":"phase","phase":"reviewing","questionCount":10}
//   {"type":"phase","phase":"refining","sourceCount":N,"usedWeb":bool,"ragCount":N}

import { NextResponse } from 'next/server';
import { getWorkSession, saveWorkResearchBrief, saveWorkSectionContent } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';
import { geminiGenerateText, geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { generateResearchBrief } from '@/lib/research/brief';
import { parseSessionPayload } from '@/lib/validation/input-guards';
import { wrapUserInput, PROMPT_INJECTION_GUARD } from '@/lib/prompt-sanitizer';
import { semanticSearch, generateRagFicha } from '@/lib/work/rag-service';
import { runSectionReviewer, type ReviewerResult } from '@/lib/work/section-reviewer';

// ── Normalização de título (remove prefixos numéricos/romanos) ────────────────

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

// ── Secções que permitem conteúdo de fecho ────────────────────────────────────

const CLOSING_SECTION_NAMES = new Set([
  'conclusao',
  'conclusion',
  'referencias',
  'referencias bibliograficas',
  'bibliography',
]);

function sectionAllowsClosing(title: string): boolean {
  return CLOSING_SECTION_NAMES.has(normalizeTitle(title));
}

// ── Filtro pós-processamento ──────────────────────────────────────────────────

const SPURIOUS_HEADING_PATTERN = /^#{1,3}\s*(conclus[aã]o|consider[aã]es\s+finais|refere?ncias?(\s+bibliogr[aá]ficas?)?|bibliography|notas?\s+finais?|síntese)\s*$/im;
const SPURIOUS_CLOSING_PHRASES = /\n+(em\s+(suma|conclus[aã]o|síntese)|portanto,\s+conclui-se|por\s+fim,\s+(pode|é\s+poss[ií]vel)|conclui-se\s+(assim|que|portanto)|desta\s+(forma|maneira|feita),\s+(conclui|verifica|observa)-se)[^]*/i;
const SPURIOUS_REFERENCE_BLOCK = /\n+(#{1,3}\s*refere?ncias?[^\n]*\n+)?([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^.\n]{2,60}\.\s*\(\d{4}\)[^\n]*\n){2,}[^]*/;
const UNIVERSITY_LANGUAGE_PATTERNS = [
  /\n*#{1,3}\s*(abordagem\s+de\s+investiga[cç][aã]o|crit[eé]rios\s+de\s+avalia[cç][aã]o|procedimentos?\s+operacionais?|revis[aã]o\s+bibliogr[aá]fica|an[aá]lise\s+de\s+casos?\s+reais?|coer[eê]ncia\s+metodol[oó]gica)[^\n]*\n[^]*/gi,
];

function stripUniversityLanguage(content: string, sectionTitle: string): string {
  const norm = normalizeTitle(sectionTitle);
  if (!norm.includes('objectivo') && !norm.includes('objetivo') && !norm.includes('metodologia')) return content;
  let cleaned = content;
  for (const pattern of UNIVERSITY_LANGUAGE_PATTERNS) cleaned = cleaned.replace(pattern, '');
  return cleaned.trimEnd();
}

function stripSpuriousBlocks(content: string, sectionTitle: string): string {
  if (sectionAllowsClosing(sectionTitle)) return content;
  let cleaned = content;
  const headingMatch = SPURIOUS_HEADING_PATTERN.exec(cleaned);
  if (headingMatch?.index !== undefined) cleaned = cleaned.slice(0, headingMatch.index).trimEnd();
  cleaned = cleaned.replace(SPURIOUS_CLOSING_PHRASES, '').trimEnd();
  cleaned = cleaned.replace(SPURIOUS_REFERENCE_BLOCK, '').trimEnd();
  return stripUniversityLanguage(cleaned, sectionTitle);
}

// ── Instruções específicas por secção ────────────────────────────────────────

function getSectionInstruction(normalizedName: string, isSubsection: boolean): string {
  if (isSubsection) {
    return `Desenvolve este subtópico de forma clara e didáctica para alunos do ensino secundário. Deve:
- Apresentar o conceito com uma definição simples e acessível
- Incluir pelo menos 1 exemplo prático quando isso ajudar a compreensão
- Ter entre 220 e 380 palavras
- Usar Markdown (negrito para termos importantes, listas quando adequado)
- NÃO repetir conteúdo já presente nas secções anteriores
- NÃO incluir conclusão nem lista de referências no final`;
  }
  if (normalizedName === 'introducao') {
    return `Escreve uma introdução académica simples para um trabalho do ensino secundário/médio. Deve:
- Contextualizar o tema de forma acessível (o que é e porquê é importante)
- Apresentar o problema de pesquisa em 1-2 frases
- Referir os objectivos gerais do trabalho
- Descrever brevemente a estrutura do trabalho (as secções que existem)
- Ter entre 280 e 480 palavras — NÃO ultrapasses este limite
- NÃO desenvolver conceitos teóricos — isso é para o Desenvolvimento
- NÃO incluir conclusão nem referências no final`;
  }
  if (normalizedName === 'objectivos' || normalizedName === 'objetivos') {
    return `Escreve APENAS os objectivos do trabalho, de forma SIMPLES e CONCISA para o ensino secundário/médio.

Estrutura OBRIGATÓRIA:
**Objectivo Geral**
1 frase que resume o propósito do trabalho (começa com infinitivo: "Analisar...", "Compreender...", "Identificar...")

**Objectivos Específicos**
Lista de 3 a 4 bullets curtos, cada um com 1 frase simples no infinitivo.
PROIBIÇÕES ABSOLUTAS:
❌ NÃO escrevas nada sobre metodologia aqui
❌ NÃO uses referências nem citações
❌ NÃO ultrapasses 100 palavras no total
❌ NÃO incluas conclusão nem referências no final`;
  }
  if (normalizedName === 'metodologia') {
    return `Escreve APENAS a metodologia do trabalho, de forma APROFUNDADA mas acessível ao ensino secundário/médio.

Estrutura OBRIGATÓRIA (3 a 4 parágrafos curtos):
1. **Natureza da pesquisa** — indica se é qualitativa, bibliográfica, documental, etc. e justifica brevemente
2. **Método de análise** — descreve o método usado (histórico, comparativo, descritivo, qualitativo, etc.)
3. **Fontes e critérios de selecção** — que tipo de fontes foram consultadas e por que razão
4. **Organização dos dados** — como a informação foi tratada e apresentada (ex: tematicamente, segundo APA 7.ª edição)

PROIBIÇÕES ABSOLUTAS:
❌ NÃO escrevas objectivos aqui
❌ NÃO ultrapasses 150 palavras no total
❌ NÃO incluas conclusão nem referências no final`;
  }
  if (normalizedName === 'conclusao' || normalizedName === 'conclusão') {
    return `Escreve uma conclusão consistente e académica. Deve:
- Retomar os pontos mais importantes desenvolvidos no trabalho (1 parágrafo)
- Responder ao problema de pesquisa apresentado na introdução
- Apresentar a relevância do tema e o que o trabalho contribuiu
- Incluir reflexão crítica ou opinião fundamentada do aluno
- Ter entre 220 e 320 palavras — NÃO ultrapasses este limite
- Usar linguagem clara: "Conclui-se que...", "O presente trabalho demonstrou..."
- NÃO introduzir informação nova`;
  }
  if (normalizedName.includes('referencia') || normalizedName.includes('bibliografia')) {
    return `Lista as referências bibliográficas em formato APA (7.ª edição). Deve:
- Incluir no mínimo 4 referências relevantes e credíveis para o tema
- Ordenar alfabeticamente pelo apelido do primeiro autor
- Apresentar cada referência numa linha separada
- Incluir: livros didácticos, artigos académicos, sites educativos ou institucionais`;
  }
  return `Desenvolve o conteúdo de forma académica adequada ao ensino secundário, entre 220 e 380 palavras. NÃO incluas conclusão nem referências no final.`;
}

// ── Prompt do rascunho rápido (Pass 1 — apenas com RAG activo) ────────────────

function buildDraftPrompt(
  sectionTitle: string,
  topic: string,
  outline: string,
  specificInstruction: string,
): string {
  return `${PROMPT_INJECTION_GUARD}

És um redactor académico do ensino secundário moçambicano. Gera um RASCUNHO INICIAL da secção "${sectionTitle}" para um trabalho sobre ${wrapUserInput('user_topic', topic)}.

Esboço orientador:
${wrapUserInput('user_outline', outline.slice(0, 700))}

Instrução desta secção:
${specificInstruction}

REGRAS DO RASCUNHO:
- Entre 180 e 350 palavras — rascunho inicial, não definitivo
- Estrutura clara e coerente
- Cobre os pontos principais da secção
- Português europeu
- Usa Markdown básico
- NÃO incluas conclusão nem referências bibliográficas no final`;
}

// ── Prompt do refinamento / geração directa (Pass 2) ─────────────────────────

function buildRefinedSystemPrompt(params: {
  topic: string;
  outline: string;
  sectionTitle: string;
  specificInstruction: string;
  previousContext: string;
  researchBrief: string | null;
  ragContext: string;
  enrichedContext: string;
}): string {
  const {
    topic, outline, sectionTitle, specificInstruction,
    previousContext, researchBrief, ragContext, enrichedContext,
  } = params;

  const researchBlock = researchBrief
    ? `\n[FICHA DE PESQUISA]\n${wrapUserInput('user_research_brief', researchBrief)}\n`
    : '';

  const enrichedBlock = enrichedContext
    ? `\n[CONHECIMENTO RECUPERADO — PRIORIDADE MÁXIMA]\n${wrapUserInput('user_enriched_context', enrichedContext)}\n`
    : '';

  const ragBlock = ragContext
    ? `\n[BASE DE CONHECIMENTO MULTIMODAL — DOCUMENTOS CARREGADOS]\n${wrapUserInput('user_rag_context', ragContext)}\n`
    : '';

  const antiClosingInstruction = !sectionAllowsClosing(sectionTitle)
    ? `
PROIBIÇÕES ABSOLUTAS PARA ESTA SECÇÃO:
❌ NÃO escrevas "Em conclusão", "Em suma", "Conclui-se que", "Por fim, conclui-se" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas no final
❌ NÃO escrevas cabeçalhos como "## Conclusão", "## Referências", "### Considerações Finais"
❌ NÃO fechas com parágrafo de encerramento — termina no último ponto de conteúdo`
    : '';

  return `IDENTIDADE E PAPEL
==================
${PROMPT_INJECTION_GUARD}

És um redactor académico especializado em trabalhos escolares do ensino secundário e médio.
Escreves sempre em português europeu com normas ortográficas moçambicanas quando aplicável.
A norma de referenciação é APA (7.ª edição) em todo o trabalho.

${enrichedBlock}

CONTEXTO DO PROJECTO
====================
[TÓPICO DO TRABALHO]
${wrapUserInput('user_topic', topic)}

[ESBOÇO ORIENTADOR]
${wrapUserInput('user_outline', outline)}
${previousContext}
${researchBlock}
${ragBlock}

REGRAS DE ADEQUAÇÃO AO CONTEXTO MOÇAMBICANO
===========================================
O trabalho é produzido em Moçambique. Aplica contexto moçambicano APENAS quando o tema for social, económico, histórico ou geográfico, e quando isso enriqueça o argumento. NÃO forces contexto geográfico em temas universais (matemática, física, química, filosofia geral).

INSTRUÇÃO DA TAREFA ACTUAL
==========================
Desenvolve APENAS a secção: "${sectionTitle}"

${specificInstruction}
${antiClosingInstruction}

REGRAS DE ESCRITA — OBRIGATÓRIAS
=================================
- Começa directamente pelo conteúdo — sem "Nesta secção…", "Vou desenvolver…"
- NÃO incluas o título da secção no início — é inserido automaticamente
- Usa Markdown: negrito para termos-chave, ### para sub-títulos, listas quando adequado
- Mantém coerência terminológica com as secções anteriores
- Se existir contexto enriquecido acima, integra-o com citações APA no corpo do texto
- Tom académico claro e acessível ao nível do ensino secundário/médio`.trim();
}

// ── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'work:develop', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'create_work', req);
  if (planError) return planError;

  try {
    const parsedPayload = parseSessionPayload(await req.json());
    if (!parsedPayload) {
      return NextResponse.json(
        { error: 'Payload inválido: sessionId e sectionIndex são obrigatórios' },
        { status: 400 },
      );
    }

    const { sessionId, sectionIndex } = parsedPayload;

    const session = await getWorkSession(sessionId);
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });

    const outline = session.outline_approved ?? session.outline_draft;
    if (!outline) return NextResponse.json({ error: 'Esboço ainda não disponível' }, { status: 400 });

    const section = session.sections.find(s => s.index === sectionIndex);
    if (!section) return NextResponse.json({ error: 'Secção não encontrada' }, { status: 404 });

    // ── Determinar modo de operação ────────────────────────────────────────
    // Se não há documentos RAG carregados, salta toda a pipeline de embeddings
    // e agente revisor — usa directamente o conhecimento nativo do modelo.
    const hasRagDocuments = !!session.rag_enabled;

    // ── Garantir ficha de pesquisa (apenas sem RAG; com RAG, o revisor trata disto) ──
    if (!hasRagDocuments && !session.research_brief) {
      try {
        const research = await generateResearchBrief(session.topic, outline);
        await saveWorkResearchBrief(session.id, research.keywords, research.brief);
        session.research_keywords = research.keywords;
        session.research_brief = research.brief;
        session.research_generated_at = new Date().toISOString();
      } catch (researchError) {
        // Não bloqueia a geração — continua sem ficha de pesquisa.
        console.warn('[work/develop] Falha ao gerar ficha de pesquisa (sem RAG):', researchError);
      }
    }

    // ── Contexto das secções anteriores ───────────────────────────────────

    const previousSections = session.sections
      .filter(s => s.index < sectionIndex && s.content)
      .map(s => ({ title: s.title, content: s.content }));

    const previousContext =
      previousSections.length > 0
        ? `\n[SECÇÕES ANTERIORES]\n${wrapUserInput(
            'user_previous_sections',
            previousSections
              .map(s => `### ${s.title}\n${s.content.slice(0, 400)}${s.content.length > 400 ? '…' : ''}`)
              .join('\n\n'),
          )}\n`
        : '\n[SECÇÕES ANTERIORES]\n(nenhuma secção anterior disponível)\n';

    // ── Contexto RAG multimodal (apenas se há documentos carregados) ──────

    let ragContext = '';

    if (hasRagDocuments) {
      // Garantir ficha RAG
      if (!session.rag_ficha) {
        const supabase = await (await import('@/lib/supabase')).createClient();
        const ficha = await generateRagFicha(session.id, session.topic);
        await supabase
          .from('work_sessions')
          .update({ rag_ficha: ficha })
          .eq('id', session.id)
          .eq('user_id', user.id);
        session.rag_ficha = ficha;
      }

      const sectionQuery = `${section.title} ${session.topic}`;
      const ragChunks = await semanticSearch(session.id, sectionQuery, 8);

      if (ragChunks.length > 0) {
        const ficha = session.rag_ficha as any;
        const fichaTxt = ficha
          ? `FICHA TÉCNICA:\nAutores: ${ficha.autores?.join('; ') ?? ''}\nObras: ${ficha.obras?.join('; ') ?? ''}\nConceitos: ${ficha.conceitos_chave?.join(', ') ?? ''}\n`
          : '';
        const chunksTxt = ragChunks
          .map((c, i) => {
            const icon =
              c.metadata?.modal_type === 'image'
                ? '[FIGURA]'
                : c.metadata?.modal_type === 'pdf_visual'
                  ? '[PDF VISUAL]'
                  : c.metadata?.modal_type === 'audio'
                    ? '[ÁUDIO]'
                    : '[TEXTO]';
            return `${icon} Excerto ${i + 1}:\n${c.chunk_text}`;
          })
          .join('\n\n---\n\n');

        ragContext = `${fichaTxt}\nEXCERTOS RELEVANTES:\n${chunksTxt}\n\nINSTRUÇÕES:\n- Baseia os argumentos nos excertos acima\n- [FIGURA] e [PDF VISUAL] indicam conteúdo extraído visualmente\n- [ÁUDIO] indica conteúdo de gravação\n- Cita os autores reais da ficha técnica (APA 7.ª)\n- Não inventes referências — usa APENAS as listadas\n`;
      }
    }

    // ── Preparação do prompt ───────────────────────────────────────────────

    const isSubsection = /^\d+\.\d+/.test(section.title);
    const normalizedName = normalizeTitle(section.title);
    const specificInstruction = getSectionInstruction(normalizedName, isSubsection);

    const encoder = new TextEncoder();

    // ── Stream orquestrado ─────────────────────────────────────────────────

    const orchestratedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let enrichedContext = '';

          if (hasRagDocuments) {
            // ── PASS 1: Rascunho rápido (apenas com RAG activo) ─────────────
            const draft = await geminiGenerateText({
              model: 'gemini-3.1-flash-lite-preview',
              messages: [
                {
                  role: 'system',
                  content: buildDraftPrompt(
                    section.title,
                    session.topic,
                    outline,
                    specificInstruction,
                  ),
                },
                {
                  role: 'user',
                  content: `Gera o rascunho inicial da secção "${section.title}".`,
                },
              ],
              maxOutputTokens: 700,
              temperature: 0.5,
            });

            // ── Anunciar fase: revisão ──────────────────────────────────────
            const reviewingEvt = JSON.stringify({
              type: 'phase',
              phase: 'reviewing',
              questionCount: 10,
            });
            controller.enqueue(encoder.encode(`data: ${reviewingEvt}\n\n`));

            // ── AGENTE REVISOR (apenas com RAG activo) ──────────────────────
            let reviewResult: ReviewerResult = {
              knowledgeMatrix: [],
              enrichedContext: '',
              sourceCount: 0,
              usedWeb: false,
              ragCount: 0,
              questionCount: 0,
            };

            try {
              reviewResult = await runSectionReviewer({
                draft,
                sectionTitle: section.title,
                topic: session.topic,
                sessionId: session.id,
                ragEnabled: true,
                researchBrief: session.research_brief,
              });
            } catch (reviewErr) {
              console.error('[work/develop] Agente revisor falhou — continuando sem enriquecimento:', reviewErr);
            }

            enrichedContext = reviewResult.enrichedContext;

            // ── Anunciar fase: refinamento ──────────────────────────────────
            const refiningEvt = JSON.stringify({
              type: 'phase',
              phase: 'refining',
              sourceCount: reviewResult.sourceCount,
              usedWeb: reviewResult.usedWeb,
              ragCount: reviewResult.ragCount,
            });
            controller.enqueue(encoder.encode(`data: ${refiningEvt}\n\n`));
          }
          // Sem RAG: salta Pass 1 e revisor inteiramente —
          // vai directamente para o Pass 2 com conhecimento nativo do modelo.

          // ── PASS 2: Geração final (streaming) ─────────────────────────────
          const refinedSystemPrompt = buildRefinedSystemPrompt({
            topic: session.topic,
            outline,
            sectionTitle: section.title,
            specificInstruction,
            previousContext,
            researchBrief: session.research_brief,
            ragContext,
            enrichedContext,
          });

          const refinedStream = await geminiGenerateTextStreamSSE({
            model: 'gemini-3.1-flash-lite-preview',
            messages: [
              { role: 'system', content: refinedSystemPrompt },
              {
                role: 'user',
                content: `Desenvolve a secção "${section.title}" com máximo rigor académico. ${enrichedContext ? 'Integra os achados das fontes fornecidas no sistema.' : ''} Escreve APENAS o conteúdo desta secção, sem conclusão, sem referências no final.`,
              },
            ],
            maxOutputTokens: 1800,
            temperature: 0.4,
          });

          const reader = refinedStream.getReader();
          let accumulated = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            for (const line of text.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content ?? '';
                if (delta) accumulated += delta;
              } catch { /* ignorar */ }
            }

            controller.enqueue(value);
          }

          // ── Guardar conteúdo gerado ───────────────────────────────────────
          if (accumulated) {
            const cleaned = stripSpuriousBlocks(accumulated, section.title);
            await saveWorkSectionContent(sessionId, sectionIndex, cleaned, session.sections);
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (streamError) {
          console.error('[work/develop] Erro no stream orquestrado:', streamError);
          controller.error(streamError);
        }
      },
    });

    return new NextResponse(orchestratedStream, {
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
