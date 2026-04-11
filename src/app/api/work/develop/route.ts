// app/api/work/develop/route.ts
// A responsabilidade de inserir {pagebreak} pertence EXCLUSIVAMENTE ao cliente (WorkPanel.tsx).
// O servidor devolve conteúdo puro, sem marcadores estruturais.

import { NextResponse } from 'next/server';
import { getWorkSession, saveWorkResearchBrief, saveWorkSectionContent } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';
import { geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { generateResearchBrief } from '@/lib/research/brief';
import { parseSessionPayload } from '@/lib/validation/input-guards';
import { wrapUserInput, PROMPT_INJECTION_GUARD } from '@/lib/prompt-sanitizer';
import { semanticSearch, generateRagFicha } from '@/lib/work/rag-service';

// ── Normalização de título (remove prefixos numéricos/romanos) ────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[ivxlcdm]+\.\s*/i, '')  // remove I., II., III.
    .replace(/^\d+(\.\d+)?\.\s*/, '')   // remove 1., 1.1.
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
  if (!norm.includes('objectivo') && !norm.includes('objetivo') && !norm.includes('metodologia')) {
    return content;
  }
  let cleaned = content;
  for (const pattern of UNIVERSITY_LANGUAGE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trimEnd();
}

function stripSpuriousBlocks(content: string, sectionTitle: string): string {
  if (sectionAllowsClosing(sectionTitle)) return content;

  let cleaned = content;

  const headingMatch = SPURIOUS_HEADING_PATTERN.exec(cleaned);
  if (headingMatch && headingMatch.index !== undefined) {
    cleaned = cleaned.slice(0, headingMatch.index).trimEnd();
  }

  cleaned = cleaned.replace(SPURIOUS_CLOSING_PHRASES, '').trimEnd();
  cleaned = cleaned.replace(SPURIOUS_REFERENCE_BLOCK, '').trimEnd();
  cleaned = stripUniversityLanguage(cleaned, sectionTitle);

  return cleaned;
}

// ── Instruções específicas por secção ────────────────────────────────────────

function getSectionInstruction(normalizedName: string, isSubsection: boolean): string {
  if (isSubsection) {
    return `Desenvolve este subtópico de forma clara e didáctica para alunos do ensino secundário. Deve:
- Apresentar o conceito com uma definição simples e acessível
- Incluir pelo menos 1 exemplo prático quando isso ajudar a compreensão
- Ter entre 200 e 350 palavras
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
1 frase que resume o propósito do trabalho (começa com infinitivo: "Analisar...", "Compreender...", "Identificar...") não incluir citação de autor 

**Objectivos Específicos**
Lista de 3 a 4 bullets curtos, cada um com 1 frase simples no infinitivo. 
Não incluir citação de autor 
PROIBIÇÕES ABSOLUTAS:
❌ NÃO escrevas nada sobre metodologia aqui
❌ NÃO uses referências nem citações — objectivos não as requerem
❌ NÃO cries sub-secções desnecessárias
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
❌ NÃO uses termos excessivamente universitários sem explicação
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
- Incluir: livros didácticos, artigos académicos, sites educativos ou institucionais
- NÃO usar referências inventadas — usa apenas formatos APA correctos com dados plausíveis`;
  }

  // Fallback genérico
  return `Desenvolve o conteúdo de forma académica adequada ao ensino secundário, entre 220 e 350 palavras. NÃO incluas conclusão nem referências no final.`;
}

// ── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'work:develop', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'create_work');
  if (planError) return planError;

  try {
    const parsedPayload = parseSessionPayload(await req.json());
    if (!parsedPayload) {
      return NextResponse.json({ error: 'Payload inválido: sessionId e sectionIndex são obrigatórios' }, { status: 400 });
    }

    const { sessionId, sectionIndex } = parsedPayload;

    const session = await getWorkSession(sessionId);
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });

    const outline = session.outline_approved ?? session.outline_draft;
    if (!outline) return NextResponse.json({ error: 'Esboço ainda não disponível' }, { status: 400 });

    const section = session.sections.find(current => current.index === sectionIndex);
    if (!section) return NextResponse.json({ error: 'Secção não encontrada' }, { status: 404 });

    if (!session.research_brief) {
      const research = await generateResearchBrief(session.topic, outline);
      await saveWorkResearchBrief(session.id, research.keywords, research.brief);
      session.research_keywords = research.keywords;
      session.research_brief = research.brief;
      session.research_generated_at = new Date().toISOString();
    }

    const previousSections = session.sections
      .filter(current => current.index < sectionIndex && current.content)
      .map(current => ({ title: current.title, content: current.content }));

    const previousContext = previousSections.length > 0
      ? `\n[SECÇÕES ANTERIORES]\n${wrapUserInput(
          'user_previous_sections',
          previousSections.map(current =>
            `### ${current.title}\n${current.content.slice(0, 400)}${current.content.length > 400 ? '…' : ''}`
          ).join('\n\n'),
        )}\n`
      : '\n[SECÇÕES ANTERIORES]\n(nenhuma secção anterior disponível)\n';

    const researchContext = session.research_brief
      ? `\n[FICHA DE PESQUISA]\n${wrapUserInput('user_research_brief', session.research_brief)}\n`
      : '\n[FICHA DE PESQUISA]\n(não disponível)\n';

    let ragContext = '';
    if (session.rag_enabled) {
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
          .map((c, i) => `[Excerto ${i + 1}]\n${c.chunk_text}`)
          .join('\n\n---\n\n');

        ragContext = `\n[BASE DE CONHECIMENTO — DOCUMENTOS CARREGADOS]\n${fichaTxt}\nEXCERTOS RELEVANTES PARA ESTA SECÇÃO:\n${chunksTxt}\n\nINSTRUÇÕES:\n- Baseia os argumentos desta secção nos excertos acima\n- Cita os autores reais da ficha técnica (formato APA 7.ª)\n- Não inventes referências nem autores — usa APENAS os listados\n- Se houver normas institucionais, respeita a estrutura e linguagem prescritas\n`;
      }
    }

    const fullContext = researchContext + ragContext;

    const isSubsection = /^\d+\.\d+/.test(section.title);
    const normalizedName = normalizeTitle(section.title);
    const specificInstruction = getSectionInstruction(normalizedName, isSubsection);

    const antiClosingInstruction = !sectionAllowsClosing(section.title)
      ? `
PROIBIÇÕES ABSOLUTAS PARA ESTA SECÇÃO:
❌ NÃO escrevas "Em conclusão", "Em suma", "Conclui-se que", "Por fim, conclui-se" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas no final
❌ NÃO escrevas cabeçalhos como "## Conclusão", "## Referências", "### Considerações Finais"
❌ NÃO fechas com parágrafo de encerramento — termina no último ponto de conteúdo
O trabalho tem secções próprias para isso — NÃO as antecipes aqui.`
      : '';

    const systemPrompt = `IDENTIDADE E PAPEL
==================
${PROMPT_INJECTION_GUARD}

És um redactor académico especializado em trabalhos escolares do ensino secundário e médio.
O teu trabalho é produzir conteúdo académico rigoroso, claro e adequado ao nível etário dos alunos (14–18 anos).

Escreves sempre em português europeu com normas ortográficas moçambicanas quando aplicável.
A norma de referenciação é APA (7.ª edição) em todo o trabalho.

CONTEXTO DO PROJECTO (fornecido pelo sistema a cada chamada)
============================================================
[TÓPICO DO TRABALHO]
${wrapUserInput('user_topic', session.topic)}

[ESBOÇO ORIENTADOR]
${wrapUserInput('user_outline', outline)}
${previousContext}
${fullContext}

REGRAS DE ADEQUAÇÃO AO CONTEXTO MOÇAMBICANO
===========================================
O trabalho é produzido em Moçambique para alunos moçambicanos. Isto NÃO significa que todos os trabalhos devem mencionar Moçambique explicitamente.

Aplica contexto moçambicano APENAS quando:
- O tema é de natureza social, económica, histórica, geográfica ou cívica
- O exemplo moçambicano clarifica o conceito melhor do que um exemplo genérico
- O esboço ou a ficha de pesquisa já referenciam dados ou contexto moçambicano

NÃO forces contexto moçambicano quando:
- O tema é universal e abstracto (ex: Matemática, Física, Química, Filosofia geral, Literatura clássica)
- A menção seria artificial ou reduziria a qualidade académica do texto
- O aluno não pediu explicitamente esse ângulo

INSTRUÇÃO DA TAREFA ACTUAL
==========================
Desenvolve APENAS a secção: "${section.title}"

Instrução específica para esta secção:
${specificInstruction}
${antiClosingInstruction}

REGRAS DE ESCRITA — OBRIGATÓRIAS
=================================
- Começa directamente pelo conteúdo — sem "Nesta secção…", "Vou desenvolver…"
- NÃO incluas o título da secção no início — é inserido automaticamente
- NÃO incluas marcadores {pagebreak} ou {section} — são inseridos automaticamente
- Usa Markdown: negrito para termos-chave, ### para sub-títulos, listas quando a estrutura do conteúdo o justifica
- Mantém coerência terminológica com as secções anteriores fornecidas acima
- Usa a ficha de pesquisa como base factual — não inventes dados, estatísticas nem autores
- NÃO faças nova pesquisa — toda a informação necessária está no contexto acima
- Tom académico claro e acessível ao nível do ensino secundário/médio

PROIBIÇÕES ABSOLUTAS (excepto Conclusão e Referências)
=======================================================
❌ NÃO escrevas "Em conclusão", "Em suma", "Conclui-se que", "Por fim" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas no final desta secção
❌ NÃO cries cabeçalhos ## Conclusão, ## Referências, ### Considerações Finais
❌ NÃO fechas com parágrafo de encerramento — termina no último ponto de conteúdo
O trabalho tem secções próprias para Conclusão e Referências — não as antecipes aqui.`.trim();

    const stream = await geminiGenerateTextStreamSSE({
      model: 'gemini-3.1-flash-lite-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Desenvolve a secção "${section.title}". Escreve APENAS o conteúdo desta secção — sem conclusão, sem lista de referências no final, sem frases de encerramento, sem marcadores de pagebreak. Respeita rigorosamente o limite de palavras indicado.`,
        },
      ],
      maxOutputTokens: 1500,
      temperature: 0.5,
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
            const cleaned = stripSpuriousBlocks(accumulated, section.title);
            await saveWorkSectionContent(sessionId, sectionIndex, cleaned, session.sections);
          } catch (e) {
            console.error('Erro ao guardar secção do trabalho:', e);
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
