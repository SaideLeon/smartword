-- ============================================================
-- MIGRAÇÃO 009 — Garantir unicidade de transaction_id em payment_history
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_history_transaction_id_key'
      AND conrelid = 'payment_history'::regclass
  ) THEN
    DROP INDEX IF EXISTS payment_history_transaction_id_idx;

    ALTER TABLE payment_history
      ADD CONSTRAINT payment_history_transaction_id_key
      UNIQUE (transaction_id);
  END IF;
END
$$;
