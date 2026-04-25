-- ============================================================
-- MIGRAÇÃO 023 — Atualiza planos por quantidade de trabalhos
-- ============================================================

-- Ajusta os planos existentes para os novos preços/limites
UPDATE plans
SET
  label = '1 Trabalho',
  price_usd = 2.37,
  price_mzn = 152,
  works_limit = 1,
  edits_limit = 2,
  duration_months = 0,
  updated_at = now()
WHERE key = 'avulso';

UPDATE plans
SET
  label = '2 Trabalhos',
  price_usd = 4.72,
  price_mzn = 302,
  works_limit = 2,
  edits_limit = 2,
  duration_months = 1,
  updated_at = now()
WHERE key = 'basico';

UPDATE plans
SET
  label = '3 Trabalhos',
  price_usd = 7.81,
  price_mzn = 500,
  works_limit = 3,
  duration_months = 1,
  updated_at = now()
WHERE key = 'standard';

UPDATE plans
SET
  label = '4 Trabalhos',
  price_usd = 9.45,
  price_mzn = 605,
  works_limit = 4,
  duration_months = 1,
  updated_at = now()
WHERE key = 'pro';

UPDATE plans
SET
  label = '5 Trabalhos',
  price_usd = 11.79,
  price_mzn = 755,
  works_limit = 5,
  duration_months = 1,
  updated_at = now()
WHERE key = 'premium';

-- Adiciona novos planos de volume
INSERT INTO plans (
  key, label, price_usd, price_mzn,
  works_limit, tcc_enabled, ai_chat_enabled, cover_enabled,
  export_full, edits_limit, duration_months, is_active
) VALUES
  ('pack10', '10 Trabalhos', 23.58, 1510, 10, true, true, true, true, NULL, 1, true),
  ('pack20', '20 Trabalhos', 47.12, 3018, 20, true, true, true, true, NULL, 1, true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  price_usd = EXCLUDED.price_usd,
  price_mzn = EXCLUDED.price_mzn,
  works_limit = EXCLUDED.works_limit,
  tcc_enabled = EXCLUDED.tcc_enabled,
  ai_chat_enabled = EXCLUDED.ai_chat_enabled,
  cover_enabled = EXCLUDED.cover_enabled,
  export_full = EXCLUDED.export_full,
  edits_limit = EXCLUDED.edits_limit,
  duration_months = EXCLUDED.duration_months,
  is_active = EXCLUDED.is_active,
  updated_at = now();
