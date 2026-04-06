-- ============================================================
-- MIGRAÇÃO 013 — Confirmação de pagamento atómica (R08/R19)
-- ============================================================

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
  v_payment payment_history%ROWTYPE;
  v_plan plans%ROWTYPE;
  v_new_status text;
  v_expires timestamptz;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'P0001';
  END IF;

  IF p_action NOT IN ('confirm', 'reject') THEN
    RAISE EXCEPTION 'Acção inválida' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_payment
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
    status = v_new_status,
    confirmed_by = p_admin_id,
    confirmed_at = now(),
    notes = p_notes,
    updated_at = now()
  WHERE id = p_payment_id;

  IF p_action = 'confirm' THEN
    SELECT *
    INTO v_plan
    FROM plans
    WHERE key = v_payment.plan_key;

    IF v_plan.duration_months > 0 THEN
      v_expires := now() + make_interval(months => v_plan.duration_months);
    ELSE
      v_expires := NULL;
    END IF;

    UPDATE profiles
    SET
      plan_key = v_payment.plan_key,
      plan_expires_at = v_expires,
      payment_status = 'active',
      payment_verified_at = now(),
      payment_verified_by = p_admin_id,
      works_used = 0,
      edits_used = 0,
      updated_at = now()
    WHERE id = v_payment.user_id;
  ELSE
    UPDATE profiles
    SET
      payment_status = 'none',
      updated_at = now()
    WHERE id = v_payment.user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_payment(uuid, uuid, text, text) TO authenticated;
