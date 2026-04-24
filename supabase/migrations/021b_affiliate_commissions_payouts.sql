-- ============================================================
-- MIGRAÇÃO 021b — Muneri · Sistema de Afiliados
-- PARTE 2/5: Tabelas de comissões e payouts + trigger
-- ============================================================

-- ── 3. TABELA: affiliate_commissions ─────────────────────
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id      uuid NOT NULL REFERENCES affiliate_referrals(id) ON DELETE CASCADE,
  payment_id       uuid NOT NULL UNIQUE REFERENCES payment_history(id) ON DELETE CASCADE,
  payment_amount_mzn  numeric(10,2) NOT NULL,
  commission_rate  numeric(5,4) NOT NULL DEFAULT 0.40,
  commission_mzn   numeric(10,2) NOT NULL,
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

-- ── 4. TABELA: affiliate_payouts ─────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id   uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_mzn     numeric(10,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'mpesa'
                 CHECK (payment_method IN ('mpesa', 'emola', 'bank_transfer')),
  transaction_ref text,
  processed_by   uuid REFERENCES profiles(id),
  processed_at   timestamptz NOT NULL DEFAULT now(),
  notes          text
);

CREATE INDEX IF NOT EXISTS idx_payouts_affiliate ON affiliate_payouts(affiliate_id);

COMMENT ON TABLE affiliate_payouts IS
  'Histórico de transferências de comissões do afiliado.
   Processado manualmente pelo admin via painel.';

-- ── 5. TRIGGER: updated_at para affiliates ───────────────
CREATE TRIGGER affiliates_updated_at
  BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
