CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.mnotes_source_vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id text NOT NULL,
  source_id text NOT NULL,
  source_name text NOT NULL,
  preview text,
  embedding vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, notebook_id, source_id)
);

CREATE INDEX IF NOT EXISTS mnotes_source_vectors_user_notebook_idx
  ON public.mnotes_source_vectors (user_id, notebook_id);

CREATE INDEX IF NOT EXISTS mnotes_source_vectors_embedding_idx
  ON public.mnotes_source_vectors
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS public.mnotes_activity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id text,
  activity_type text NOT NULL,
  title text NOT NULL,
  metadata text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS mnotes_activity_history_user_created_idx
  ON public.mnotes_activity_history (user_id, created_at DESC);

ALTER TABLE public.mnotes_source_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnotes_activity_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own mnotes vectors" ON public.mnotes_source_vectors;
CREATE POLICY "Users can read own mnotes vectors"
  ON public.mnotes_source_vectors
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own mnotes vectors" ON public.mnotes_source_vectors;
CREATE POLICY "Users can insert own mnotes vectors"
  ON public.mnotes_source_vectors
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own mnotes vectors" ON public.mnotes_source_vectors;
CREATE POLICY "Users can update own mnotes vectors"
  ON public.mnotes_source_vectors
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own mnotes vectors" ON public.mnotes_source_vectors;
CREATE POLICY "Users can delete own mnotes vectors"
  ON public.mnotes_source_vectors
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own mnotes history" ON public.mnotes_activity_history;
CREATE POLICY "Users can read own mnotes history"
  ON public.mnotes_activity_history
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own mnotes history" ON public.mnotes_activity_history;
CREATE POLICY "Users can insert own mnotes history"
  ON public.mnotes_activity_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.upsert_mnotes_vector(
  p_notebook_id text,
  p_source_id text,
  p_source_name text,
  p_preview text,
  p_embedding vector(768)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utilizador não autenticado';
  END IF;

  INSERT INTO public.mnotes_source_vectors (
    user_id,
    notebook_id,
    source_id,
    source_name,
    preview,
    embedding,
    updated_at
  ) VALUES (
    auth.uid(),
    p_notebook_id,
    p_source_id,
    p_source_name,
    p_preview,
    p_embedding,
    timezone('utc', now())
  )
  ON CONFLICT (user_id, notebook_id, source_id)
  DO UPDATE SET
    source_name = EXCLUDED.source_name,
    preview = EXCLUDED.preview,
    embedding = EXCLUDED.embedding,
    updated_at = timezone('utc', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_mnotes_vector(text, text, text, text, vector) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_mnotes_vectors(
  p_notebook_id text,
  p_query_embedding vector(768),
  p_match_count integer DEFAULT 5,
  p_min_similarity double precision DEFAULT 0.10
)
RETURNS TABLE (
  source_id text,
  source_name text,
  preview text,
  similarity double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.source_id,
    v.source_name,
    v.preview,
    1 - (v.embedding <=> p_query_embedding) AS similarity
  FROM public.mnotes_source_vectors v
  WHERE v.user_id = auth.uid()
    AND v.notebook_id = p_notebook_id
    AND (1 - (v.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY v.embedding <=> p_query_embedding
  LIMIT GREATEST(p_match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.search_mnotes_vectors(text, vector, integer, double precision) TO authenticated;
