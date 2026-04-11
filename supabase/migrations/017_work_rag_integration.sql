CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.work_rag_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename    text NOT NULL,
  file_type   text NOT NULL,
  source_type text NOT NULL DEFAULT 'reference',
  char_count  integer,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.work_rag_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_rag_sources'
      AND policyname = 'own_sources'
  ) THEN
    CREATE POLICY "own_sources" ON public.work_rag_sources
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.work_rag_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   uuid NOT NULL REFERENCES public.work_rag_sources(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_text  text NOT NULL,
  embedding   vector(768),
  metadata    jsonb
);

CREATE INDEX IF NOT EXISTS work_rag_chunks_embedding_idx
  ON public.work_rag_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.work_rag_chunks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_rag_chunks'
      AND policyname = 'own_chunks'
  ) THEN
    CREATE POLICY "own_chunks" ON public.work_rag_chunks
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

ALTER TABLE public.work_sessions
  ADD COLUMN IF NOT EXISTS rag_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_ficha jsonb,
  ADD COLUMN IF NOT EXISTS institution_rules text;

CREATE OR REPLACE FUNCTION public.match_rag_chunks(
  p_session_id      uuid,
  p_query_embedding vector(768),
  p_top_k           integer DEFAULT 8
)
RETURNS TABLE (
  chunk_text text,
  score      float,
  metadata   jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    chunk_text,
    1 - (embedding <=> p_query_embedding) AS score,
    metadata
  FROM public.work_rag_chunks
  WHERE session_id = p_session_id
  ORDER BY embedding <=> p_query_embedding
  LIMIT p_top_k;
$$;
