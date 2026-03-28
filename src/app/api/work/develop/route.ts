// app/api/work/develop/route.ts  (versão corrigida — sem normalização de pagebreak no servidor)
// A responsabilidade de inserir {pagebreak} pertence EXCLUSIVAMENTE ao cliente (WorkPanel.tsx).
// O servidor devolve conteúdo puro, sem marcadores estruturais.

import { NextResponse } from 'next/server';
import { getWorkSession, saveWorkSectionContent } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

// ── Secções que permitem conteúdo de fecho ────────────────────────────────────

const SECTIONS_THAT_ALLOW_CLOSING = new Set([
  'conclusão',
  'conclusion',
  'referências',
  'referencias',
  'referências bibliográficas',
  'referencias bibliograficas',
  'bibliography',
]);

function sectionAllowsClosing(title: string): boolean {
  return SECTIONS_THAT_ALLOW_CLOSING.has(title.toLowerCase().trim());
}

// ── Filtro pós-processamento ──────────────────────────────────────────────────

const SPURIOUS_HEADING_PATTERN = /^#{1,3}\s*(conclus[aã]o|consider[aã]es\s+finais|refere?ncias?(\s+bibliogr[aá]ficas?)?|bibliography|notas?\s+finais?|síntese)\s*$/im;

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

// ── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'work:develop', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const { sessionId, sectionIndex } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const session = await getWorkSession(sessionId);
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });

    const outline = session.outline_approved ?? session.outline_draft;
    if (!outline) return NextResponse.json({ error: 'Esboço ainda não disponível' }, { status: 400 });

    const section = session.sections.find(current => current.index === sectionIndex);
    if (!section) return NextResponse.json({ error: 'Secção não encontrada' }, { status: 404 });

    const previousSections = session.sections
      .filter(current => current.index < sectionIndex && current.content)
      .map(current => ({ title: current.title, content: current.content }));

    const previousContext = previousSections.length > 0
      ? `\nSECÇÕES JÁ DESENVOLVIDAS (para manter coerência):\n${
          previousSections.map(current =>
            `### ${current.title}\n${current.content.slice(0, 500)}${current.content.length > 500 ? '…' : ''}`
          ).join('\n\n')
        }\n`
      : '';

    const researchContext = session.research_brief
      ? `\nFICHA TÉCNICA DE PESQUISA (gerada após aprovação do esboço e reutilizada em todas as secções):\n${session.research_brief}\n`
      : '';

    const isSubsection = /^\d+\.\d+/.test(section.title);

    const sectionInstructions: Record<string, string> = {
      'Introdução': 'Apresenta o tema, contextualiza a sua importância, indica brevemente a estrutura do trabalho. Entre 200-350 palavras. NÃO incluas conclusão nem referências no final.',
      'Objectivos e Metodologia': 'Define 3-5 objectivos claros (geral e específicos) e descreve a metodologia usada. Entre 200-300 palavras. NÃO incluas conclusão nem referências no final.',
      'Desenvolvimento Teórico': 'Desenvolve o conteúdo principal com profundidade, usando sub-títulos (###). Entre 400-700 palavras. NÃO incluas conclusão nem referências no final.',
      'Conclusão': 'Resume os pontos principais abordados, responde aos objectivos e apresenta uma reflexão final. Entre 150-250 palavras.',
      'Referências Bibliográficas': 'Lista no mínimo 5 referências no formato APA (7.ª edição). Inclui livros, sites académicos e artigos relacionados com o tema.',
    };

    const subsectionInstruction = `Desenvolve este subtópico de forma aprofundada e académica. Apresenta definições claras, factos relevantes, exemplos práticos e, quando adequado, menciona autores ou fontes. Entre 250-450 palavras. NÃO incluas conclusão nem referências bibliográficas no final.`;

    const specificInstruction = isSubsection
      ? subsectionInstruction
      : (sectionInstructions[section.title] ?? 'Desenvolve o conteúdo de forma académica. NÃO incluas conclusão nem referências no final.');

    const antiClosingInstruction = !sectionAllowsClosing(section.title)
      ? `
PROIBIÇÕES ABSOLUTAS PARA ESTA SECÇÃO:
❌ NÃO escrevas "Em conclusão", "Em suma", "Conclui-se que", "Por fim, conclui-se" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas no final
❌ NÃO escrevas cabeçalhos como "## Conclusão", "## Referências", "### Considerações Finais"
❌ NÃO fechas com parágrafo de encerramento — termina no último ponto de conteúdo
O trabalho tem secções próprias para isso — NÃO as antecipes aqui.`
      : '';

    const systemPrompt = `És um especialista académico a desenvolver um trabalho escolar do ensino secundário/médio em Moçambique sobre: "${session.topic}".

ESBOÇO ORIENTADOR DO TRABALHO:
${outline}
${previousContext}
${researchContext}
A TUA TAREFA AGORA:
Desenvolve APENAS a secção: "${section.title}"

INSTRUÇÃO ESPECÍFICA PARA ESTA SECÇÃO:
${specificInstruction}
${antiClosingInstruction}

REGRAS ABSOLUTAS:
- Escreve APENAS o conteúdo da secção, sem introduções do tipo "Nesta secção…" ou "Vou desenvolver…"
- NÃO incluas o título da secção no início do conteúdo — ele é adicionado automaticamente
- NÃO incluas marcadores {pagebreak} ou {section} no conteúdo — são adicionados automaticamente
- Português europeu/moçambicano correcto
- Usa Markdown: negrito, listas, sub-títulos ### quando adequado
- Mantém coerência terminológica com as secções anteriores
- Usa a ficha técnica de pesquisa como base factual prioritária
- Tom académico mas acessível ao nível do ensino secundário/médio
- Norma de referenciação obrigatória: APA (7.ª edição) — citações no texto apenas
- NÃO faças nova pesquisa web`.trim();

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
            content: `Desenvolve a secção "${section.title}". Escreve APENAS o conteúdo desta secção — sem conclusão, sem lista de referências no final, sem frases de encerramento, sem marcadores de pagebreak.`,
          },
        ],
        stream: true,
        max_tokens: 1500,
        temperature: 0.5,
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
            // Guardar conteúdo limpo — SEM pagebreaks, SEM marcadores estruturais
            // O cliente é responsável por adicionar {pagebreak} ao inserir no editor
            const cleaned = stripSpuriousBlocks(accumulated, section.title);
            await saveWorkSectionContent(sessionId, sectionIndex, cleaned, session.sections);
          } catch (e) {
            console.error('Erro ao guardar secção do trabalho:', e);
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
