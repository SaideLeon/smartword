import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const EMBED_MODEL = 'gemini-embedding-2-preview';
const EMBED_DIMS = 768;

interface EmbedRequestItem {
  id: string;
  mode: 'query' | 'text' | 'pdf';
  title?: string;
  text?: string;
  mimeType?: string;
  data?: string;
}

function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? values : values.map(value => value / norm);
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada.');
  }
  return apiKey;
}

function toGeminiContent(item: EmbedRequestItem): string | { inlineData: { mimeType: string; data: string } } {
  if (item.mode === 'query') {
    return `task: search result | query: ${item.text ?? ''}`;
  }

  if (item.mode === 'pdf') {
    if (!item.data) throw new Error(`Fonte ${item.id} sem dados PDF.`);
    return {
      inlineData: {
        mimeType: item.mimeType || 'application/pdf',
        data: item.data,
      },
    };
  }

  return `title: ${item.title ?? 'none'} | text: ${item.text ?? ''}`;
}

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json() as { items?: EmbedRequestItem[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Lista de items vazia.' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const embeddedItems = await Promise.all(items.map(async (item) => {
      const result = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: toGeminiContent(item),
        config: {
          outputDimensionality: EMBED_DIMS,
        },
      });

      const values = result.embeddings?.[0]?.values;
      if (!values || values.length === 0) {
        throw new Error(`Embedding vazio para item ${item.id}.`);
      }

      return {
        id: item.id,
        embedding: normalizeVector(values),
      };
    }));

    return NextResponse.json(embeddedItems);
  } catch (error: unknown) {
    console.error('Embed API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return new NextResponse(message, { status: 500 });
  }
}
