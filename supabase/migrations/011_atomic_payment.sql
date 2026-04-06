-- ============================================================
-- MIGRAÇÃO 011 — Pagamento atómico via RPC (R08)
-- ============================================================

CREATE OR REPLACE FUNCTION register_payment(
  p_user_id uuid,
  p_plan_key text,
  p_transaction_id text,
  p_payment_method text,
  p_work_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan plans%ROWTYPE;
  v_payment_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_plan
  FROM plans
  WHERE key = p_plan_key
    AND is_active = true
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano inválido ou inactivo' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO payment_history (
    user_id,
    plan_key,
    transaction_id,
    amount_mzn,
    payment_method,
    work_session_id,
    status
  ) VALUES (
    p_user_id,
    p_plan_key,
    p_transaction_id,
    v_plan.price_mzn,
    p_payment_method,
    p_work_session_id,
    'pending'
  )
  RETURNING id INTO v_payment_id;

  UPDATE profiles
  SET
    transaction_id = p_transaction_id,
    payment_method = p_payment_method,
    payment_status = 'pending',
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'amount_mzn', v_plan.price_mzn
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Transação já registada' USING ERRCODE = '23505';
END;
$$;

GRANT EXECUTE ON FUNCTION register_payment(uuid, text, text, text, uuid) TO authenticated;
