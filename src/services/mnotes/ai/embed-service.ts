'use client';

import { Source } from '@/types';

export type EmbeddingMode = 'query' | 'text' | 'pdf';

export interface EmbedRequestItem {
  id: string;
  mode: EmbeddingMode;
  title?: string;
  text?: string;
  mimeType?: string;
  data?: string;
  preview?: string;
}

export interface EmbedResponseItem {
  id: string;
  embedding: number[];
}

export interface SemanticSearchResponseItem {
  source_id: string;
  source_name: string;
  preview: string | null;
  similarity: number;
}

function decodeBase64Utf8(base64: string): string {
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return atob(base64);
  }
}

async function postEmbeddings(body: Record<string, unknown>): Promise<Response> {
  return fetch('/api/mnotes/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function sourcePreview(source: Source): string {
  if (source.type === 'text' && source.data) {
    return decodeBase64Utf8(source.data).slice(0, 220);
  }
  return `Documento PDF: ${source.name}`;
}

export const EmbedService = {
  async embedQuery(query: string): Promise<number[]> {
    const response = await postEmbeddings({
      action: 'embed',
      items: [{ id: 'query', mode: 'query', text: query }],
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Falha ao gerar embedding da query.');
    }

    const items = await response.json() as EmbedResponseItem[];
    return items[0]?.embedding ?? [];
  },

  async indexSources(notebookId: string, sources: Source[]): Promise<void> {
    const activeSources = sources.filter(source => source.selected && source.data);
    if (activeSources.length === 0) return;

    const items: EmbedRequestItem[] = activeSources.map(source => {
      if (source.type === 'pdf') {
        return {
          id: source.id,
          mode: 'pdf',
          title: source.name,
          mimeType: 'application/pdf',
          data: source.data,
          preview: sourcePreview(source),
        };
      }

      return {
        id: source.id,
        mode: 'text',
        title: source.name,
        text: decodeBase64Utf8(source.data!),
        preview: sourcePreview(source),
      };
    });

    const response = await postEmbeddings({
      action: 'index',
      notebookId,
      items,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Falha ao indexar fontes no Supabase.');
    }
  },

  async semanticSearch(notebookId: string, query: string, topK = 5, minScore = 0.1): Promise<SemanticSearchResponseItem[]> {
    const response = await postEmbeddings({
      action: 'search',
      notebookId,
      query,
      topK,
      minScore,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Falha na busca semântica.');
    }

    return response.json();
  },
};
