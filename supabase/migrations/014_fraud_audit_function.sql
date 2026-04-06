-- ============================================================
-- MIGRAÇÃO 014 — Função segura para log de fraude (R17)
-- ============================================================

CREATE OR REPLACE FUNCTION log_fraud_event(
  p_actor_id uuid,
  p_transaction_id text,
  p_reasons text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_actor_id <> auth.uid() THEN
    RAISE EXCEPTION 'actor_id deve corresponder ao utilizador autenticado';
  END IF;

  INSERT INTO audit_log (actor_id, action, resource, metadata)
  VALUES (
    p_actor_id,
    'payment_fraud_flag',
    'payment_history',
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'reasons', to_jsonb(coalesce(p_reasons, ARRAY[]::text[])),
      'flagged_at', now()
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION log_fraud_event(uuid, text, text[]) TO authenticated;
