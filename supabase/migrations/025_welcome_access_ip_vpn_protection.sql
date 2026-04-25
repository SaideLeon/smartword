-- ============================================================
-- MIGRAÇÃO 025 — Proteção antifraude para 5 dias de boas-vindas
-- ============================================================

CREATE TABLE IF NOT EXISTS welcome_access_ip_registry (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address text NOT NULL UNIQUE,
  first_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE welcome_access_ip_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS welcome_access_ip_registry_user_select ON welcome_access_ip_registry;
CREATE POLICY welcome_access_ip_registry_user_select
ON welcome_access_ip_registry
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS welcome_access_ip_registry_admin_all ON welcome_access_ip_registry;
CREATE POLICY welcome_access_ip_registry_admin_all
ON welcome_access_ip_registry
FOR ALL
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Regressa check_user_access para validar apenas regras de plano.
CREATE OR REPLACE FUNCTION check_user_access(
  p_user_id uuid,
  p_feature text
)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_plan    plans%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_plan FROM plans WHERE key = v_profile.plan_key;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Plano expirado → degradar para free
  IF v_plan.duration_months > 0 AND v_profile.plan_expires_at < now() THEN
    RETURN p_feature IN ('create_work') AND v_profile.works_used < 20;
  END IF;

  CASE p_feature
    WHEN 'create_work' THEN
      IF v_plan.works_limit IS NULL THEN RETURN true; END IF;
      RETURN v_profile.works_used < v_plan.works_limit;
    WHEN 'export_full'  THEN RETURN v_plan.export_full;
    WHEN 'tcc'          THEN RETURN v_plan.tcc_enabled;
    WHEN 'ai_chat'      THEN RETURN v_plan.ai_chat_enabled;
    WHEN 'cover'        THEN RETURN v_plan.cover_enabled;
    ELSE RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION evaluate_welcome_access(
  p_user_id uuid,
  p_client_ip text,
  p_vpn_detected boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_existing_user_ip text;
  v_ip_owner uuid;
  v_normalized_ip text := NULLIF(trim(p_client_ip), '');
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'USER_NOT_FOUND');
  END IF;

  IF v_profile.created_at < (now() - interval '5 days') THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'WINDOW_EXPIRED');
  END IF;

  SELECT ip_address INTO v_existing_user_ip
  FROM welcome_access_ip_registry
  WHERE user_id = p_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('eligible', true, 'reason', 'ALREADY_GRANTED');
  END IF;

  IF COALESCE(p_vpn_detected, false) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'VPN_DETECTED');
  END IF;

  IF v_normalized_ip IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'IP_UNAVAILABLE');
  END IF;

  SELECT user_id INTO v_ip_owner
  FROM welcome_access_ip_registry
  WHERE ip_address = v_normalized_ip
  LIMIT 1;

  IF FOUND AND v_ip_owner <> p_user_id THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'IP_ALREADY_REGISTERED');
  END IF;

  INSERT INTO welcome_access_ip_registry (user_id, ip_address)
  VALUES (p_user_id, v_normalized_ip)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('eligible', true, 'reason', 'GRANTED');
END;
$$;
