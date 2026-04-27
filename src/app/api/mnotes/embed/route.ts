import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { geminiEmbedDocument, geminiEmbedMultimodal, geminiEmbedQuery } from '@/lib/gemini-resilient';

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

function vectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

async function buildEmbedding(item: EmbedRequestItem): Promise<number[]> {
  if (item.mode === 'query') {
    return geminiEmbedQuery(item.text ?? '');
  }

  if (item.mode === 'pdf') {
    if (!item.data) throw new Error(`Fonte ${item.id} sem dados PDF.`);
    return geminiEmbedMultimodal({
      inlineData: {
        mimeType: item.mimeType || 'application/pdf',
        data: item.data,
      },
    });
  }

  return geminiEmbedDocument(item.text ?? '', item.title ?? 'none');
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
    if (action === 'search') {
      if (!notebookId || !body.query?.trim()) {
        return NextResponse.json({ error: 'notebookId e query são obrigatórios.' }, { status: 400 });
      }

      const queryEmbedding = await buildEmbedding({
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
      embedding: await buildEmbedding(item),
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
