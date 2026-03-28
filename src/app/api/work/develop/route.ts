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

// ── Filtro de linguagem universitária inadequada ──────────────────────────────
// Remove ou substitui blocos com terminologia académica avançada inadequada
// para o nível do ensino secundário/médio.

const UNIVERSITY_LANGUAGE_PATTERNS = [
  // Subsecções inteiras com terminologia universitária
  /\n*#{1,3}\s*(abordagem\s+de\s+investiga[cç][aã]o|crit[eé]rios\s+de\s+avalia[cç][aã]o|procedimentos?\s+operacionais?|revis[aã]o\s+bibliogr[aá]fica|an[aá]lise\s+de\s+casos?\s+reais?|coer[eê]ncia\s+metodol[oó]gica)[^\n]*\n[^]*/gi,
];

function stripUniversityLanguage(content: string, sectionTitle: string): string {
  const titleLower = sectionTitle.toLowerCase();
  // Só aplicar na secção de Objectivos e Metodologia
  if (!titleLower.includes('objectivo') && !titleLower.includes('objetivo') && !titleLower.includes('metodologia')) {
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
      ? `\nSECÇÕES JÁ DESENVOLVIDAS (para manter coerência e NÃO repetir conteúdo):\n${
          previousSections.map(current =>
            `### ${current.title}\n${current.content.slice(0, 400)}${current.content.length > 400 ? '…' : ''}`
          ).join('\n\n')
        }\n`
      : '';

    const researchContext = session.research_brief
      ? `\nFICHA TÉCNICA DE PESQUISA (gerada após aprovação do esboço e reutilizada em todas as secções):\n${session.research_brief}\n`
      : '';

    const isSubsection = /^\d+\.\d+/.test(section.title);

    // ── Instruções específicas por secção ─────────────────────────────────────
    //
    // PROBLEMA IDENTIFICADO NO PDF ANALISADO:
    // - Introdução: muito longa (2 páginas), linguagem universitária, questão de investigação formal
    // - Objectivos e Metodologia: extremamente longa (3 páginas), sub-secções desnecessárias
    //   ("abordagem de investigação", "critérios de avaliação", "procedimentos operacionais"),
    //   linguagem académica avançada inadequada para o nível secundário
    // - Desenvolvimento: repete conteúdo entre subsecções
    //
    // SOLUÇÃO: limites de palavras rígidos e instruções negativas explícitas por secção.

    const sectionInstructions: Record<string, string> = {
      'Introdução': `Escreve uma introdução simples e directa para um trabalho do ensino secundário/médio. Deve:
- Apresentar o tema de forma acessível (o que é e porquê é importante)
- Referir brevemente a estrutura do trabalho (as secções que existem)
- Ter entre 150 e 250 palavras no máximo — NÃO ultrapasses este limite
- Usar linguagem clara e simples, adequada a um aluno do ensino secundário
- NÃO incluir questão de investigação formal, hipóteses, ou linguagem universitária
- NÃO incluir conclusão nem referências no final`,

      'Objectivos e Metodologia': `Escreve os objectivos e a metodologia de forma SIMPLES e CONCISA para um trabalho do ensino secundário/médio.

Estrutura OBRIGATÓRIA (segue exactamente):
1. **Objectivo Geral** — 1 frase que resume o propósito do trabalho (começa com infinitivo: "Compreender...", "Analisar...", "Explicar...")
2. **Objectivos Específicos** — lista de 3 a 4 bullets curtos (cada um com 1 frase simples, começa com infinitivo)
3. **Metodologia** — 1 parágrafo de 3 a 4 linhas descrevendo como o trabalho foi desenvolvido (ex: pesquisa em livros e sites, análise de exemplos práticos, etc.)

PROIBIÇÕES ABSOLUTAS — se ignorares, o trabalho fica errado:
❌ NÃO cries sub-secções como "Abordagem de Investigação", "Critérios de Avaliação", "Procedimentos Operacionais"
❌ NÃO uses termos universitários: "revisão bibliográfica", "análise de casos reais", "coerência metodológica", "abordagem de investigação"
❌ NÃO faças listas longas de critérios ou procedimentos numerados
❌ NÃO ultrapasses 200 palavras no total
❌ NÃO incluas conclusão nem referências no final`,

      'Desenvolvimento Teórico': `Apresenta o conteúdo teórico principal de forma clara e organizada. Deve:
- Introduzir os conceitos fundamentais do tema
- Usar linguagem simples adequada ao ensino secundário
- Incluir exemplos práticos ligados ao quotidiano moçambicano
- Ter entre 300 e 500 palavras
- NÃO repetir conteúdo que já esteja nas subsecções
- NÃO incluir conclusão nem referências no final`,

      'Conclusão': `Escreve uma conclusão simples e directa. Deve:
- Resumir os pontos mais importantes abordados no trabalho (2-3 frases)
- Apresentar a opinião do aluno sobre o tema e a sua importância
- Referir o que o aluno aprendeu com este trabalho
- Ter entre 100 e 180 palavras — NÃO ultrapasses este limite
- Usar linguagem simples e pessoal ("Concluímos que...", "Este trabalho permitiu...")
- NÃO introduzir informação nova`,

      'Referências Bibliográficas': `Lista as referências bibliográficas no formato APA (7.ª edição). Inclui no mínimo 4 referências relevantes para o tema (livros didácticos, sites académicos ou educativos, artigos). Apresenta cada referência numa linha separada, ordenadas alfabeticamente pelo apelido do autor.`,
    };

    const subsectionInstruction = `Desenvolve este subtópico de forma clara e didáctica para alunos do ensino secundário. Deve:
- Apresentar o conceito com uma definição simples e acessível
- Incluir pelo menos 1 exemplo prático ligado ao quotidiano moçambicano
- Ter entre 200 e 350 palavras
- Usar Markdown (negrito para termos importantes, listas quando adequado)
- NÃO repetir conteúdo já presente nas secções anteriores
- NÃO incluir conclusão nem lista de referências no final`;

    const specificInstruction = isSubsection
      ? subsectionInstruction
      : (sectionInstructions[section.title] ?? `Desenvolve o conteúdo de forma académica adequada ao ensino secundário, entre 200 e 350 palavras. NÃO incluas conclusão nem referências no final.`);

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
- Tom académico mas SIMPLES e acessível ao nível do ensino secundário/médio — NÃO uses linguagem universitária
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
            content: `Desenvolve a secção "${section.title}". Escreve APENAS o conteúdo desta secção — sem conclusão, sem lista de referências no final, sem frases de encerramento, sem marcadores de pagebreak. Respeita rigorosamente o limite de palavras indicado.`,
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
