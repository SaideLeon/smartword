-- ============================================================
-- MIGRAÇÃO 026 — Atualiza catálogo de planos (Abr/2026)
-- ============================================================

-- Plano gratuito (trial de 5 dias com recursos completos e 5 exportações)
UPDATE plans
SET
  label = 'Gratuito',
  price_usd = 0,
  price_mzn = 0,
  works_limit = NULL,
  tcc_enabled = true,
  ai_chat_enabled = true,
  cover_enabled = true,
  export_full = true,
  edits_limit = NULL,
  duration_months = 0,
  is_active = true,
  updated_at = now()
WHERE key = 'free';

-- Garante chaves novas sem quebrar referências históricas.
-- Planos antigos com outras chaves permanecem para histórico, mas inactivos.
INSERT INTO plans (
  key, label, price_usd, price_mzn,
  works_limit, tcc_enabled, ai_chat_enabled, cover_enabled,
  export_full, edits_limit, duration_months, is_active
) VALUES
  ('avulso_1',   '1 Trabalho',   2.37,  152,  1, false, false, true, true, 2,    0, true),
  ('basico_2',   '2 Trabalhos',  4.72,  302,  2, false, true,  true, true, 2,    1, true),
  ('standard_3', '3 Trabalhos',  7.81,  500,  3, false, true,  true, true, NULL, 1, true),
  ('pro_4',      '4 Trabalhos',  9.45,  605,  4, true,  true,  true, true, NULL, 1, true),
  ('premium_5',  '5 Trabalhos', 11.79,  755,  5, true,  true,  true, true, NULL, 1, true),
  ('pack_10',   '10 Trabalhos', 23.58, 1510, 10, true,  true,  true, true, NULL, 1, true),
  ('pack_20',   '20 Trabalhos', 47.12, 3018, 20, true,  true,  true, true, NULL, 1, true)
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

-- Inactiva chaves antigas do catálogo para evitar confusão em listagens.
UPDATE plans
SET is_active = false, updated_at = now()
WHERE key IN ('avulso', 'basico', 'standard', 'pro', 'premium', 'pack10', 'pack20')
  AND key NOT IN ('free');
