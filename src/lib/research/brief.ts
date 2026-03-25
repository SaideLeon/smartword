const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

export interface ResearchBrief {
  keywords: string[];
  brief: string;
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

  const prompt = `Atua como um agente de pesquisa académica.
TEMA: "${topic}"
ESBOÇO APROVADO:
${outline}

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

  const response = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'groq/compound',
      messages: [
        {
          role: 'system',
          content: 'És um investigador académico rigoroso. Produz resposta em português europeu.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1800,
      stream: false,
      compound_custom: {
        tools: {
          enabled_tools: ['web_search', 'visit_website'],
        },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err);
  }

  const payload = await response.json();
  const brief = payload.choices?.[0]?.message?.content?.trim();

  if (!brief) {
    throw new Error('Não foi possível gerar ficha técnica de pesquisa');
  }

  const keywords = parseKeywords(brief);
  return { keywords, brief };
}
