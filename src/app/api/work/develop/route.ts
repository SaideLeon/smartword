// app/api/work/develop/route.ts
// A responsabilidade de inserir {pagebreak} pertence EXCLUSIVAMENTE ao cliente (WorkPanel.tsx).
// O servidor devolve conteúdo puro, sem marcadores estruturais.

import { NextResponse } from 'next/server';
import { getWorkSession, saveWorkSectionContent } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

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
- Incluir pelo menos 1 exemplo prático ligado ao quotidiano moçambicano se for necessário( nem todos trabalhos vão precisar de menção de quotidiano moçambicano)
- Ter entre 200 e 350 palavras
- Usar Markdown (negrito para termos importantes, listas quando adequado)
- NÃO repetir conteúdo já presente nas secções anteriores
- NÃO incluir conclusão nem lista de referências no final`;
  }

  if (normalizedName === 'introducao' || normalizedName === 'introducao') {
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
- Tom académico mas SIMPLES e acessível ao nível do ensino secundário/médio
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
