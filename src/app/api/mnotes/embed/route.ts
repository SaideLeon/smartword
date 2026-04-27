import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase';

const EMBED_MODEL = 'gemini-embedding-2-preview';
const EMBED_DIMS = 768;

type EmbedAction = 'embed' | 'index' | 'search';

interface EmbedRequestItem {
  id: string;
  mode: 'query' | 'text' | 'pdf';
  title?: string;
  text?: string;
  mimeType?: string;
  data?: string;
  preview?: string;
}

interface SemanticSearchResult {
  source_id: string;
  source_name: string;
  preview: string | null;
  similarity: number;
}

function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? values : values.map(value => value / norm);
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada.');
  return apiKey;
}

function vectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

function toGeminiContent(item: EmbedRequestItem): string | { inlineData: { mimeType: string; data: string } } {
  if (item.mode === 'query') return `task: search result | query: ${item.text ?? ''}`;

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

async function buildEmbedding(ai: GoogleGenAI, item: EmbedRequestItem): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: toGeminiContent(item),
    config: { outputDimensionality: EMBED_DIMS },
  });

  const values = result.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error(`Embedding vazio para item ${item.id}.`);
  }

  return normalizeVector(values);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action?: EmbedAction;
      items?: EmbedRequestItem[];
      notebookId?: string;
      query?: string;
      topK?: number;
      minScore?: number;
    };

    const action = body.action ?? 'embed';
    const notebookId = body.notebookId?.trim();
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    if (action === 'search') {
      if (!notebookId || !body.query?.trim()) {
        return NextResponse.json({ error: 'notebookId e query são obrigatórios.' }, { status: 400 });
      }

      const queryEmbedding = await buildEmbedding(ai, {
        id: 'query',
        mode: 'query',
        text: body.query,
      });

      const supabase = await createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
      }

      const { data, error } = await supabase.rpc('search_mnotes_vectors', {
        p_notebook_id: notebookId,
        p_query_embedding: vectorLiteral(queryEmbedding),
        p_match_count: body.topK ?? 5,
        p_min_similarity: body.minScore ?? 0.1,
      });

      if (error) throw error;

      await supabase.from('mnotes_activity_history').insert({
        user_id: authData.user.id,
        notebook_id: notebookId,
        activity_type: 'semantic_search',
        title: body.query.trim().slice(0, 120),
      });

      return NextResponse.json((data ?? []) as SemanticSearchResult[]);
    }

    const items = body.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Lista de items vazia.' }, { status: 400 });
    }

    const embeddedItems = await Promise.all(items.map(async (item) => ({
      id: item.id,
      embedding: await buildEmbedding(ai, item),
      title: item.title ?? item.id,
      preview: item.preview ?? null,
    })));

    if (action === 'index') {
      if (!notebookId) {
        return NextResponse.json({ error: 'notebookId é obrigatório para indexação.' }, { status: 400 });
      }

      const supabase = await createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
      }

      for (const item of embeddedItems) {
        const { error } = await supabase.rpc('upsert_mnotes_vector', {
          p_notebook_id: notebookId,
          p_source_id: item.id,
          p_source_name: item.title,
          p_preview: item.preview,
          p_embedding: vectorLiteral(item.embedding),
        });

        if (error) throw error;
      }

      await supabase.from('mnotes_activity_history').insert({
        user_id: authData.user.id,
        notebook_id: notebookId,
        activity_type: 'index_updated',
        title: `${embeddedItems.length} fonte(s) indexadas`,
      });
    }

    return NextResponse.json(embeddedItems.map(({ id, embedding }) => ({ id, embedding })));
  } catch (error: unknown) {
    console.error('Embed API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return new NextResponse(message, { status: 500 });
  }
}
