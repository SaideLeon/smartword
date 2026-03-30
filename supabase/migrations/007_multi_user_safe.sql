-- ============================================================
-- MIGRAÇÃO 007 — Muneri · Esquema multi-utilizador (idempotente)
-- Segura para executar mesmo que as migrações 001–006 já estejam aplicadas.
-- Executar no Supabase SQL Editor.
-- ============================================================

-- ── 1. FUNÇÃO AUXILIAR: verificar se o utilizador é admin ─────────────────────
-- Usa SECURITY DEFINER para evitar recursão infinita nas políticas de RLS.
-- A função consulta profiles sem passar pelo RLS.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- ── 2. GARANTIR COLUNAS DE user_id ────────────────────────────────────────────

ALTER TABLE tcc_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS edits_count int DEFAULT 0;

-- Campos de compressão de contexto (caso a migração 002 não tenha corrido)
ALTER TABLE tcc_sessions
  ADD COLUMN IF NOT EXISTS context_summary      text,
  ADD COLUMN IF NOT EXISTS summary_covers_up_to integer,
  ADD COLUMN IF NOT EXISTS summary_updated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS total_tokens_estimate integer DEFAULT 0;

-- Campos de pesquisa (caso a migração 004 não tenha corrido)
ALTER TABLE tcc_sessions
  ADD COLUMN IF NOT EXISTS research_keywords jsonb,
  ADD COLUMN IF NOT EXISTS research_brief    text,
  ADD COLUMN IF NOT EXISTS research_generated_at timestamptz;

ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS research_keywords jsonb,
  ADD COLUMN IF NOT EXISTS research_brief    text,
  ADD COLUMN IF NOT EXISTS research_generated_at timestamptz;

-- Dados de capa (caso a migração 005 não tenha corrido)
ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS cover_data jsonb;


-- ── 3. ÍNDICES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tcc_sessions_user
  ON tcc_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_work_sessions_user
  ON work_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_tcc_sessions_summary
  ON tcc_sessions (status, summary_covers_up_to)
  WHERE status IN ('in_progress', 'outline_approved');

CREATE INDEX IF NOT EXISTS idx_payment_history_user
  ON payment_history (user_id);

CREATE INDEX IF NOT EXISTS idx_payment_history_status
  ON payment_history (status);


-- ── 4. ACTIVAR RLS NAS TABELAS (idempotente) ──────────────────────────────────

ALTER TABLE tcc_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;


-- ── 5. REMOVER TODAS AS POLÍTICAS EXISTENTES (limpeza) ───────────────────────
-- DROP IF EXISTS garante que não falha mesmo que a política não exista.

-- tcc_sessions
DROP POLICY IF EXISTS "allow_all_anon"  ON tcc_sessions;
DROP POLICY IF EXISTS "user_own_tcc"    ON tcc_sessions;
DROP POLICY IF EXISTS "admin_all_tcc"   ON tcc_sessions;
DROP POLICY IF EXISTS "tcc_user_access" ON tcc_sessions;

-- work_sessions
DROP POLICY IF EXISTS "allow_all_anon_work" ON work_sessions;
DROP POLICY IF EXISTS "user_own_work"       ON work_sessions;
DROP POLICY IF EXISTS "admin_all_work"      ON work_sessions;
DROP POLICY IF EXISTS "work_user_access"    ON work_sessions;

-- profiles
DROP POLICY IF EXISTS "user_own_profile"   ON profiles;
DROP POLICY IF EXISTS "admin_all_profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_self"      ON profiles;
DROP POLICY IF EXISTS "profiles_admin"     ON profiles;

-- plans
DROP POLICY IF EXISTS "plans_read_all"    ON plans;
DROP POLICY IF EXISTS "plans_admin_write" ON plans;

-- payment_history
DROP POLICY IF EXISTS "user_own_payments"   ON payment_history;
DROP POLICY IF EXISTS "user_insert_payment" ON payment_history;
DROP POLICY IF EXISTS "admin_all_payments"  ON payment_history;

-- expense_items
DROP POLICY IF EXISTS "admin_only_expenses" ON expense_items;

-- monthly_reports
DROP POLICY IF EXISTS "reports_read_all"    ON monthly_reports;
DROP POLICY IF EXISTS "admin_write_reports" ON monthly_reports;


-- ── 6. RECRIAR POLÍTICAS RLS ──────────────────────────────────────────────────

-- tcc_sessions: utilizador acede apenas às suas sessões; admin acede a tudo
CREATE POLICY "tcc_user_access" ON tcc_sessions
  FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

-- work_sessions: idem
CREATE POLICY "work_user_access" ON work_sessions
  FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

-- profiles: cada utilizador vê/edita o seu próprio perfil
CREATE POLICY "profiles_self" ON profiles
  FOR ALL
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- profiles: admin acede a todos os perfis (usa is_admin() para evitar recursão)
CREATE POLICY "profiles_admin" ON profiles
  FOR ALL
  USING  (is_admin());

-- plans: leitura pública; escrita apenas para admin
CREATE POLICY "plans_read_all" ON plans
  FOR SELECT USING (true);

CREATE POLICY "plans_admin_write" ON plans
  FOR ALL USING (is_admin());

-- payment_history: utilizador vê/insere os seus; admin acede a tudo
CREATE POLICY "payments_user_select" ON payment_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "payments_user_insert" ON payment_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "payments_admin_all" ON payment_history
  FOR ALL USING (is_admin());

-- expense_items: apenas admin
CREATE POLICY "expenses_admin_only" ON expense_items
  FOR ALL USING (is_admin());

-- monthly_reports: leitura pública; escrita apenas admin
CREATE POLICY "reports_read_all" ON monthly_reports
  FOR SELECT USING (true);

CREATE POLICY "reports_admin_write" ON monthly_reports
  FOR ALL USING (is_admin());


-- ── 7. FUNÇÃO DE RELATÓRIO (idempotente via CREATE OR REPLACE) ────────────────

CREATE OR REPLACE FUNCTION generate_monthly_report(
  p_month int,
  p_year  int,
  p_rate  numeric DEFAULT 64.05
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id         uuid := gen_random_uuid();
  v_revenue    numeric(12,2);
  v_expenses   numeric(12,2);
  v_total_subs int;
  v_active     int;
  v_free       int;
  v_avulso     int;
BEGIN
  SELECT
    COALESCE(SUM(amount_mzn), 0),
    COUNT(DISTINCT user_id),
    COUNT(*) FILTER (WHERE plan_key = 'avulso')
  INTO v_revenue, v_active, v_avulso
  FROM payment_history
  WHERE status = 'confirmed'
    AND EXTRACT(MONTH FROM confirmed_at) = p_month
    AND EXTRACT(YEAR  FROM confirmed_at) = p_year;

  SELECT COALESCE(SUM(amount_mzn), 0)
  INTO v_expenses
  FROM expense_items
  WHERE period_month = p_month AND period_year = p_year;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE plan_key = 'free')
  INTO v_total_subs, v_free
  FROM profiles;

  INSERT INTO monthly_reports (
    id, period_month, period_year,
    total_subscribers, active_subscribers, free_users, avulso_payments,
    revenue_mzn, total_expenses_mzn, net_margin_mzn, margin_pct, exchange_rate_used
  ) VALUES (
    v_id, p_month, p_year,
    v_total_subs, v_active, v_free, v_avulso,
    v_revenue, v_expenses,
    v_revenue - v_expenses,
    CASE WHEN v_revenue > 0
      THEN ROUND(((v_revenue - v_expenses) / v_revenue) * 100, 2)
      ELSE 0
    END,
    p_rate
  )
  ON CONFLICT (period_month, period_year) DO UPDATE SET
    total_subscribers  = EXCLUDED.total_subscribers,
    active_subscribers = EXCLUDED.active_subscribers,
    free_users         = EXCLUDED.free_users,
    avulso_payments    = EXCLUDED.avulso_payments,
    revenue_mzn        = EXCLUDED.revenue_mzn,
    total_expenses_mzn = EXCLUDED.total_expenses_mzn,
    net_margin_mzn     = EXCLUDED.net_margin_mzn,
    margin_pct         = EXCLUDED.margin_pct,
    generated_at       = now();

  RETURN v_id;
END;
$$;


-- ── 8. SEED DOS PLANOS (idempotente) ──────────────────────────────────────────
-- Garante que os planos existem mesmo que a migração 006 não tenha corrido.

INSERT INTO plans (
  key, label, price_usd, price_mzn,
  works_limit, tcc_enabled, ai_chat_enabled, cover_enabled,
  export_full, edits_limit, duration_months
) VALUES
  ('free',    'Gratuito',    0,     0,    20,   false, false, false, false, NULL, 1),
  ('avulso',  'Avulso',      0,    50,     1,   false, false, true,  true,  2,    0),
  ('basico',  'Básico',   4.99,   320,     5,   false, true,  true,  true,  2,    1),
  ('standard','Standard', 7.99,   512,  NULL,   false, true,  true,  true,  NULL, 1),
  ('pro',     'Pro',      9.99,   640,  NULL,   true,  true,  true,  true,  NULL, 1),
  ('premium', 'Premium', 14.99,   960,  NULL,   true,  true,  true,  true,  NULL, 1)
ON CONFLICT (key) DO NOTHING;

UPDATE plans
SET
  works_limit = 5,
  edits_limit = 2,
  tcc_enabled = false,
  ai_chat_enabled = true,
  cover_enabled = true,
  export_full = true,
  updated_at = now()
WHERE key = 'basico';


-- ── 9. VERIFICAÇÃO FINAL ──────────────────────────────────────────────────────
-- Confirma que as políticas foram criadas correctamente.
-- Executar manualmente para validar:
--
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('tcc_sessions','work_sessions','profiles','plans','payment_history')
-- ORDER BY tablename, policyname;
