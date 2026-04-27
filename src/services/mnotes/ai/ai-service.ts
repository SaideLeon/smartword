import { GoogleGenAI, type Part } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
});

export const AIService = {
  async generateContent(parts: Part[]): Promise<string> {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts }],
    });

    return response.text || '';
  },
};
