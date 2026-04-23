-- ============================================================
-- MIGRAÇÃO 021 — Muneri · Sistema de Afiliados
--
-- REGRAS DE NEGÓCIO:
--   • Cada utilizador autenticado pode gerar um código de afiliado único
--   • O link de convite é: https://muneri.nativespeak.app/auth/signup?ref=CODIGO
--   • Ao registar via link, o novo utilizador fica associado ao afiliado
--   • Comissão: 40% de cada pagamento CONFIRMADO do utilizador referenciado
--   • A comissão é calculada atomicamente junto com a confirmação do pagamento
--   • Sem duplicação: um utilizador só pode ter UM afiliado (o primeiro que o convidou)
--   • O afiliado não ganha comissão sobre os próprios pagamentos
-- ============================================================


-- ── 1. TABELA: affiliates ─────────────────────────────────────────────────────
-- Registo de afiliados e os seus códigos únicos

CREATE TABLE IF NOT EXISTS affiliates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  code           text NOT NULL UNIQUE,          -- código único alfanumérico (8 chars)
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended', 'banned')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Estatísticas denormalizadas (actualizadas por trigger) — evita queries pesadas no dashboard
  total_referrals     integer NOT NULL DEFAULT 0,   -- utilizadores convidados
  total_conversions   integer NOT NULL DEFAULT 0,   -- convidados que pagaram
  total_earned_mzn    numeric(12,2) NOT NULL DEFAULT 0,  -- ganhos totais confirmados
  pending_payout_mzn  numeric(12,2) NOT NULL DEFAULT 0,  -- comissões ainda não pagas ao afiliado
  paid_out_mzn        numeric(12,2) NOT NULL DEFAULT 0   -- total já transferido ao afiliado
);

COMMENT ON TABLE affiliates IS
  'Perfil de afiliado. Um utilizador pode ter apenas um código de afiliado.';

COMMENT ON COLUMN affiliates.code IS
  'Código único de 8 caracteres alfanuméricos. Usado no link de convite.';


-- ── 2. TABELA: affiliate_referrals ───────────────────────────────────────────
-- Relação entre afiliado e utilizadores que se registaram pelo link

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  registered_at    timestamptz NOT NULL DEFAULT now(),
  converted_at     timestamptz,                 -- data do primeiro pagamento confirmado
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'converted', 'invalid'))
);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON affiliate_referrals(referred_user_id);

COMMENT ON TABLE affiliate_referrals IS
  'Regista quem se registou através do link de um afiliado.
   Um utilizador só pode ter UM afiliado (UNIQUE em referred_user_id).';


-- ── 3. TABELA: affiliate_commissions ─────────────────────────────────────────
-- Uma comissão por pagamento confirmado do utilizador referenciado

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id      uuid NOT NULL REFERENCES affiliate_referrals(id) ON DELETE CASCADE,
  payment_id       uuid NOT NULL UNIQUE REFERENCES payment_history(id) ON DELETE CASCADE,
  payment_amount_mzn  numeric(10,2) NOT NULL,
  commission_rate  numeric(5,4) NOT NULL DEFAULT 0.40,  -- 40%
  commission_mzn   numeric(10,2) NOT NULL,              -- calculada: payment_amount * rate
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  paid_at          timestamptz,
  notes            text
);

CREATE INDEX IF NOT EXISTS idx_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_referral  ON affiliate_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_commissions_payment   ON affiliate_commissions(payment_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status    ON affiliate_commissions(status);

COMMENT ON TABLE affiliate_commissions IS
  'Uma linha por pagamento confirmado que gerou comissão.
   UNIQUE em payment_id garante que não há comissão duplicada por pagamento.';


-- ── 4. TABELA: affiliate_payouts ──────────────────────────────────────────────
-- Registo de pagamentos feitos pelo admin ao afiliado (saque das comissões)

CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id   uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_mzn     numeric(10,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'mpesa'
                 CHECK (payment_method IN ('mpesa', 'emola', 'bank_transfer')),
  transaction_ref text,                          -- referência da transferência
  processed_by   uuid REFERENCES profiles(id),  -- admin que processou
  processed_at   timestamptz NOT NULL DEFAULT now(),
  notes          text
);

CREATE INDEX IF NOT EXISTS idx_payouts_affiliate ON affiliate_payouts(affiliate_id);

COMMENT ON TABLE affiliate_payouts IS
  'Histórico de transferências de comissões do afiliado.
   Processado manualmente pelo admin via painel.';


-- ── 5. TRIGGER: updated_at para affiliates ───────────────────────────────────

CREATE TRIGGER affiliates_updated_at
  BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 6. FUNÇÃO: gerar código único de afiliado ─────────────────────────────────
-- Cria ou devolve o código existente do utilizador autenticado

CREATE OR REPLACE FUNCTION get_or_create_affiliate_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code      text;
  v_existing  text;
  v_attempts  int := 0;
BEGIN
  -- Verificar se já existe
  SELECT code INTO v_existing
  FROM affiliates
  WHERE user_id = p_user_id;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Gerar código único de 8 caracteres (alfanumérico, maiúsculas)
  LOOP
    v_code := upper(substring(encode(gen_random_bytes(6), 'base64'), 1, 8));
    -- Remover caracteres problemáticos (+, /, =)
    v_code := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');
    -- Garantir 8 chars (pode ser menos após remoção)
    IF length(v_code) < 6 THEN
      v_attempts := v_attempts + 1;
      IF v_attempts > 20 THEN
        RAISE EXCEPTION 'Falha ao gerar código único após 20 tentativas';
      END IF;
      CONTINUE;
    END IF;
    v_code := left(v_code, 8);

    -- Verificar unicidade
    EXIT WHEN NOT EXISTS (SELECT 1 FROM affiliates WHERE code = v_code);

    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Falha ao gerar código único após 20 tentativas';
    END IF;
  END LOOP;

  -- Inserir novo afiliado
  INSERT INTO affiliates (user_id, code)
  VALUES (p_user_id, v_code);

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_affiliate_code(uuid) TO authenticated;


-- ── 7. FUNÇÃO: registar referência no signup ──────────────────────────────────
-- Chamada quando um novo utilizador se regista com ?ref=CODIGO

CREATE OR REPLACE FUNCTION register_affiliate_referral(
  p_new_user_id uuid,
  p_affiliate_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate affiliates%ROWTYPE;
BEGIN
  -- Validar código
  SELECT * INTO v_affiliate
  FROM affiliates
  WHERE code = upper(trim(p_affiliate_code))
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN false;  -- código inválido ou afiliado suspenso
  END IF;

  -- Não pode ser o próprio afiliado
  IF v_affiliate.user_id = p_new_user_id THEN
    RETURN false;
  END IF;

  -- Verificar se já tem afiliado (UNIQUE em referred_user_id garante isto,
  -- mas tratamos o erro graciosamente)
  IF EXISTS (
    SELECT 1 FROM affiliate_referrals WHERE referred_user_id = p_new_user_id
  ) THEN
    RETURN false;
  END IF;

  -- Registar referência
  INSERT INTO affiliate_referrals (affiliate_id, referred_user_id)
  VALUES (v_affiliate.id, p_new_user_id);

  -- Actualizar contador de referências do afiliado
  UPDATE affiliates
  SET total_referrals = total_referrals + 1
  WHERE id = v_affiliate.id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION register_affiliate_referral(uuid, text) TO authenticated;


-- ── 8. FUNÇÃO: calcular comissão após pagamento confirmado ────────────────────
-- Chamada atomicamente dentro de confirm_payment

CREATE OR REPLACE FUNCTION calculate_affiliate_commission(
  p_payment_id uuid,
  p_user_id uuid,
  p_amount_mzn numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral     affiliate_referrals%ROWTYPE;
  v_commission   numeric(10,2);
  v_rate         numeric(5,4) := 0.40;
BEGIN
  -- Verificar se este utilizador foi referenciado por um afiliado
  SELECT * INTO v_referral
  FROM affiliate_referrals
  WHERE referred_user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;  -- utilizador não foi convidado por afiliado
  END IF;

  -- Verificar se o afiliado está activo
  IF NOT EXISTS (
    SELECT 1 FROM affiliates
    WHERE id = v_referral.affiliate_id AND status = 'active'
  ) THEN
    RETURN false;
  END IF;

  -- Calcular comissão (40%)
  v_commission := round(p_amount_mzn * v_rate, 2);

  -- Inserir comissão (UNIQUE em payment_id evita duplicação)
  INSERT INTO affiliate_commissions (
    affiliate_id, referral_id, payment_id,
    payment_amount_mzn, commission_rate, commission_mzn
  ) VALUES (
    v_referral.affiliate_id, v_referral.id, p_payment_id,
    p_amount_mzn, v_rate, v_commission
  )
  ON CONFLICT (payment_id) DO NOTHING;

  -- Se inseriu (não foi duplicata), actualizar totais do afiliado
  IF FOUND THEN
    UPDATE affiliates
    SET
      total_earned_mzn   = total_earned_mzn + v_commission,
      pending_payout_mzn = pending_payout_mzn + v_commission
    WHERE id = v_referral.affiliate_id;

    -- Marcar referência como convertida (primeira conversão)
    IF v_referral.status = 'pending' THEN
      UPDATE affiliate_referrals
      SET
        status = 'converted',
        converted_at = now()
      WHERE id = v_referral.id;

      UPDATE affiliates
      SET total_conversions = total_conversions + 1
      WHERE id = v_referral.affiliate_id;
    END IF;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_affiliate_commission(uuid, uuid, numeric) TO authenticated;


-- ── 9. ACTUALIZAR confirm_payment para incluir comissão ───────────────────────
-- Substitui a função da migração 013, adicionando o cálculo de comissão

CREATE OR REPLACE FUNCTION confirm_payment(
  p_payment_id uuid,
  p_admin_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment      payment_history%ROWTYPE;
  v_plan         plans%ROWTYPE;
  v_new_status   text;
  v_expires      timestamptz;
  v_commission   boolean;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'P0001';
  END IF;

  IF p_action NOT IN ('confirm', 'reject') THEN
    RAISE EXCEPTION 'Acção inválida' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_payment
  FROM payment_history
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado' USING ERRCODE = 'P0003';
  END IF;

  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Pagamento já foi processado: %', v_payment.status USING ERRCODE = 'P0004';
  END IF;

  v_new_status := CASE p_action WHEN 'confirm' THEN 'confirmed' ELSE 'rejected' END;

  UPDATE payment_history
  SET
    status       = v_new_status,
    confirmed_by = p_admin_id,
    confirmed_at = now(),
    notes        = p_notes,
    updated_at   = now()
  WHERE id = p_payment_id;

  IF p_action = 'confirm' THEN
    SELECT * INTO v_plan FROM plans WHERE key = v_payment.plan_key;

    IF v_plan.duration_months > 0 THEN
      v_expires := now() + make_interval(months => v_plan.duration_months);
    ELSE
      v_expires := NULL;
    END IF;

    UPDATE profiles
    SET
      plan_key            = v_payment.plan_key,
      plan_expires_at     = v_expires,
      payment_status      = 'active',
      payment_verified_at = now(),
      payment_verified_by = p_admin_id,
      works_used          = 0,
      edits_used          = 0,
      updated_at          = now()
    WHERE id = v_payment.user_id;

    -- ✅ NOVO: calcular comissão de afiliado atomicamente
    PERFORM calculate_affiliate_commission(
      p_payment_id,
      v_payment.user_id,
      v_payment.amount_mzn
    );

  ELSE
    UPDATE profiles
    SET payment_status = 'none', updated_at = now()
    WHERE id = v_payment.user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_payment(uuid, uuid, text, text) TO authenticated;


-- ── 10. FUNÇÃO: processar payout (admin paga ao afiliado) ─────────────────────

CREATE OR REPLACE FUNCTION process_affiliate_payout(
  p_affiliate_id uuid,
  p_amount_mzn numeric,
  p_payment_method text,
  p_transaction_ref text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout_id        uuid;
  v_pending_balance  numeric(10,2);
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'P0001';
  END IF;

  -- Verificar saldo disponível
  SELECT pending_payout_mzn INTO v_pending_balance
  FROM affiliates
  WHERE id = p_affiliate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Afiliado não encontrado' USING ERRCODE = 'P0003';
  END IF;

  IF p_amount_mzn > v_pending_balance THEN
    RAISE EXCEPTION 'Valor superior ao saldo pendente (%.2f MZN disponível)', v_pending_balance
      USING ERRCODE = 'P0005';
  END IF;

  -- Registar payout
  INSERT INTO affiliate_payouts (
    affiliate_id, amount_mzn, payment_method,
    transaction_ref, processed_by, notes
  ) VALUES (
    p_affiliate_id, p_amount_mzn, p_payment_method,
    p_transaction_ref, auth.uid(), p_notes
  )
  RETURNING id INTO v_payout_id;

  -- Actualizar saldo do afiliado
  UPDATE affiliates
  SET
    pending_payout_mzn = pending_payout_mzn - p_amount_mzn,
    paid_out_mzn       = paid_out_mzn + p_amount_mzn
  WHERE id = p_affiliate_id;

  -- Marcar comissões como pagas
  UPDATE affiliate_commissions
  SET status = 'paid', paid_at = now()
  WHERE affiliate_id = p_affiliate_id
    AND status = 'pending'
    AND commission_mzn <= p_amount_mzn;  -- simplificação: marca as menores primeiro

  RETURN v_payout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION process_affiliate_payout(uuid, numeric, text, text, text) TO authenticated;


-- ── 11. VIEW: dashboard de afiliado ──────────────────────────────────────────

CREATE OR REPLACE VIEW affiliate_dashboard AS
SELECT
  a.id AS affiliate_id,
  a.user_id,
  a.code,
  a.status,
  a.total_referrals,
  a.total_conversions,
  a.total_earned_mzn,
  a.pending_payout_mzn,
  a.paid_out_mzn,
  a.created_at,
  p.full_name,
  p.email,
  -- Taxa de conversão
  CASE
    WHEN a.total_referrals > 0
    THEN round((a.total_conversions::numeric / a.total_referrals) * 100, 1)
    ELSE 0
  END AS conversion_rate_pct
FROM affiliates a
JOIN profiles p ON p.id = a.user_id;


-- ── 12. ROW LEVEL SECURITY ────────────────────────────────────────────────────

ALTER TABLE affiliates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts    ENABLE ROW LEVEL SECURITY;

-- affiliates: utilizador vê apenas o seu; admin vê tudo
CREATE POLICY "affiliates_own" ON affiliates
  FOR ALL USING (user_id = auth.uid() OR is_admin());

-- referrals: afiliado vê as suas; admin vê tudo
CREATE POLICY "referrals_own" ON affiliate_referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE id = affiliate_referrals.affiliate_id AND user_id = auth.uid())
    OR is_admin()
  );

-- commissions: afiliado vê as suas; admin vê tudo
CREATE POLICY "commissions_own" ON affiliate_commissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE id = affiliate_commissions.affiliate_id AND user_id = auth.uid())
    OR is_admin()
  );

-- payouts: afiliado vê os seus; admin gere
CREATE POLICY "payouts_own_select" ON affiliate_payouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE id = affiliate_payouts.affiliate_id AND user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "payouts_admin_insert" ON affiliate_payouts
  FOR INSERT WITH CHECK (is_admin());


-- ── 13. ÍNDICES ADICIONAIS ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_affiliates_code   ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliates_user   ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status_affiliate
  ON affiliate_commissions(affiliate_id, status);
