-- Migração 002: Suporte a compressão de contexto para modo TCC
-- Executar no Supabase SQL Editor após a migração 001

-- Adicionar campos de compressão à tabela existente
ALTER TABLE tcc_sessions
  ADD COLUMN IF NOT EXISTS context_summary      text,        -- resumo comprimido das secções já processadas
  ADD COLUMN IF NOT EXISTS summary_covers_up_to integer,     -- índice da última secção incluída no resumo
  ADD COLUMN IF NOT EXISTS summary_updated_at   timestamptz, -- quando foi gerado o último resumo
  ADD COLUMN IF NOT EXISTS total_tokens_estimate integer DEFAULT 0; -- estimativa acumulada de tokens usados

-- Índice para encontrar sessões que precisam de compressão
CREATE INDEX IF NOT EXISTS idx_tcc_sessions_summary
  ON tcc_sessions (status, summary_covers_up_to)
  WHERE status IN ('in_progress', 'outline_approved');

-- Comentários para documentação
COMMENT ON COLUMN tcc_sessions.context_summary IS
  'Resumo comprimido das secções já desenvolvidas, gerado pelo agente de compressão. Substitui o conteúdo completo das secções antigas no contexto enviado à IA.';

COMMENT ON COLUMN tcc_sessions.summary_covers_up_to IS
  'Índice (0-based) da última secção incluída no context_summary. As secções com index > summary_covers_up_to são enviadas completas.';

COMMENT ON COLUMN tcc_sessions.summary_updated_at IS
  'Timestamp da última geração do context_summary. Útil para invalidação e auditoria.';
