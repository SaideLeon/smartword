-- ============================================================
-- MIGRAÇÃO 021a — Muneri · Sistema de Afiliados
-- PARTE 1/5: Tabelas principais
-- ============================================================

-- ── 1. TABELA: affiliates ─────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  code           text NOT NULL UNIQUE,
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended', 'banned')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  total_referrals     integer NOT NULL DEFAULT 0,
  total_conversions   integer NOT NULL DEFAULT 0,
  total_earned_mzn    numeric(12,2) NOT NULL DEFAULT 0,
  pending_payout_mzn  numeric(12,2) NOT NULL DEFAULT 0,
  paid_out_mzn        numeric(12,2) NOT NULL DEFAULT 0
);

COMMENT ON TABLE affiliates IS
  'Perfil de afiliado. Um utilizador pode ter apenas um código de afiliado.';
COMMENT ON COLUMN affiliates.code IS
  'Código único de 8 caracteres alfanuméricos. Usado no link de convite.';

-- ── 2. TABELA: affiliate_referrals ────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  registered_at    timestamptz NOT NULL DEFAULT now(),
  converted_at     timestamptz,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'converted', 'invalid'))
);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON affiliate_referrals(referred_user_id);

COMMENT ON TABLE affiliate_referrals IS
  'Regista quem se registou através do link de um afiliado.
   Um utilizador só pode ter UM afiliado (UNIQUE em referred_user_id).';
