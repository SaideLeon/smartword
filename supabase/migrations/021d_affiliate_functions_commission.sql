-- ============================================================
-- MIGRAÇÃO 021d — Muneri · Sistema de Afiliados
-- PARTE 4/5: Cálculo de comissão + confirm_payment + payout
-- ============================================================

-- ── 8. FUNÇÃO: calcular comissão após pagamento ───────────
CREATE OR REPLACE FUNCTION calculate_affiliate_commission(
  p_payment_id uuid, p_user_id uuid, p_amount_mzn numeric
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referral   affiliate_referrals%ROWTYPE;
  v_commission numeric(10,2);
  v_rate       numeric(5,4) := 0.40;
BEGIN
  SELECT * INTO v_referral FROM affiliate_referrals WHERE referred_user_id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM affiliates WHERE id = v_referral.affiliate_id AND status = 'active')
  THEN RETURN false; END IF;

  v_commission := round(p_amount_mzn * v_rate, 2);

  INSERT INTO affiliate_commissions (
    affiliate_id, referral_id, payment_id,
    payment_amount_mzn, commission_rate, commission_mzn
  ) VALUES (
    v_referral.affiliate_id, v_referral.id, p_payment_id,
    p_amount_mzn, v_rate, v_commission
  ) ON CONFLICT (payment_id) DO NOTHING;

  IF FOUND THEN
    UPDATE affiliates SET
      total_earned_mzn   = total_earned_mzn + v_commission,
      pending_payout_mzn = pending_payout_mzn + v_commission
    WHERE id = v_referral.affiliate_id;

    IF v_referral.status = 'pending' THEN
      UPDATE affiliate_referrals SET status = 'converted', converted_at = now()
      WHERE id = v_referral.id;
      UPDATE affiliates SET total_conversions = total_conversions + 1
      WHERE id = v_referral.affiliate_id;
    END IF;
  END IF;
  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION calculate_affiliate_commission(uuid, uuid, numeric) TO authenticated;

-- ── 9. FUNÇÃO: confirm_payment (com comissão) ─────────────
CREATE OR REPLACE FUNCTION confirm_payment(
  p_payment_id uuid, p_admin_id uuid, p_action text, p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment    payment_history%ROWTYPE;
  v_plan       plans%ROWTYPE;
  v_new_status text;
  v_expires    timestamptz;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'P0001'; END IF;
  IF p_action NOT IN ('confirm', 'reject') THEN
    RAISE EXCEPTION 'Acção inválida' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_payment FROM payment_history WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento não encontrado' USING ERRCODE = 'P0003'; END IF;
  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Pagamento já foi processado: %', v_payment.status USING ERRCODE = 'P0004'; END IF;

  v_new_status := CASE p_action WHEN 'confirm' THEN 'confirmed' ELSE 'rejected' END;
  UPDATE payment_history SET status = v_new_status, confirmed_by = p_admin_id,
    confirmed_at = now(), notes = p_notes, updated_at = now() WHERE id = p_payment_id;

  IF p_action = 'confirm' THEN
    SELECT * INTO v_plan FROM plans WHERE key = v_payment.plan_key;
    v_expires := CASE WHEN v_plan.duration_months > 0
      THEN now() + make_interval(months => v_plan.duration_months) ELSE NULL END;
    UPDATE profiles SET plan_key = v_payment.plan_key, plan_expires_at = v_expires,
      payment_status = 'active', payment_verified_at = now(), payment_verified_by = p_admin_id,
      works_used = 0, edits_used = 0, updated_at = now() WHERE id = v_payment.user_id;
    PERFORM calculate_affiliate_commission(p_payment_id, v_payment.user_id, v_payment.amount_mzn);
  ELSE
    UPDATE profiles SET payment_status = 'none', updated_at = now() WHERE id = v_payment.user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_new_status);
END; $$;

GRANT EXECUTE ON FUNCTION confirm_payment(uuid, uuid, text, text) TO authenticated;

-- ── 10. FUNÇÃO: processar payout (admin) ─────────────────
CREATE OR REPLACE FUNCTION process_affiliate_payout(
  p_affiliate_id uuid, p_amount_mzn numeric, p_payment_method text,
  p_transaction_ref text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payout_id       uuid;
  v_pending_balance numeric(10,2);
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'P0001'; END IF;
  SELECT pending_payout_mzn INTO v_pending_balance FROM affiliates
  WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Afiliado não encontrado' USING ERRCODE = 'P0003'; END IF;
  IF p_amount_mzn > v_pending_balance THEN
    RAISE EXCEPTION 'Valor superior ao saldo pendente (%.2f MZN disponível)', v_pending_balance
      USING ERRCODE = 'P0005'; END IF;

  INSERT INTO affiliate_payouts (affiliate_id, amount_mzn, payment_method,
    transaction_ref, processed_by, notes)
  VALUES (p_affiliate_id, p_amount_mzn, p_payment_method,
    p_transaction_ref, auth.uid(), p_notes) RETURNING id INTO v_payout_id;

  UPDATE affiliates SET
    pending_payout_mzn = pending_payout_mzn - p_amount_mzn,
    paid_out_mzn       = paid_out_mzn + p_amount_mzn
  WHERE id = p_affiliate_id;

  UPDATE affiliate_commissions SET status = 'paid', paid_at = now()
  WHERE affiliate_id = p_affiliate_id AND status = 'pending'
    AND commission_mzn <= p_amount_mzn;

  RETURN v_payout_id;
END; $$;

GRANT EXECUTE ON FUNCTION process_affiliate_payout(uuid, numeric, text, text, text) TO authenticated;
