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

// ── Embeddings com gemini-embedding-2-preview ─────────────────────────────────
//
// O modelo gemini-embedding-2-preview NÃO suporta o campo `taskType`.
// Em vez disso, a tarefa é declarada como PREFIXO DE TEXTO no próprio conteúdo.
//
// Formato assimétrico (RAG):
//   Query:     "task: search result | query: {texto}"
//   Documento: "title: {título} | text: {texto}"
//
// Os espaços de embedding entre gemini-embedding-001 e gemini-embedding-2-preview
// são INCOMPATÍVEIS — nunca misturar vectores dos dois modelos na mesma tabela.

const EMBED_MODEL = 'gemini-embedding-2-preview';
const EMBED_DIMS  = 768; // Suportado: 128–3072. Recomendado: 768, 1536, 3072.

/**
 * Normaliza um vector para norma unitária.
 * OBRIGATÓRIO quando outputDimensionality < 3072 (o padrão 3072 já sai normalizado).
 */
function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? values : values.map(v => v / norm);
}

function extractEmbeddingValues(result: { embeddings?: Array<{ values?: number[] }> }): number[] {
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error('Resposta de embedding inválida do Gemini.');
  }
  return values;
}

/**
 * Gera embedding de um CHUNK DE DOCUMENTO para guardar na BD.
 * Usa o prefixo "title: ... | text: ..." conforme docs Google para recuperação.
 */
export async function geminiEmbedDocument(
  text: string,
  title = 'none',
): Promise<number[]> {
  const keys = collectGeminiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY não configurada.');

  const formattedContent = `title: ${title} | text: ${text}`;

  for (let i = 0; i < keys.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: keys[i] });
      const result = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: formattedContent,
        config: { outputDimensionality: EMBED_DIMS },
      });

      const values = extractEmbeddingValues(result);
      return normalizeVector(values);
    } catch (error: any) {
      const status = extractStatusFromError(error);
      if (i < keys.length - 1 && canRetryWithNextKey(status)) continue;
      throw new Error(error?.message ?? 'Erro ao gerar embedding de documento.');
    }
  }

  throw new Error('Falha ao gerar embedding de documento.');
}

/**
 * Gera embedding de uma QUERY DE BUSCA (ex: título de secção + tema).
 * Usa o prefixo "task: search result | query: ..." conforme docs Google.
 * DIFERENTE do embedDocument — os dois prefixos são assimétricos propositalmente.
 */
export async function geminiEmbedQuery(query: string): Promise<number[]> {
  const keys = collectGeminiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY não configurada.');

  const formattedContent = `task: search result | query: ${query}`;

  for (let i = 0; i < keys.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: keys[i] });
      const result = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: formattedContent,
        config: { outputDimensionality: EMBED_DIMS },
      });

      const values = extractEmbeddingValues(result);
      return normalizeVector(values);
    } catch (error: any) {
      const status = extractStatusFromError(error);
      if (i < keys.length - 1 && canRetryWithNextKey(status)) continue;
      throw new Error(error?.message ?? 'Erro ao gerar embedding de query.');
    }
  }

  throw new Error('Falha ao gerar embedding de query.');
}

/**
 * Embed em batch de vários chunks de documento (para upload de ficheiros).
 * Respeita rate limiting com sleep entre lotes.
 */
export async function geminiEmbedDocumentBatch(
  chunks: Array<{ text: string; title?: string }>,
  batchSize = 10,
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    for (const chunk of batch) {
      const embedding = await geminiEmbedDocument(chunk.text, chunk.title);
      embeddings.push(embedding);
    }

    if (i + batchSize < chunks.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return embeddings;
}

export interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export async function geminiEmbedMultimodal(part: InlineDataPart): Promise<number[]> {
  const keys = collectGeminiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY não configurada.');

  for (let i = 0; i < keys.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: keys[i] });
      const result = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: part,
        config: { outputDimensionality: EMBED_DIMS },
      });

      if (!result.embeddings?.[0]?.values) {
        throw new Error('Resposta de embedding inválida ou vazia.');
      }
      const values = result.embeddings[0].values;
      return normalizeVector(values);
    } catch (error: any) {
      const status = extractStatusFromError(error);
      if (i < keys.length - 1 && canRetryWithNextKey(status)) continue;
      throw new Error(error?.message ?? 'Erro ao gerar embedding multimodal.');
    }
  }

  throw new Error('Falha ao gerar embedding multimodal.');
}
