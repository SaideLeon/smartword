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
}

export interface EmbedResponseItem {
  id: string;
  embedding: number[];
}

function decodeBase64Utf8(base64: string): string {
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return atob(base64);
  }
}

async function postEmbeddings(items: EmbedRequestItem[]): Promise<EmbedResponseItem[]> {
  const response = await fetch('/api/mnotes/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Falha ao gerar embeddings.');
  }

  return response.json();
}

export const EmbedService = {
  async embedQuery(query: string): Promise<number[]> {
    const items = await postEmbeddings([
      {
        id: 'query',
        mode: 'query',
        text: query,
      },
    ]);

    return items[0]?.embedding ?? [];
  },

  async embedSources(sources: Source[]): Promise<Array<EmbedResponseItem & { sourceId: string; preview: string }>> {
    const activeSources = sources.filter(source => source.selected && source.data);

    if (activeSources.length === 0) return [];

    const payload: EmbedRequestItem[] = activeSources.map(source => {
      if (source.type === 'pdf') {
        return {
          id: source.id,
          mode: 'pdf',
          title: source.name,
          mimeType: 'application/pdf',
          data: source.data,
        };
      }

      const text = decodeBase64Utf8(source.data!);
      return {
        id: source.id,
        mode: 'text',
        title: source.name,
        text,
      };
    });

    const response = await postEmbeddings(payload);
    const sourceById = new Map(activeSources.map(source => [source.id, source]));

    return response.map(item => {
      const source = sourceById.get(item.id);
      const preview = source?.type === 'text' && source.data
        ? decodeBase64Utf8(source.data).slice(0, 220)
        : `Documento PDF: ${source?.name ?? 'sem nome'}`;

      return {
        ...item,
        sourceId: item.id,
        preview,
      };
    });
  },
};
