-- ============================================================
-- MIGRAÇÃO 006 — Muneri · Auth + Planos + Pagamentos + Admin
-- Executar no Supabase SQL Editor (após migrações 001–005)
-- ============================================================

-- ── 1. TABELA DE PLANOS ───────────────────────────────────────
-- Define os planos disponíveis. Gerida pelo admin.
CREATE TABLE IF NOT EXISTS plans (
  key              text PRIMARY KEY,          -- 'free' | 'avulso' | 'basico' | 'pro' | 'premium'
  label            text NOT NULL,             -- "Plano Básico"
  price_usd        numeric(8,2) DEFAULT 0,    -- preço em USD (0 para free e avulso)
  price_mzn        numeric(10,2) NOT NULL,    -- preço em Meticais
  works_limit      int DEFAULT 20,            -- null = ilimitado
  tcc_enabled      boolean DEFAULT false,
  ai_chat_enabled  boolean DEFAULT false,
  cover_enabled    boolean DEFAULT false,
  export_full      boolean DEFAULT false,     -- false = exportação cortada ao meio
  edits_limit      int DEFAULT NULL,          -- null = ilimitado; avulso = 2
  duration_months  int DEFAULT 1,             -- 0 = por obra (avulso)
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Seed dos planos iniciais (baseado no ficheiro de precificação)
INSERT INTO plans (key, label, price_usd, price_mzn, works_limit, tcc_enabled, ai_chat_enabled, cover_enabled, export_full, edits_limit, duration_months)
VALUES
  ('free',    'Gratuito',   0,     0,      20,   false, false, false, false, NULL, 1),
  ('avulso',  'Avulso',     0,    50,       1,   false, false, true,  true,  2,    0),
  ('basico',  'Básico',     4.99, 320,   NULL,   false, true,  false, true,  NULL, 1),
  ('standard','Standard',   7.99, 512,   NULL,   false, true,  true,  true,  NULL, 1),
  ('pro',     'Pro',        9.99, 640,   NULL,   true,  true,  true,  true,  NULL, 1),
  ('premium', 'Premium',   14.99, 960,   NULL,   true,  true,  true,  true,  NULL, 1)
ON CONFLICT (key) DO NOTHING;

-- ── 2. TABELA DE PERFIS ───────────────────────────────────────
-- Espelha auth.users com dados da aplicação.
-- Criado automaticamente via trigger ao registar utilizador.
CREATE TABLE IF NOT EXISTS profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  email               text,
  full_name           text,
  avatar_url          text,
  role                text DEFAULT 'user' CHECK (role IN ('user', 'admin')),

  -- Plano activo
  plan_key            text DEFAULT 'free' REFERENCES plans(key),
  plan_expires_at     timestamptz,

  -- Pagamento
  transaction_id      text,
  payment_method      text CHECK (payment_method IN ('mpesa', 'emola', 'bank_transfer', 'card', NULL)),
  payment_status      text DEFAULT 'none'
                      CHECK (payment_status IN ('none', 'pending', 'active', 'expired', 'cancelled')),
  payment_verified_at timestamptz,
  payment_verified_by uuid,                   -- uuid do admin que confirmou

  -- Contadores de uso (para free e avulso)
  works_used          int DEFAULT 0,           -- trabalhos gerados no mês
  edits_used          int DEFAULT 0,           -- edições da sessão avulso
  usage_reset_at      timestamptz DEFAULT date_trunc('month', now()) + interval '1 month'
);

-- Trigger: criar perfil automaticamente quando utilizador se regista
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: updated_at em profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 3. HISTÓRICO DE PAGAMENTOS ────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_key        text NOT NULL REFERENCES plans(key),
  transaction_id  text NOT NULL,
  amount_mzn      numeric(10,2) NOT NULL,
  payment_method  text CHECK (payment_method IN ('mpesa', 'emola', 'bank_transfer', 'card')),
  period_months   int DEFAULT 1,           -- 0 = avulso (por obra)
  status          text DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'rejected')),
  notes           text,
  confirmed_by    uuid REFERENCES profiles(id),
  confirmed_at    timestamptz,
  work_session_id uuid,                    -- para plano avulso: liga à sessão específica
  tcc_session_id  uuid                     -- para plano avulso: liga à sessão TCC
);

CREATE INDEX ON payment_history(user_id);
CREATE INDEX ON payment_history(status);
CREATE INDEX ON payment_history(transaction_id);

CREATE TRIGGER payment_history_updated_at
  BEFORE UPDATE ON payment_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 4. ITENS DE DESPESA (Painel Admin) ───────────────────────
-- Admin define manualmente os custos mensais.
CREATE TABLE IF NOT EXISTS expense_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  created_by   uuid NOT NULL REFERENCES profiles(id),
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year  int NOT NULL,
  category     text NOT NULL
               CHECK (category IN ('groq_api', 'supabase', 'hosting', 'domain', 'other')),
  description  text NOT NULL,
  amount_mzn   numeric(10,2) NOT NULL,
  exchange_rate numeric(10,4),            -- taxa USD→MZN usada (opcional)
  amount_usd   numeric(10,2),             -- valor original em USD (opcional)
  notes        text
);

CREATE INDEX ON expense_items(period_year, period_month);

CREATE TRIGGER expense_items_updated_at
  BEFORE UPDATE ON expense_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 5. RELATÓRIOS MENSAIS (calculados pelo admin) ─────────────
CREATE TABLE IF NOT EXISTS monthly_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at        timestamptz DEFAULT now(),
  generated_by        uuid REFERENCES profiles(id),
  period_month        int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year         int NOT NULL,
  total_subscribers   int DEFAULT 0,
  active_subscribers  int DEFAULT 0,
  free_users          int DEFAULT 0,
  avulso_payments     int DEFAULT 0,
  revenue_mzn         numeric(12,2) DEFAULT 0,
  total_expenses_mzn  numeric(12,2) DEFAULT 0,
  net_margin_mzn      numeric(12,2) DEFAULT 0,
  margin_pct          numeric(6,2) DEFAULT 0,
  exchange_rate_used  numeric(10,4),
  UNIQUE (period_month, period_year)
);

-- ── 6. ADICIONAR user_id ÀS TABELAS EXISTENTES ───────────────
ALTER TABLE tcc_sessions  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS edits_count int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tcc_sessions_user  ON tcc_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user ON work_sessions(user_id);

-- ── 7. FUNÇÃO DE CÁLCULO DO RELATÓRIO ────────────────────────
-- Chamada pelo admin para gerar o relatório de um mês.
CREATE OR REPLACE FUNCTION generate_monthly_report(p_month int, p_year int, p_rate numeric DEFAULT 64.05)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id         uuid := gen_random_uuid();
  v_revenue    numeric(12,2);
  v_expenses   numeric(12,2);
  v_total_subs int;
  v_active     int;
  v_free       int;
  v_avulso     int;
BEGIN
  -- Receita: pagamentos confirmados no mês
  SELECT
    COALESCE(SUM(amount_mzn), 0),
    COUNT(DISTINCT user_id),
    COUNT(*) FILTER (WHERE plan_key = 'avulso')
  INTO v_revenue, v_active, v_avulso
  FROM payment_history
  WHERE status = 'confirmed'
    AND EXTRACT(MONTH FROM confirmed_at) = p_month
    AND EXTRACT(YEAR  FROM confirmed_at) = p_year;

  -- Despesas do mês
  SELECT COALESCE(SUM(amount_mzn), 0)
  INTO v_expenses
  FROM expense_items
  WHERE period_month = p_month AND period_year = p_year;

  -- Utilizadores totais e free
  SELECT COUNT(*), COUNT(*) FILTER (WHERE plan_key = 'free')
  INTO v_total_subs, v_free
  FROM profiles;

  INSERT INTO monthly_reports (
    id, period_month, period_year,
    total_subscribers, active_subscribers, free_users, avulso_payments,
    revenue_mzn, total_expenses_mzn,
    net_margin_mzn, margin_pct, exchange_rate_used
  ) VALUES (
    v_id, p_month, p_year,
    v_total_subs, v_active, v_free, v_avulso,
    v_revenue, v_expenses,
    v_revenue - v_expenses,
    CASE WHEN v_revenue > 0 THEN ROUND(((v_revenue - v_expenses) / v_revenue) * 100, 2) ELSE 0 END,
    p_rate
  )
  ON CONFLICT (period_month, period_year)
  DO UPDATE SET
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

-- ── 8. FUNÇÃO: VALIDAR ACESSO DO UTILIZADOR ──────────────────
-- Retorna true se o utilizador tem acesso à funcionalidade.
CREATE OR REPLACE FUNCTION check_user_access(
  p_user_id uuid,
  p_feature text  -- 'export_full' | 'tcc' | 'ai_chat' | 'cover' | 'create_work'
)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_plan    plans%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_plan FROM plans WHERE key = v_profile.plan_key;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Plano expirado → degradar para free
  IF v_plan.duration_months > 0 AND v_profile.plan_expires_at < now() THEN
    RETURN p_feature IN ('create_work') AND v_profile.works_used < 20;
  END IF;

  CASE p_feature
    WHEN 'create_work' THEN
      IF v_plan.works_limit IS NULL THEN RETURN true; END IF;
      RETURN v_profile.works_used < v_plan.works_limit;
    WHEN 'export_full'  THEN RETURN v_plan.export_full;
    WHEN 'tcc'          THEN RETURN v_plan.tcc_enabled;
    WHEN 'ai_chat'      THEN RETURN v_plan.ai_chat_enabled;
    WHEN 'cover'        THEN RETURN v_plan.cover_enabled;
    ELSE RETURN false;
  END CASE;
END;
$$;

-- ── 9. ROW LEVEL SECURITY ─────────────────────────────────────

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_profile"    ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "admin_all_profiles"  ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- plans: todos lêem, só admin escreve
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_read_all"    ON plans FOR SELECT USING (true);
CREATE POLICY "plans_admin_write" ON plans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- payment_history: utilizador vê o seu, admin vê tudo
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_payments"  ON payment_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_insert_payment" ON payment_history FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_all_payments" ON payment_history FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- expense_items: só admin
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_expenses" ON expense_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- monthly_reports: só admin escreve, todos lêem (transparência)
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_read_all"    ON monthly_reports FOR SELECT USING (true);
CREATE POLICY "admin_write_reports" ON monthly_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- tcc_sessions: isolamento por utilizador
DROP POLICY IF EXISTS "allow_all_anon" ON tcc_sessions;
ALTER TABLE tcc_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_tcc" ON tcc_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "admin_all_tcc" ON tcc_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- work_sessions: isolamento por utilizador
DROP POLICY IF EXISTS "allow_all_anon_work" ON work_sessions;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_work" ON work_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "admin_all_work" ON work_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
