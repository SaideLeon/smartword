import { useCallback, useMemo, useRef, useState } from 'react';
import { Source } from '@/types';
import { EmbedService } from '@/services/mnotes/ai/embed-service';

export interface SemanticSearchResult {
  sourceId: string;
  sourceName: string;
  score: number;
  preview: string;
}

interface IndexedSource {
  sourceId: string;
  sourceName: string;
  embedding: number[];
  preview: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function useSemanticSearch(sources: Source[]) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const indexRef = useRef<Map<string, IndexedSource>>(new Map());

  const indexedCount = useMemo(() => indexRef.current.size, [sources.length, isIndexing]);

  const rebuildIndex = useCallback(async () => {
    setIsIndexing(true);
    setError(null);

    try {
      const embeddings = await EmbedService.embedSources(sources);
      const sourceById = new Map(sources.map(source => [source.id, source]));
      const nextIndex = new Map<string, IndexedSource>();

      for (const embedded of embeddings) {
        const source = sourceById.get(embedded.sourceId);
        if (!source) continue;

        nextIndex.set(embedded.sourceId, {
          sourceId: embedded.sourceId,
          sourceName: source.name,
          embedding: embedded.embedding,
          preview: embedded.preview,
        });
      }

      indexRef.current = nextIndex;
      return nextIndex;
    } catch (indexError) {
      console.error('Erro ao indexar fontes para busca semântica:', indexError);
      setError(indexError instanceof Error ? indexError.message : 'Falha ao indexar fontes.');
      return indexRef.current;
    } finally {
      setIsIndexing(false);
    }
  }, [sources]);

  const search = useCallback(async (nextQuery: string, topK = 5, minScore = 0.1) => {
    setQuery(nextQuery);

    if (!nextQuery.trim()) {
      setResults([]);
      setError(null);
      return [];
    }

    setIsSearching(true);
    setError(null);

    try {
      let index = indexRef.current;
      if (index.size === 0) {
        index = await rebuildIndex();
      }

      if (index.size === 0) {
        setResults([]);
        return [];
      }

      const queryEmbedding = await EmbedService.embedQuery(nextQuery.trim());

      const ranked = [...index.values()]
        .map((item) => ({
          sourceId: item.sourceId,
          sourceName: item.sourceName,
          preview: item.preview,
          score: cosineSimilarity(queryEmbedding, item.embedding),
        }))
        .filter(item => item.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      setResults(ranked);
      return ranked;
    } catch (searchError) {
      console.error('Erro na busca semântica:', searchError);
      setError(searchError instanceof Error ? searchError.message : 'Falha na busca semântica.');
      setResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [rebuildIndex]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isIndexing,
    isSearching,
    error,
    indexedCount,
    rebuildIndex,
    search,
    clearSearch,
  };
}
