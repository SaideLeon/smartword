-- ============================================================
-- MIGRAÇÃO 021c — Muneri · Sistema de Afiliados
-- PARTE 3/5: Funções de código e registo de referência
-- ============================================================

-- ── 6. FUNÇÃO: gerar código único de afiliado ─────────────
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
  SELECT code INTO v_existing FROM affiliates WHERE user_id = p_user_id;
  IF FOUND THEN RETURN v_existing; END IF;

  LOOP
    v_code := upper(substring(encode(gen_random_bytes(6), 'base64'), 1, 8));
    v_code := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');
    IF length(v_code) < 6 THEN
      v_attempts := v_attempts + 1;
      IF v_attempts > 20 THEN
        RAISE EXCEPTION 'Falha ao gerar código único após 20 tentativas';
      END IF;
      CONTINUE;
    END IF;
    v_code := left(v_code, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM affiliates WHERE code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Falha ao gerar código único após 20 tentativas';
    END IF;
  END LOOP;

  INSERT INTO affiliates (user_id, code) VALUES (p_user_id, v_code);
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_affiliate_code(uuid) TO authenticated;

-- ── 7. FUNÇÃO: registar referência no signup ──────────────
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
  SELECT * INTO v_affiliate FROM affiliates
  WHERE code = upper(trim(p_affiliate_code)) AND status = 'active';

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_affiliate.user_id = p_new_user_id THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM affiliate_referrals WHERE referred_user_id = p_new_user_id
  ) THEN RETURN false; END IF;

  INSERT INTO affiliate_referrals (affiliate_id, referred_user_id)
  VALUES (v_affiliate.id, p_new_user_id);

  UPDATE affiliates
  SET total_referrals = total_referrals + 1
  WHERE id = v_affiliate.id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION register_affiliate_referral(uuid, text) TO authenticated;
