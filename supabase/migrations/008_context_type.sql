-- ============================================================
-- MIGRAÇÃO 008 — Muneri · context_type em tcc_sessions
-- Executar no Supabase SQL Editor após a migração 007
-- ============================================================
-- Objectivo: persistir o tipo de contextualização geográfica
-- detectado em /api/tcc/approve para que cada chamada a
-- /api/tcc/develop não recalcule e use sempre o mesmo valor.
--
-- Tabelas afectadas : tcc_sessions APENAS
-- Novas políticas RLS: NENHUMA — a política "tcc_user_access"
--   da migração 007 já protege a linha inteira; context_type
--   é apenas mais uma coluna dentro dessa linha.
-- Idempotente       : sim (seguro para executar mais de uma vez)
-- ============================================================


-- ── 1. ADICIONAR COLUNA (sem constraint ainda — backfill primeiro) ───────────

ALTER TABLE tcc_sessions
  ADD COLUMN IF NOT EXISTS context_type TEXT DEFAULT 'comparative';


-- ── 2. BACKFILL — sessões existentes ficam com 'comparative' ─────────────────
-- 'comparative' é o valor mais seguro: não força nenhum contexto,
-- apenas evita o default silencioso para Portugal.
-- Só actualiza linhas que ainda estejam NULL (idempotente).

UPDATE tcc_sessions
SET    context_type = 'comparative'
WHERE  context_type IS NULL;


-- ── 3. ADICIONAR CONSTRAINT DE VALIDAÇÃO (idempotente) ───────────────────────
-- Verifica se a constraint já existe antes de criar, para evitar
-- erro ao executar a migração mais de uma vez.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname   = 'tcc_sessions_context_type_check'
      AND  conrelid  = 'tcc_sessions'::regclass
  ) THEN
    ALTER TABLE tcc_sessions
      ADD CONSTRAINT tcc_sessions_context_type_check
      CHECK (context_type IN ('mozambique', 'universal', 'comparative'));
  END IF;
END
$$;


-- ── 4. TORNAR NOT NULL após backfill e constraint aplicados ──────────────────

ALTER TABLE tcc_sessions
  ALTER COLUMN context_type SET NOT NULL;


-- ── 5. COMENTÁRIO PARA DOCUMENTAÇÃO ─────────────────────────────────────────

COMMENT ON COLUMN tcc_sessions.context_type IS
  'Tipo de contextualização geográfica detectado automaticamente em /api/tcc/approve. '
  'Valores: ''mozambique'' (tema com âncora local clara), ''universal'' (tema científico/técnico '
  'sem geografia específica), ''comparative'' (ambíguo — instrução explícita para não defaultar '
  'para Portugal). Persistido uma vez e reutilizado em todos os develops da sessão.';


-- ── 6. VERIFICAÇÃO FINAL (executar manualmente para confirmar) ───────────────
--
-- SELECT
--   column_name,
--   data_type,
--   column_default,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name  = 'tcc_sessions'
--   AND column_name = 'context_type';
--
-- Resultado esperado:
--   column_name  | data_type | column_default | is_nullable
--   context_type | text      | 'comparative'  | NO
--
-- Para confirmar que o RLS continua correcto (sem novas políticas):
--
-- SELECT policyname, cmd, qual
-- FROM   pg_policies
-- WHERE  tablename = 'tcc_sessions';
--
-- Deve mostrar apenas as políticas da migração 007:
--   tcc_user_access  | ALL | (auth.uid() = user_id OR is_admin())
