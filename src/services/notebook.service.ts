import { Message, Source } from '@/types/mnotes';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

export const NotebookService = {
  async chat(messages: Message[], sources: Source[], notebookTitle: string): Promise<string> {
    const selectedSources = sources.filter(s => s.selected && s.data);
    
    const parts = [
      ...selectedSources.map(s => {
        if (s.type === 'pdf') {
          return {
            inlineData: {
              mimeType: 'application/pdf',
              data: s.data!
            }
          };
        } else {
          try {
            const decodedText = decodeURIComponent(escape(atob(s.data!)));
            return {
              text: `Conteúdo da fonte "${s.name}":\n${decodedText}`
            };
          } catch(e) {
             return { text: `Erro na fonte: ${s.name}` };
          }
        }
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
        `
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts }]
    });

    return response.text || '';
  },

  async summarize(source: Source): Promise<string> {
    if (!source.data) throw new Error('Dados da fonte ausentes');

    const parts = [
      source.type === 'pdf' 
        ? { inlineData: { mimeType: 'application/pdf', data: source.data } }
        : { text: `Resuma este texto:\n${decodeURIComponent(escape(atob(source.data)))}` },
      { text: "Forneça um resumo executivo conciso deste documento. Destaque os pontos principais em tópicos." }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts }]
    });

    return response.text || '';
  },

  async getSuggestions(sources: Source[]): Promise<string[]> {
    const activeSources = sources.filter(s => s.selected && s.data);
    if (activeSources.length === 0) return [];

    const parts = [
      ...activeSources.slice(0, 3).map(s => {
        if (s.type === 'pdf') {
          return {
            inlineData: { mimeType: 'application/pdf', data: s.data! }
          };
        } else {
          return { text: `Fonte: ${s.name}\n${decodeURIComponent(escape(atob(s.data!)))}` };
        }
      }),
      {
        text: `
          Com base nos documentos fornecidos, gere 3 perguntas curtas e instigantes que um estudante poderia fazer para explorar o conteúdo.
          Retorne APENAS as perguntas, uma por linha, sem números, sem aspas.
        `
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts }]
    });

    const text = response.text || '';
    return text.split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 5 && q.includes('?'))
      .slice(0, 3);
  }
};
