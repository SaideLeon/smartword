-- ============================================================
-- MIGRAÇÃO 021e — Muneri · Sistema de Afiliados
-- PARTE 5/5: View, RLS e índices adicionais
-- ============================================================

-- ── 11. VIEW: dashboard de afiliado ──────────────────────
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
  CASE
    WHEN a.total_referrals > 0
    THEN round((a.total_conversions::numeric / a.total_referrals) * 100, 1)
    ELSE 0
  END AS conversion_rate_pct
FROM affiliates a
JOIN profiles p ON p.id = a.user_id;


-- ── 12. ROW LEVEL SECURITY ────────────────────────────────
ALTER TABLE affiliates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliates_own" ON affiliates
  FOR ALL USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "referrals_own" ON affiliate_referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE id = affiliate_referrals.affiliate_id AND user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "commissions_own" ON affiliate_commissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE id = affiliate_commissions.affiliate_id AND user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "payouts_own_select" ON affiliate_payouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM affiliates WHERE id = affiliate_payouts.affiliate_id AND user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "payouts_admin_insert" ON affiliate_payouts
  FOR INSERT WITH CHECK (is_admin());


-- ── 13. ÍNDICES ADICIONAIS ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliates_user ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status_affiliate
  ON affiliate_commissions(affiliate_id, status);
