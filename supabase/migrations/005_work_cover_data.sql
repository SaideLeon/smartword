-- Migração 005: Persistência de dados de capa no modo Trabalho Escolar
-- Executar no Supabase SQL Editor após a migração 004

ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS cover_data jsonb;

COMMENT ON COLUMN work_sessions.cover_data IS
  'Dados da capa e contracapa (CoverData) gerados pelo utilizador, incluindo o abstract. '
  'Persistidos para que a capa seja restaurada automaticamente ao retomar a sessão.';
