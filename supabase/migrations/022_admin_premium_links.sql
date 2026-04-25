-- ============================================================
-- MIGRAÇÃO 022 — Links premium personalizados por administrador
-- ============================================================

CREATE TABLE IF NOT EXISTS premium_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  target_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  expires_at timestamptz,
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses_count integer NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  last_used_at timestamptz,
  last_used_ip inet,
  last_used_user_agent text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT premium_access_links_not_overused CHECK (uses_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS idx_premium_access_links_target_user
  ON premium_access_links (target_user_id);

CREATE INDEX IF NOT EXISTS idx_premium_access_links_active
  ON premium_access_links (expires_at, revoked_at, uses_count, max_uses);

CREATE OR REPLACE FUNCTION set_premium_access_links_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_premium_access_links_updated_at ON premium_access_links;

CREATE TRIGGER trg_premium_access_links_updated_at
  BEFORE UPDATE ON premium_access_links
  FOR EACH ROW
  EXECUTE FUNCTION set_premium_access_links_updated_at();

ALTER TABLE premium_access_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS premium_access_links_admin_select ON premium_access_links;
CREATE POLICY premium_access_links_admin_select
ON premium_access_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS premium_access_links_admin_insert ON premium_access_links;
CREATE POLICY premium_access_links_admin_insert
ON premium_access_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS premium_access_links_admin_update ON premium_access_links;
CREATE POLICY premium_access_links_admin_update
ON premium_access_links
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);
