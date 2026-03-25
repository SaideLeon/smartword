const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

export interface ResearchBrief {
  keywords: string[];
  brief: string;
}

function compactOutline(outline: string, maxChars: number): string {
  if (outline.length <= maxChars) return outline;

  const lines = outline
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => /^#{1,4}\s+/.test(line) || /^\d+[.)]\s+/.test(line));

  const compact = lines.join('\n');
  if (compact.length <= maxChars) return compact;

  return compact.slice(0, maxChars);
}

function parseKeywords(text: string): string[] {
  const keywordSection = text.match(/PALAVRAS-CHAVE(?:\s*\(.*?\))?:([\s\S]*?)(?:\n\n|\n##|$)/i)?.[1] ?? '';
  const candidates = keywordSection
    .split(/\n|,|;/)
    .map(item => item.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);

  return Array.from(new Set(candidates)).slice(0, 12);
}

export async function generateResearchBrief(topic: string, outline: string): Promise<ResearchBrief> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY não configurada');
  }

  const outlineForPrompt = compactOutline(outline, 4_000);

  const prompt = `Atua como um agente de pesquisa académica.
TEMA: "${topic}"
ESBOÇO APROVADO:
${outlineForPrompt}

Tarefa obrigatória em 3 passos:
1) Seleciona palavras-chave de alta relevância para pesquisa web.
2) Usa pesquisa web UMA ÚNICA VEZ para recolher fontes e dados recentes relevantes.
3) Entrega uma FICHA TÉCNICA reutilizável em todas as secções.

Formato de resposta obrigatório (Markdown):
## PALAVRAS-CHAVE
- palavra 1
- palavra 2
(...)

## FICHA TÉCNICA DE PESQUISA
- Tema delimitado
- Critérios de relevância
- Achados centrais com dados/contexto
- Fontes recomendadas (nome + link)
- Conceitos obrigatórios por secção do esboço
- Limites e lacunas

  ## DIRETRIZ DE USO
Explique como usar esta ficha técnica para manter relevância e coerência no desenvolvimento de cada secção sem nova pesquisa web.`;

  const body = {
    model: 'groq/compound',
    messages: [
      {
        role: 'system',
        content: 'És um investigador académico rigoroso. Produz resposta em português europeu.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 1200,
    stream: false,
    compound_custom: {
      tools: {
        enabled_tools: ['web_search', 'visit_website'],
      },
    },
  };

  const response = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let payload: any;
  if (!response.ok) {
    const err = await response.text();
    const isTooLarge = response.status === 413 || /request_too_large|Request Entity Too Large/i.test(err);

    if (!isTooLarge) {
      throw new Error(err);
    }

    const reducedPrompt = prompt.replace(outlineForPrompt, compactOutline(outline, 1_500));

    const fallbackResponse = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        max_tokens: 900,
        messages: [
          body.messages[0],
          { role: 'user', content: reducedPrompt },
        ],
        compound_custom: {
          tools: {
            enabled_tools: ['web_search'],
          },
        },
      }),
    });

    if (!fallbackResponse.ok) {
      const fallbackErr = await fallbackResponse.text();
      throw new Error(fallbackErr);
    }

    payload = await fallbackResponse.json();
  } else {
    payload = await response.json();
  }

  const brief = payload.choices?.[0]?.message?.content?.trim();

  if (!brief) {
    throw new Error('Não foi possível gerar ficha técnica de pesquisa');
  }

  const keywords = parseKeywords(brief);
  return { keywords, brief };
}
