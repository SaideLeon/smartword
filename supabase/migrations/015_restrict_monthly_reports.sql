-- Restrict sensitive monthly financial metrics to administrators only.

DROP POLICY IF EXISTS "reports_read_all" ON monthly_reports;

CREATE POLICY "reports_admin_only" ON monthly_reports
  FOR SELECT
  USING (is_admin());
