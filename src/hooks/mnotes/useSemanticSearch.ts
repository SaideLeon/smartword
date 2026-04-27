import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Source } from '@/types';
import { EmbedService } from '@/services/mnotes/ai/embed-service';

export interface SemanticSearchResult {
  sourceId: string;
  sourceName: string;
  score: number;
  preview: string;
}

export function useSemanticSearch(sources: Source[], notebookId?: string) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexedCount, setIndexedCount] = useState(0);

  const lastIndexedSignatureRef = useRef<string>('');

  const activeSources = useMemo(
    () => sources.filter(source => source.selected && source.data),
    [sources],
  );

  const activeSourcesSignature = useMemo(
    () => [
      notebookId ?? 'no-notebook',
      ...activeSources.map(source => `${source.id}:${source.type}:${source.data?.length ?? 0}`),
    ].join('|'),
    [activeSources, notebookId],
  );

  const rebuildIndex = useCallback(async () => {
    if (!notebookId) {
      setError('Notebook não selecionado para indexação.');
      return;
    }

    if (activeSources.length === 0) {
      setIndexedCount(0);
      setError(null);
      return;
    }

    setIsIndexing(true);
    setError(null);

    try {
      await EmbedService.indexSources(notebookId, sources);
      setIndexedCount(activeSources.length);
      lastIndexedSignatureRef.current = activeSourcesSignature;
    } catch (indexError) {
      console.error('Erro ao indexar fontes para busca semântica:', indexError);
      setError(indexError instanceof Error ? indexError.message : 'Falha ao indexar fontes.');
    } finally {
      setIsIndexing(false);
    }
  }, [activeSources.length, activeSourcesSignature, notebookId, sources]);

  useEffect(() => {
    if (!notebookId || activeSources.length === 0) return;
    if (lastIndexedSignatureRef.current === activeSourcesSignature) return;

    const timeout = setTimeout(() => {
      void rebuildIndex();
    }, 500);

    return () => clearTimeout(timeout);
  }, [activeSources.length, activeSourcesSignature, notebookId, rebuildIndex]);

  const search = useCallback(async (nextQuery: string, topK = 5, minScore = 0.1) => {
    setQuery(nextQuery);

    if (!nextQuery.trim()) {
      setResults([]);
      setError(null);
      return [];
    }

    if (!notebookId) {
      setError('Notebook não selecionado para busca.');
      return [];
    }

    setIsSearching(true);
    setError(null);

    try {
      const ranked = await EmbedService.semanticSearch(notebookId, nextQuery.trim(), topK, minScore);
      const normalized = ranked.map(item => ({
        sourceId: item.source_id,
        sourceName: item.source_name,
        preview: item.preview ?? '',
        score: item.similarity,
      }));

      setResults(normalized);
      return normalized;
    } catch (searchError) {
      console.error('Erro na busca semântica:', searchError);
      setError(searchError instanceof Error ? searchError.message : 'Falha na busca semântica.');
      setResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [notebookId]);

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
