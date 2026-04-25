-- ============================================================
-- MIGRAÇÃO 024 — Acesso ilimitado por 5 dias para novos usuários
-- ============================================================

CREATE OR REPLACE FUNCTION check_user_access(
  p_user_id uuid,
  p_feature text  -- 'export_full' | 'tcc' | 'ai_chat' | 'cover' | 'create_work'
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

  -- Janela de boas-vindas: primeiros 5 dias após cadastro = acesso ilimitado
  IF v_profile.created_at >= (now() - interval '5 days') THEN
    RETURN true;
  END IF;

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
