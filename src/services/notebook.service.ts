import { Message, Source } from '@/types';

interface GeminiInlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

interface GeminiTextPart {
  text: string;
}

type GeminiPart = GeminiInlineDataPart | GeminiTextPart;

async function postMnotesChat(parts: GeminiPart[]): Promise<string> {
  const response = await fetch('/api/chat/mnotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Falha ao processar pedido de IA no MNotes.');
  }

  return response.text();
}

function decodeBase64Utf8(base64: string): string {
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return atob(base64);
  }
}

export const NotebookService = {
  async chat(messages: Message[], sources: Source[], notebookTitle: string): Promise<string> {
    const selectedSources = sources.filter(s => s.selected && s.data);

    const parts: GeminiPart[] = [
      ...selectedSources.map((source) => {
        if (source.type === 'pdf') {
          return {
            inlineData: {
              mimeType: 'application/pdf',
              data: source.data!,
            },
          };
        }

        return {
          text: `Conteúdo da fonte "${source.name}":\n${decodeBase64Utf8(source.data!)}`,
        };
      }),
      {
        text: `
          Você é o assistente inteligente do Muneri Notebooks.
          Contexto do notebook atual: ${notebookTitle}.

          Responda à pergunta do usuário com base nas fontes PDF/Texto fornecidas.

          REGRAS DE CITAÇÃO (APA 7ª EDIÇÃO):
          1. Priorize SEMPRE citação indireta (paráfrase), escrevendo com palavras próprias e sem copiar frases literais da fonte.
          2. Em citação indireta, use APA no corpo do texto em formato (Autor/Entidade, ano).
          3. Só inclua página quando realmente necessária para localizar trecho específico: (Autor/Entidade, ano, p. X).
          4. Quando não houver autor/ano explícito no documento, use fallback: (Fonte X, s.d.).
          5. Para paráfrase de legislação, pode usar: (Entidade, ano, art. X).
          6. Após cada afirmação relevante, adicione também o marcador de rastreio da plataforma no formato [Fonte X].
          7. Nunca use o formato [Doc X, pg Y].
          8. Termine a resposta com uma secção "Referências (APA 7)" em lista curta, contendo as fontes efectivamente citadas.

          ESTILO:
          - Linguagem formal, académica e clara.
          - Evite gírias, sarcasmo e tom coloquial.
          - Se faltarem metadados para referência completa, indique isso explicitamente.

          Pergunta: ${messages[messages.length - 1].content}
        `,
      },
    ];

    return postMnotesChat(parts);
  },

  async summarize(source: Source): Promise<string> {
    if (!source.data) throw new Error('Dados da fonte ausentes');

    const parts: GeminiPart[] = [
      source.type === 'pdf'
        ? { inlineData: { mimeType: 'application/pdf', data: source.data } }
        : { text: `Resuma este texto:\n${decodeBase64Utf8(source.data)}` },
      { text: 'Forneça um resumo executivo conciso deste documento. Destaque os pontos principais em tópicos.' },
    ];

    return postMnotesChat(parts);
  },

  async getSuggestions(sources: Source[]): Promise<string[]> {
    const activeSources = sources.filter(s => s.selected && s.data);
    if (activeSources.length === 0) return [];

    const parts: GeminiPart[] = [
      ...activeSources.slice(0, 3).map(source => {
        if (source.type === 'pdf') {
          return {
            inlineData: { mimeType: 'application/pdf', data: source.data! },
          };
        }

        return {
          text: `Fonte: ${source.name}\n${decodeBase64Utf8(source.data!)}`,
        };
      }),
      {
        text: `
          Com base nos documentos fornecidos, gere 3 perguntas curtas e instigantes que um estudante poderia fazer para explorar o conteúdo.
          Retorne APENAS as perguntas, uma por linha, sem números, sem aspas.
        `,
      },
    ];

    const text = await postMnotesChat(parts);
    return text
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 5 && q.includes('?'))
      .slice(0, 3);
  },
};
