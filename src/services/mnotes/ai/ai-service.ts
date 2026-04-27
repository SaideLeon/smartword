import { GoogleGenAI, type Part } from '@google/genai';

const DEFAULT_MODEL = 'gemini-2.5-flash';

function collectGeminiKeys(): string[] {
  const keys: string[] = [];

  const base = process.env.GEMINI_API_KEY ?? '';
  if (base) keys.push(...base.split(',').map(value => value.trim()).filter(Boolean));

  const plural = process.env.GEMINI_API_KEYS ?? '';
  if (plural) keys.push(...plural.split(',').map(value => value.trim()).filter(Boolean));

  for (let i = 1; i <= 20; i += 1) {
    const key = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (key) keys.push(key);
  }

  const publicFallback = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
  if (publicFallback) keys.push(publicFallback);

  return Array.from(new Set(keys));
}

function extractStatus(error: unknown): number | null {
  const candidate = error as { status?: unknown; cause?: { status?: unknown }; message?: string };
  if (typeof candidate?.status === 'number') return candidate.status;
  if (typeof candidate?.cause?.status === 'number') return candidate.cause.status;

  const match = String(candidate?.message ?? '').match(/\b(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

function shouldRetry(status: number | null): boolean {
  return status === 429 || (status !== null && status >= 500);
}

export const AIService = {
  async generateContent(parts: Part[], model = DEFAULT_MODEL): Promise<string> {
    const keys = collectGeminiKeys();
    if (keys.length === 0) {
      throw new Error('GEMINI_API_KEY não configurada.');
    }

    let lastError = 'Erro ao gerar conteúdo com Gemini.';

    for (let i = 0; i < keys.length; i += 1) {
      try {
        const ai = new GoogleGenAI({ apiKey: keys[i] });
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
        });

        return response.text || '';
      } catch (error: unknown) {
        const status = extractStatus(error);
        lastError = error instanceof Error ? error.message : lastError;

        if (i < keys.length - 1 && shouldRetry(status)) {
          continue;
        }

        throw new Error(lastError);
      }
    }

    throw new Error(lastError);
  },
};
