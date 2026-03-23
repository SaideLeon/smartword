import { NextResponse } from 'next/server';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

export async function POST(req: Request) {
  try {
    const { topic, outline, section, previousSections } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const previousContext = previousSections?.length > 0
      ? `\nSECÇÕES JÁ DESENVOLVIDAS (para manter coerência):\n${
          previousSections.map((s: any) =>
            `### ${s.title}\n${s.content.slice(0, 500)}${s.content.length > 500 ? '…' : ''}`
          ).join('\n\n')
        }\n`
      : '';

    // Detectar se é uma subsecção numerada (ex: "4.1 Conceito de...")
    const isSubsection = /^\d+\.\d+/.test(section.title);

    // Instruções específicas por título de secção
    const sectionInstructions: Record<string, string> = {
      'Índice': `Formata como um índice real com os títulos das secções e páginas fictícias (ex: pág. 1, pág. 2…). Apresenta de forma limpa, sem desenvolvimento de conteúdo.`,
      'Introdução': `Apresenta o tema, contextualiza a sua importância, indica brevemente a estrutura do trabalho. Entre 200-350 palavras.`,
      'Objectivos e Metodologia': `Define 3-5 objectivos claros (geral e específicos) e descreve a metodologia usada (pesquisa bibliográfica, qualitativa, etc.). Entre 200-300 palavras.`,
      'Desenvolvimento Teórico': `Desenvolve o conteúdo principal com profundidade, usando subtítulos (###) para organizar os temas. Entre 400-700 palavras. Inclui conceitos, factos, exemplos e referências a autores quando relevante.`,
      'Conclusão': `Resume os pontos principais abordados, responde aos objectivos e apresenta uma reflexão final. Entre 150-250 palavras.`,
      'Referências Bibliográficas': `Lista no mínimo 5 referências no formato APA adaptado ao contexto moçambicano. Inclui livros, sites académicos e artigos relacionados com o tema.`,
    };

    // Para subsecções (4.1, 4.2, …): instrução dedicada ao subtópico específico
    const subsectionInstruction = `Desenvolve este subtópico de forma aprofundada e académica. \
Apresenta definições claras, factos relevantes, exemplos práticos (preferencialmente do contexto moçambicano) \
e, quando adequado, menciona autores ou fontes que suportem as ideias. \
Entre 250-450 palavras. Usa Markdown para listas e destaques quando melhorar a clareza.`;

    const specificInstruction = isSubsection
      ? subsectionInstruction
      : (sectionInstructions[section.title] ?? 'Desenvolve o conteúdo de forma académica e adequada ao ensino secundário/médio.');

    const systemPrompt = `És um especialista académico a desenvolver um trabalho escolar do ensino secundário/médio em Moçambique sobre: "${topic}".

ESBOÇO ORIENTADOR DO TRABALHO:
${outline}
${previousContext}
A TUA TAREFA AGORA:
Desenvolve APENAS a secção: "${section.title}"

INSTRUÇÃO ESPECÍFICA PARA ESTA SECÇÃO:
${specificInstruction}

REGRAS ABSOLUTAS:
- Escreve APENAS o conteúdo da secção, sem introduções do tipo "Nesta secção…" ou "Vou desenvolver…"
- Português europeu/moçambicano correcto
- Usa Markdown: negrito, listas, sub-títulos ### quando adequado
- Mantém coerência terminológica com as secções anteriores
- Tom académico mas acessível ao nível do ensino secundário/médio`.trim();

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
          { role: 'user',   content: `Desenvolve a secção "${section.title}".` },
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

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
