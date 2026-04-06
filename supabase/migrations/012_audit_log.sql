-- ============================================================
-- MIGRAÇÃO 012 — Auditoria de acessos administrativos (R16)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_select" ON audit_log;
CREATE POLICY "audit_log_admin_select" ON audit_log
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "audit_log_admin_insert" ON audit_log;
CREATE POLICY "audit_log_admin_insert" ON audit_log
  FOR INSERT
  WITH CHECK (is_admin() AND actor_id = auth.uid());
