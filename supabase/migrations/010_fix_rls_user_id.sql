-- ============================================================
-- MIGRAÇÃO 010 — Hardening de RLS (R17)
-- Garante user_id obrigatório em sessões e remove políticas permissivas.
-- ============================================================

-- Limpeza defensiva de políticas permissivas antigas
DROP POLICY IF EXISTS "allow_all_anon" ON tcc_sessions;
DROP POLICY IF EXISTS "allow_all_anon_work" ON work_sessions;

-- Arquivar sessões órfãs antes de impor NOT NULL
CREATE TABLE IF NOT EXISTS tcc_sessions_orphaned AS
SELECT * FROM tcc_sessions
WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS work_sessions_orphaned AS
SELECT * FROM work_sessions
WHERE user_id IS NULL;

DELETE FROM tcc_sessions WHERE user_id IS NULL;
DELETE FROM work_sessions WHERE user_id IS NULL;

-- Tornar user_id obrigatório e default para novos inserts autenticados
ALTER TABLE tcc_sessions
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE work_sessions
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Reforçar políticas finais
DROP POLICY IF EXISTS "tcc_user_access" ON tcc_sessions;
CREATE POLICY "tcc_user_access" ON tcc_sessions
  FOR ALL
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "work_user_access" ON work_sessions;
CREATE POLICY "work_user_access" ON work_sessions
  FOR ALL
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());
