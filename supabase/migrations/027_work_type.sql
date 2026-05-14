-- ─────────────────────────────────────────────────────────────────────────────
-- Migração: adicionar coluna work_type à tabela work_sessions
-- Data: 2025-05
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Adicionar a coluna com valor padrão 'academic' para manter retrocompatibilidade.
--    Todas as sessões existentes ficam com work_type = 'academic' automaticamente.

ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT 'academic'
    CHECK (work_type IN ('academic', 'project'));

-- 2. (Opcional) Índice para filtrar por tipo no futuro.

CREATE INDEX IF NOT EXISTS idx_work_sessions_work_type
  ON work_sessions (work_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Nenhuma alteração de RLS necessária — a política existente por user_id
-- continua a funcionar sem alterações.
-- ─────────────────────────────────────────────────────────────────────────────
