-- MIGRAÇÃO 016 — Corrige R18: Mass Assignment em profiles via RLS
-- Objectivo:
-- 1) Remover UPDATE directo de utilizadores autenticados em profiles.
-- 2) Permitir apenas leitura do próprio perfil para utilizador comum.
-- 3) Encapsular updates permitidos via RPC SECURITY DEFINER.

-- ── 1. Políticas RLS de profiles ───────────────────────────────────────────

-- Remover políticas antigas/permissivas (idempotente)
DROP POLICY IF EXISTS "profiles_self"        ON profiles;
DROP POLICY IF EXISTS "profiles_admin"       ON profiles;
DROP POLICY IF EXISTS "user_own_profile"     ON profiles;
DROP POLICY IF EXISTS "admin_all_profiles"   ON profiles;
DROP POLICY IF EXISTS "profiles_self_select" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all"   ON profiles;

-- Utilizador comum: apenas SELECT do próprio perfil
CREATE POLICY "profiles_self_select" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admin: acesso total
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ── 2. RPC segura para auto-edição de perfil (campos não sensíveis) ───────

CREATE OR REPLACE FUNCTION update_own_profile(
  p_full_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = 'P0001';
  END IF;

  IF p_full_name IS NOT NULL AND length(p_full_name) > 200 THEN
    RAISE EXCEPTION 'full_name demasiado longo' USING ERRCODE = 'P0002';
  END IF;

  IF p_avatar_url IS NOT NULL AND length(p_avatar_url) > 500 THEN
    RAISE EXCEPTION 'avatar_url demasiado longo' USING ERRCODE = 'P0003';
  END IF;

  UPDATE profiles
  SET
    full_name = COALESCE(p_full_name, full_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION update_own_profile(text, text) TO authenticated;


-- ── 3. RPC admin para ajuste manual de plano (emergência) ─────────────────

CREATE OR REPLACE FUNCTION admin_set_user_plan(
  p_user_id uuid,
  p_plan_key text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM plans
    WHERE key = p_plan_key
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Plano inválido ou inactivo' USING ERRCODE = 'P0002';
  END IF;

  UPDATE profiles
  SET
    plan_key = p_plan_key,
    plan_expires_at = p_expires_at,
    payment_status = CASE WHEN p_plan_key = 'free' THEN 'none' ELSE 'active' END,
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilizador não encontrado' USING ERRCODE = 'P0003';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_user_plan(uuid, text, timestamptz) TO authenticated;
