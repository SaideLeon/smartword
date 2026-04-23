-- ============================================================
-- MIGRAÇÃO 020 — Idempotência de webhooks PaySuite
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  processed_at         timestamptz,
  request_id           text NOT NULL UNIQUE,
  event_type           text NOT NULL,
  provider_payment_id  text NOT NULL,
  payload              jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_payment_id
  ON payment_webhook_events(provider_payment_id);

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_webhook_events_no_client_access ON payment_webhook_events;
CREATE POLICY payment_webhook_events_no_client_access
  ON payment_webhook_events
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
