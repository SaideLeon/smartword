import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL = 'gemini-3.1-flash-lite-preview';

type ChatRole = 'system' | 'user' | 'assistant';
type ChatMessage = { role: ChatRole; content: string };

interface GeminiOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
}

type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

function collectGeminiKeys(): string[] {
  const keys: string[] = [];

  const base = process.env.GEMINI_API_KEY ?? '';
  if (base) keys.push(...base.split(',').map(v => v.trim()).filter(Boolean));

  const plural = process.env.GEMINI_API_KEYS ?? '';
  if (plural) keys.push(...plural.split(',').map(v => v.trim()).filter(Boolean));

  for (let i = 1; i <= 20; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (k) keys.push(k);
  }

  return Array.from(new Set(keys));
}

function extractStatusFromError(error: unknown): number | null {
  const candidate = error as { status?: unknown; cause?: { status?: unknown }; message?: string };
  if (typeof candidate?.status === 'number') return candidate.status;
  if (typeof candidate?.cause?.status === 'number') return candidate.cause.status;
  const match = String(candidate?.message ?? '').match(/\b(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

function canRetryWithNextKey(status: number | null): boolean {
  return status === 429 || (status !== null && status >= 500);
}

function buildPayload(messages: ChatMessage[]) {
  const systemInstruction = messages
    .filter(m => m.role === 'system' && m.content)
    .map(m => m.content.trim())
    .filter(Boolean)
    .join('\n\n');

  const contents: GeminiContent[] = messages
    .filter(m => m.role !== 'system' && m.content)
    .map((m): GeminiContent => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  return { systemInstruction: systemInstruction || undefined, contents };
}

function ensureContents(contents: GeminiContent[]) {
  if (contents.length > 0) return contents;
  return [{ role: 'user' as const, parts: [{ text: 'Segue as instruções do sistema e responde ao pedido.' }] }];
}

export async function geminiGenerateText(options: GeminiOptions): Promise<string> {
  const keys = collectGeminiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY não configurada.');

  const { systemInstruction, contents } = buildPayload(options.messages);
  let lastErrorMessage = 'Erro ao chamar Gemini.';

  for (let i = 0; i < keys.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: keys[i] });
      const result = await ai.models.generateContent({
        model: options.model ?? DEFAULT_MODEL,
        contents: ensureContents(contents),
        config: {
          systemInstruction,
          temperature: options.temperature ?? 0.5,
          maxOutputTokens: options.maxOutputTokens ?? 1024,
          thinkingConfig: { thinkingLevel: 'MINIMAL' as any },
        },
      });

      return String(result?.text ?? '').trim();
    } catch (error: any) {
      const status = extractStatusFromError(error);
      lastErrorMessage = error?.message ?? `Erro Gemini (status ${status ?? 'desconhecido'}).`;
      if (i < keys.length - 1 && canRetryWithNextKey(status)) continue;
      throw new Error(lastErrorMessage);
    }
  }

  throw new Error(lastErrorMessage);
}

export async function geminiGenerateTextStreamSSE(options: GeminiOptions): Promise<ReadableStream<Uint8Array>> {
  const keys = collectGeminiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY não configurada.');

  const { systemInstruction, contents } = buildPayload(options.messages);
  let lastErrorMessage = 'Erro ao chamar Gemini.';

  for (let i = 0; i < keys.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: keys[i] });
      const stream = await ai.models.generateContentStream({
        model: options.model ?? DEFAULT_MODEL,
        contents: ensureContents(contents),
        config: {
          systemInstruction,
          temperature: options.temperature ?? 0.5,
          maxOutputTokens: options.maxOutputTokens ?? 1024,
          thinkingConfig: { thinkingLevel: 'MINIMAL' as any },
        },
      });

      const encoder = new TextEncoder();
      return new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk?.text ?? '';
              if (!text) continue;
              const payload = JSON.stringify({ choices: [{ delta: { content: text } }] });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    } catch (error: any) {
      const status = extractStatusFromError(error);
      lastErrorMessage = error?.message ?? `Erro Gemini (status ${status ?? 'desconhecido'}).`;
      if (i < keys.length - 1 && canRetryWithNextKey(status)) continue;
      throw new Error(lastErrorMessage);
    }
  }

  throw new Error(lastErrorMessage);
}
