-- Monitoring and Health Tracking Tables
-- Uptime logs and alert history for system monitoring

-- ============================================================================
-- 1. Uptime Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS uptime_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
  response_time INTEGER NOT NULL,
  errors TEXT[],
  checks JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for uptime logs
CREATE INDEX IF NOT EXISTS idx_uptime_logs_checked_at
  ON uptime_logs(checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_uptime_logs_status
  ON uptime_logs(status);

CREATE INDEX IF NOT EXISTS idx_uptime_logs_status_checked
  ON uptime_logs(status, checked_at DESC);

-- GIN index for checks JSONB
CREATE INDEX IF NOT EXISTS idx_uptime_logs_checks
  ON uptime_logs USING GIN(checks);

-- Comments
COMMENT ON TABLE uptime_logs IS 'System uptime and health check logs';
COMMENT ON COLUMN uptime_logs.status IS 'System status: up, down, or degraded';
COMMENT ON COLUMN uptime_logs.response_time IS 'Health check response time in milliseconds';
COMMENT ON COLUMN uptime_logs.errors IS 'Array of error messages if status is degraded or down';
COMMENT ON COLUMN uptime_logs.checks IS 'Detailed health check results for each service';
COMMENT ON COLUMN uptime_logs.checked_at IS 'When the health check was performed';

-- ============================================================================
-- 2. Alert History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_name VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  details JSONB,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for alert history
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at
  ON alert_history(triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_severity
  ON alert_history(severity);

CREATE INDEX IF NOT EXISTS idx_alert_history_alert_name
  ON alert_history(alert_name);

CREATE INDEX IF NOT EXISTS idx_alert_history_unresolved
  ON alert_history(resolved, triggered_at DESC)
  WHERE resolved = FALSE;

-- GIN index for details JSONB
CREATE INDEX IF NOT EXISTS idx_alert_history_details
  ON alert_history USING GIN(details);

-- Comments
COMMENT ON TABLE alert_history IS 'History of system alerts and monitoring triggers';
COMMENT ON COLUMN alert_history.alert_name IS 'Name of the alert that was triggered';
COMMENT ON COLUMN alert_history.severity IS 'Alert severity: info, warning, or critical';
COMMENT ON COLUMN alert_history.message IS 'Alert message or description';
COMMENT ON COLUMN alert_history.details IS 'Additional context and metrics';
COMMENT ON COLUMN alert_history.triggered_at IS 'When the alert was triggered';
COMMENT ON COLUMN alert_history.acknowledged IS 'Whether the alert has been acknowledged';
COMMENT ON COLUMN alert_history.acknowledged_by IS 'User who acknowledged the alert';
COMMENT ON COLUMN alert_history.resolved IS 'Whether the issue has been resolved';

-- ============================================================================
-- 3. Views for Monitoring
-- ============================================================================

-- Current system status view (last 5 minutes)
CREATE OR REPLACE VIEW current_system_status AS
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'down') > 0 THEN 'down'
    WHEN COUNT(*) FILTER (WHERE status = 'degraded') > 0 THEN 'degraded'
    ELSE 'up'
  END AS status,
  AVG(response_time) AS avg_response_time,
  MAX(checked_at) AS last_check,
  COUNT(*) AS check_count
FROM uptime_logs
WHERE checked_at > NOW() - INTERVAL '5 minutes';

COMMENT ON VIEW current_system_status IS 'Current system status based on recent health checks';

-- Uptime summary view (last 24 hours)
CREATE OR REPLACE VIEW uptime_summary_24h AS
SELECT
  COUNT(*) AS total_checks,
  COUNT(*) FILTER (WHERE status = 'up') AS up_count,
  COUNT(*) FILTER (WHERE status = 'down') AS down_count,
  COUNT(*) FILTER (WHERE status = 'degraded') AS degraded_count,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'up')::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) AS uptime_percentage,
  AVG(response_time) AS avg_response_time,
  MIN(response_time) AS min_response_time,
  MAX(response_time) AS max_response_time
FROM uptime_logs
WHERE checked_at > NOW() - INTERVAL '24 hours';

COMMENT ON VIEW uptime_summary_24h IS 'Uptime statistics for the last 24 hours';

-- Unresolved alerts view
CREATE OR REPLACE VIEW unresolved_alerts AS
SELECT
  id,
  alert_name,
  severity,
  message,
  details,
  triggered_at,
  AGE(NOW(), triggered_at) AS time_since_triggered
FROM alert_history
WHERE resolved = FALSE
ORDER BY
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    WHEN 'info' THEN 3
  END,
  triggered_at DESC;

COMMENT ON VIEW unresolved_alerts IS 'All unresolved alerts ordered by severity and time';

-- Recent critical alerts view
CREATE OR REPLACE VIEW recent_critical_alerts AS
SELECT
  id,
  alert_name,
  message,
  details,
  triggered_at,
  acknowledged,
  resolved
FROM alert_history
WHERE
  severity = 'critical'
  AND triggered_at > NOW() - INTERVAL '7 days'
ORDER BY triggered_at DESC;

COMMENT ON VIEW recent_critical_alerts IS 'Critical alerts from the last 7 days';

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Function to get uptime percentage for a period
CREATE OR REPLACE FUNCTION get_uptime_percentage(
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
AS $$
  SELECT
    COALESCE(
      ROUND(
        (COUNT(*) FILTER (WHERE status = 'up')::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100,
        2
      ),
      100.0
    )
  FROM uptime_logs
  WHERE checked_at BETWEEN p_start_time AND p_end_time;
$$;

COMMENT ON FUNCTION get_uptime_percentage IS 'Calculate uptime percentage for a given time period';

-- Function to get average response time for a period
CREATE OR REPLACE FUNCTION get_avg_response_time(
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(AVG(response_time)::INTEGER, 0)
  FROM uptime_logs
  WHERE checked_at BETWEEN p_start_time AND p_end_time
    AND status IN ('up', 'degraded');
$$;

COMMENT ON FUNCTION get_avg_response_time IS 'Get average response time for a given time period';

-- Function to acknowledge an alert
CREATE OR REPLACE FUNCTION acknowledge_alert(
  p_alert_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  UPDATE alert_history
  SET
    acknowledged = TRUE,
    acknowledged_by = p_user_id,
    acknowledged_at = NOW()
  WHERE id = p_alert_id
    AND acknowledged = FALSE;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION acknowledge_alert IS 'Acknowledge an alert';

-- Function to resolve an alert
CREATE OR REPLACE FUNCTION resolve_alert(
  p_alert_id UUID
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  UPDATE alert_history
  SET
    resolved = TRUE,
    resolved_at = NOW()
  WHERE id = p_alert_id
    AND resolved = FALSE;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION resolve_alert IS 'Mark an alert as resolved';

-- Function to get downtime events in a period
CREATE OR REPLACE FUNCTION get_downtime_events(
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  error_count INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    checked_at AS start_time,
    LEAD(checked_at) OVER (ORDER BY checked_at) AS end_time,
    EXTRACT(EPOCH FROM (LEAD(checked_at) OVER (ORDER BY checked_at) - checked_at))::INTEGER / 60 AS duration_minutes,
    COALESCE(array_length(errors, 1), 0) AS error_count
  FROM uptime_logs
  WHERE
    checked_at BETWEEN p_start_time AND p_end_time
    AND status = 'down'
  ORDER BY checked_at DESC;
$$;

COMMENT ON FUNCTION get_downtime_events IS 'Get all downtime events within a time period';

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE uptime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all uptime logs
CREATE POLICY "Admins can view all uptime logs"
  ON uptime_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Service role can insert uptime logs
CREATE POLICY "Service role can insert uptime logs"
  ON uptime_logs FOR INSERT
  WITH CHECK (TRUE);

-- Prevent updates and deletes on uptime logs
CREATE POLICY "Uptime logs are immutable"
  ON uptime_logs FOR UPDATE
  USING (FALSE);

CREATE POLICY "Uptime logs cannot be deleted"
  ON uptime_logs FOR DELETE
  USING (FALSE);

-- Admins can view all alerts
CREATE POLICY "Admins can view all alerts"
  ON alert_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Service role can insert alerts
CREATE POLICY "Service role can insert alerts"
  ON alert_history FOR INSERT
  WITH CHECK (TRUE);

-- Admins can update alerts (for acknowledging/resolving)
CREATE POLICY "Admins can update alerts"
  ON alert_history FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 6. Grants
-- ============================================================================

GRANT SELECT ON uptime_logs TO authenticated;
GRANT INSERT ON uptime_logs TO authenticated;

GRANT SELECT ON alert_history TO authenticated;
GRANT INSERT ON alert_history TO authenticated;
GRANT UPDATE ON alert_history TO authenticated;

GRANT SELECT ON current_system_status TO authenticated;
GRANT SELECT ON uptime_summary_24h TO authenticated;
GRANT SELECT ON unresolved_alerts TO authenticated;
GRANT SELECT ON recent_critical_alerts TO authenticated;

GRANT EXECUTE ON FUNCTION get_uptime_percentage TO authenticated;
GRANT EXECUTE ON FUNCTION get_avg_response_time TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_alert TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_alert TO authenticated;
GRANT EXECUTE ON FUNCTION get_downtime_events TO authenticated;

-- ============================================================================
-- 7. Retention Policy (Optional)
-- ============================================================================

-- Function to clean old uptime logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_uptime_logs()
RETURNS INTEGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM uptime_logs
    WHERE checked_at < NOW() - INTERVAL '90 days'
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_uptime_logs IS 'Delete uptime logs older than 90 days';

-- Function to clean old resolved alerts (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS INTEGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM alert_history
    WHERE
      resolved = TRUE
      AND resolved_at < NOW() - INTERVAL '90 days'
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_alerts IS 'Delete resolved alerts older than 90 days';
