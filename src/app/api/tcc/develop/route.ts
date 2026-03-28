// app/api/tcc/develop/route.ts  (versão corrigida — filtro anti-conclusão + prompt reforçado)

import { NextResponse } from 'next/server';
import { getSession, saveSectionContent } from '@/lib/tcc/service';
import { compressContextIfNeeded, buildOptimisedContext } from '@/lib/tcc/context-compressor';
import type { TccSection } from '@/lib/tcc/types';
import { enforceRateLimit } from '@/lib/rate-limit';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

// ── Secções que NUNCA devem ter conclusão/referências geradas pela IA ─────────
// (basicamente todas excepto as próprias secções de Conclusão e Referências)

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

// ── Filtro pós-processamento: remove blocos espúrios ─────────────────────────
//
// Padrões que indicam que a IA gerou conclusão/referências indevidamente:
//   - Cabeçalhos ## ou ### com palavras como "Conclusão", "Referências", etc.
//   - Blocos de "Em suma,", "Em conclusão,", "Por fim," no final do texto
//   - Listas de referências bibliográficas (linhas iniciadas por autor + ano)

const SPURIOUS_HEADING_PATTERN = /^#{1,3}\s*(conclus[aã]o|consider[aã]es\s+finais|refere?ncias?(\s+bibliogr[aá]ficas?)?|bibliography|notas?\s+finais?|síntese|synthesis)\s*$/im;

const SPURIOUS_CLOSING_PHRASES = /\n+(em\s+(suma|conclus[aã]o|síntese)|portanto,\s+conclui-se|por\s+fim,\s+(pode|é\s+poss[ií]vel)|conclui-se\s+(assim|que|portanto)|desta\s+(forma|maneira|feita),\s+(conclui|verifica|observa)-se)[^]*/i;

// Detecta blocos de referências bibliográficas: 3+ linhas consecutivas no formato "Autor (ano)"
const SPURIOUS_REFERENCE_BLOCK = /\n+(#{1,3}\s*refere?ncias?[^\n]*\n+)?([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^.\n]{2,60}\.\s*\(\d{4}\)[^\n]*\n){2,}[^]*/;

function stripSpuriousBlocks(content: string, sectionTitle: string): string {
  if (sectionAllowsClosing(sectionTitle)) return content;

  let cleaned = content;

  // 1. Remove desde o primeiro cabeçalho espúrio até ao fim
  const headingMatch = SPURIOUS_HEADING_PATTERN.exec(cleaned);
  if (headingMatch && headingMatch.index !== undefined) {
    cleaned = cleaned.slice(0, headingMatch.index).trimEnd();
  }

  // 2. Remove frases de conclusão no final
  cleaned = cleaned.replace(SPURIOUS_CLOSING_PHRASES, '').trimEnd();

  // 3. Remove blocos de referências bibliográficas
  cleaned = cleaned.replace(SPURIOUS_REFERENCE_BLOCK, '').trimEnd();

  return cleaned;
}

// ── System prompt com contexto optimizado ────────────────────────────────────

function buildSystemPrompt(
  topic:          string,
  outline:        string,
  researchBrief:  string | null,
  contextSummary: string | null,
  recentSectionsContent: string,
  currentSection: TccSection,
  compressionActive: boolean,
): string {

  const historicalContext = compressionActive && contextSummary
    ? `CONTEXTO DAS SECÇÕES ANTERIORES (síntese comprimida — mantém coerência com estes pontos):
${contextSummary}`
    : '';

  const recentContext = recentSectionsContent
    ? `SECÇÕES IMEDIATAMENTE ANTERIORES (completas — para continuidade directa):
${recentSectionsContent}`
    : '';

  const contextNote = compressionActive
    ? `[NOTA: As secções mais antigas foram comprimidas num resumo de contexto para optimizar a janela de tokens. As ${recentSectionsContent ? '2 secções' : '0 secções'} mais recentes estão completas acima.]`
    : '';

  const researchContext = researchBrief
    ? `FICHA TÉCNICA DE PESQUISA (web consultada uma única vez após aprovação do esboço; reutilizar em todas as secções):
${researchBrief}`
    : '';

  // Instrução adicional para secções que NÃO são conclusão/referências
  const antiClosingInstruction = !sectionAllowsClosing(currentSection.title)
    ? `
PROIBIÇÕES ABSOLUTAS PARA ESTA SECÇÃO (viola as regras se ignorares):
❌ NÃO escrevas nenhuma conclusão — nem parcial, nem "em suma", nem "em síntese"
❌ NÃO escrevas "Em conclusão", "Conclui-se que", "Por fim, conclui-se", "Em suma" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas — nem uma única citação em formato de lista final
❌ NÃO escrevas cabeçalhos como "## Conclusão", "## Referências", "### Considerações Finais"
❌ NÃO fechas a secção com parágrafo de encerramento — termina no último ponto de desenvolvimento
O trabalho tem secções próprias para Conclusão e Referências — NÃO as antecipes aqui.`
    : '';

  return `És um especialista académico a desenvolver um TCC sobre: "${topic}".

ESBOÇO APROVADO (âncora estrutural — segue esta estrutura):
${outline}

${researchContext}

${historicalContext}

${recentContext}

${contextNote}

A TUA TAREFA AGORA:
Desenvolve APENAS o conteúdo interno da secção: "${currentSection.title}"
${antiClosingInstruction}

REGRAS DE ESCRITA:
- Começa DIRECTAMENTE pelo conteúdo académico — sem frases de enquadramento como "Nesta secção...", "A seguir...", "Este capítulo aborda..."
- Não incluas o título da secção no início — ele é inserido automaticamente
- Texto académico puro em português europeu
- Mantém coerência terminológica com o contexto fornecido
- Usa a ficha técnica de pesquisa como base factual e aplica apenas os pontos relevantes para esta secção
- Usa Markdown para formatação (negrito, listas, sub-títulos ### quando necessário)
- Norma de referenciação: APA (7.ª edição) — citações no texto apenas, sem lista no final
- Extensão: entre 300 e 600 palavras
- Não repitas conteúdo já presente no contexto histórico ou nas secções recentes
- Não realizes nova pesquisa web nesta fase`.trim();
}

// ── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'tcc:develop', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { sessionId, sectionIndex } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });
    }

    // 1. Carregar sessão
    let session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }
    if (!session.outline_approved) {
      return NextResponse.json({ error: 'Esboço ainda não aprovado' }, { status: 400 });
    }

    const currentSection = session.sections.find(s => s.index === sectionIndex);
    if (!currentSection) {
      return NextResponse.json({ error: 'Secção não encontrada' }, { status: 404 });
    }

    // 2. Comprimir contexto se necessário
    session = await compressContextIfNeeded(session, sectionIndex);

    // 3. Construir contexto optimizado
    const optimised = buildOptimisedContext(session, sectionIndex);

    // 4. Construir system prompt
    const systemPrompt = buildSystemPrompt(
      session.topic,
      optimised.outline,
      session.research_brief,
      optimised.contextSummary,
      optimised.recentSectionsContent,
      currentSection,
      optimised.compressionActive,
    );

    // 5. Chamar a IA em streaming
    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Desenvolve a secção "${currentSection.title}" do TCC. Lembra-te: escreve APENAS o conteúdo desta secção, sem conclusão, sem referências bibliográficas no final, sem frases de encerramento.`,
          },
        ],
        stream: true,
        max_tokens: 2048,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    // 6. Stream com acumulação + filtro pós-processamento antes de guardar
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
          } catch { /* ignorar */ }
        }

        controller.enqueue(chunk);
      },

      async flush() {
        if (sessionId && accumulated) {
          try {
            // Aplica filtro pós-processamento antes de guardar
            const cleaned = stripSpuriousBlocks(accumulated, currentSection.title);
            await saveSectionContent(sessionId, sectionIndex, cleaned, session.sections);
          } catch (e) {
            console.error('Erro ao guardar secção:', e);
          }
        }
      },
    });

    return new NextResponse(response.body!.pipeThrough(transformStream), {
      headers: {
        'Content-Type':           'text/event-stream',
        'Cache-Control':          'no-cache',
        'Connection':             'keep-alive',
        'X-Context-Compressed':   compressionWasActive ? 'true' : 'false',
        'X-Summary-Covers-Up-To': String(session.summary_covers_up_to ?? -1),
      },
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
