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
          REGRAS CRÍTICAS:
          1. Sempre que usar informação de uma fonte, adicione uma citação no formato [Doc X, pg Y] (ou apenas [Doc X] para texto) imediatamente após a frase relevante.
          2. Use uma linguagem clara e informativa.

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
