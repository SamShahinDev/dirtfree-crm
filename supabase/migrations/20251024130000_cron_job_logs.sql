-- Cron Job Logs and Management
-- Tracks execution history and statistics for all cron jobs

-- ============================================================================
-- 1. Cron Job Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS cron_job_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cron_logs_job_started
  ON cron_job_logs(job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_logs_status
  ON cron_job_logs(status);

CREATE INDEX IF NOT EXISTS idx_cron_logs_started_at
  ON cron_job_logs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_logs_job_status
  ON cron_job_logs(job_name, status);

-- Comments
COMMENT ON TABLE cron_job_logs IS 'Execution logs for all cron jobs';
COMMENT ON COLUMN cron_job_logs.job_name IS 'Name of the cron job';
COMMENT ON COLUMN cron_job_logs.status IS 'Execution status: started, completed, or failed';
COMMENT ON COLUMN cron_job_logs.started_at IS 'When the job execution started';
COMMENT ON COLUMN cron_job_logs.completed_at IS 'When the job execution completed';
COMMENT ON COLUMN cron_job_logs.duration_ms IS 'Execution duration in milliseconds';
COMMENT ON COLUMN cron_job_logs.error_message IS 'Error message if job failed';
COMMENT ON COLUMN cron_job_logs.attempts IS 'Number of retry attempts';

-- ============================================================================
-- 2. Cron Job Configuration Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS cron_job_config (
  job_name VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  last_modified_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

-- Comments
COMMENT ON TABLE cron_job_config IS 'Runtime configuration for cron jobs';
COMMENT ON COLUMN cron_job_config.enabled IS 'Whether the job is enabled';
COMMENT ON COLUMN cron_job_config.last_modified_at IS 'When the configuration was last changed';
COMMENT ON COLUMN cron_job_config.last_modified_by IS 'User who last modified the configuration';

-- ============================================================================
-- 3. Views for Cron Job Statistics
-- ============================================================================

-- Recent job executions view
CREATE OR REPLACE VIEW recent_cron_executions AS
SELECT
  job_name,
  status,
  started_at,
  completed_at,
  duration_ms,
  error_message,
  attempts
FROM cron_job_logs
WHERE started_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;

COMMENT ON VIEW recent_cron_executions IS 'Cron job executions from the last 7 days';

-- Job success rate view
CREATE OR REPLACE VIEW cron_job_success_rates AS
SELECT
  job_name,
  COUNT(*) FILTER (WHERE status = 'completed') AS successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs,
  COUNT(*) AS total_runs,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100,
    2
  ) AS success_rate_percentage,
  AVG(duration_ms) FILTER (WHERE status = 'completed') AS avg_duration_ms,
  MAX(started_at) AS last_run_at
FROM cron_job_logs
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY job_name
ORDER BY job_name;

COMMENT ON VIEW cron_job_success_rates IS 'Success rates and statistics for all cron jobs (last 30 days)';

-- Failed jobs view
CREATE OR REPLACE VIEW failed_cron_jobs AS
SELECT
  id,
  job_name,
  started_at,
  completed_at,
  duration_ms,
  error_message,
  attempts
FROM cron_job_logs
WHERE status = 'failed'
ORDER BY started_at DESC
LIMIT 100;

COMMENT ON VIEW failed_cron_jobs IS 'Most recent 100 failed cron job executions';

-- Currently running jobs view
CREATE OR REPLACE VIEW running_cron_jobs AS
SELECT
  job_name,
  started_at,
  EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER AS running_duration_seconds
FROM cron_job_logs
WHERE status = 'started'
  AND started_at > NOW() - INTERVAL '1 hour'
ORDER BY started_at DESC;

COMMENT ON VIEW running_cron_jobs IS 'Currently running cron jobs (started within last hour)';

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Function to get job statistics
CREATE OR REPLACE FUNCTION get_cron_job_stats(
  p_job_name VARCHAR(100),
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_runs BIGINT,
  successful_runs BIGINT,
  failed_runs BIGINT,
  success_rate NUMERIC,
  avg_duration_ms NUMERIC,
  min_duration_ms INTEGER,
  max_duration_ms INTEGER,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) AS total_runs,
      COUNT(*) FILTER (WHERE status = 'completed') AS successful_runs,
      COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs,
      AVG(duration_ms) FILTER (WHERE status = 'completed') AS avg_duration_ms,
      MIN(duration_ms) FILTER (WHERE status = 'completed') AS min_duration_ms,
      MAX(duration_ms) FILTER (WHERE status = 'completed') AS max_duration_ms,
      MAX(started_at) AS last_run_at,
      MAX(completed_at) FILTER (WHERE status = 'completed') AS last_success_at,
      MAX(completed_at) FILTER (WHERE status = 'failed') AS last_failure_at
    FROM cron_job_logs
    WHERE job_name = p_job_name
      AND started_at > NOW() - (p_days || ' days')::INTERVAL
  )
  SELECT
    total_runs,
    successful_runs,
    failed_runs,
    ROUND(
      (successful_runs::NUMERIC / NULLIF(total_runs, 0)::NUMERIC) * 100,
      2
    ) AS success_rate,
    ROUND(avg_duration_ms, 0) AS avg_duration_ms,
    min_duration_ms,
    max_duration_ms,
    last_run_at,
    last_success_at,
    last_failure_at
  FROM stats;
$$;

COMMENT ON FUNCTION get_cron_job_stats IS 'Get statistics for a specific cron job';

-- Function to cleanup old logs
CREATE OR REPLACE FUNCTION cleanup_old_cron_logs(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM cron_job_logs
    WHERE started_at < NOW() - (p_retention_days || ' days')::INTERVAL
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_cron_logs IS 'Delete cron job logs older than specified days (default 90)';

-- Function to get job execution timeline
CREATE OR REPLACE FUNCTION get_cron_job_timeline(
  p_job_name VARCHAR(100),
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  time_bucket TIMESTAMPTZ,
  executions INTEGER,
  successes INTEGER,
  failures INTEGER,
  avg_duration_ms NUMERIC
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    DATE_TRUNC('hour', started_at) AS time_bucket,
    COUNT(*) AS executions,
    COUNT(*) FILTER (WHERE status = 'completed') AS successes,
    COUNT(*) FILTER (WHERE status = 'failed') AS failures,
    ROUND(AVG(duration_ms) FILTER (WHERE status = 'completed'), 0) AS avg_duration_ms
  FROM cron_job_logs
  WHERE job_name = p_job_name
    AND started_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY time_bucket
  ORDER BY time_bucket DESC;
$$;

COMMENT ON FUNCTION get_cron_job_timeline IS 'Get hourly execution timeline for a cron job';

-- Function to toggle job enabled state
CREATE OR REPLACE FUNCTION toggle_cron_job(
  p_job_name VARCHAR(100),
  p_enabled BOOLEAN,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO cron_job_config (job_name, enabled, last_modified_by)
  VALUES (p_job_name, p_enabled, p_user_id)
  ON CONFLICT (job_name) DO UPDATE
  SET
    enabled = p_enabled,
    last_modified_at = NOW(),
    last_modified_by = p_user_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION toggle_cron_job IS 'Enable or disable a cron job';

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_config ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all cron logs"
  ON cron_job_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Service role can insert logs
CREATE POLICY "Service role can insert cron logs"
  ON cron_job_logs FOR INSERT
  WITH CHECK (TRUE);

-- Prevent updates and deletes on logs
CREATE POLICY "Cron logs are immutable"
  ON cron_job_logs FOR UPDATE
  USING (FALSE);

CREATE POLICY "Cron logs cannot be deleted manually"
  ON cron_job_logs FOR DELETE
  USING (FALSE);

-- Admins can view config
CREATE POLICY "Admins can view cron config"
  ON cron_job_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admins can modify config
CREATE POLICY "Admins can modify cron config"
  ON cron_job_config FOR ALL
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

GRANT SELECT ON cron_job_logs TO authenticated;
GRANT INSERT ON cron_job_logs TO authenticated;

GRANT SELECT ON cron_job_config TO authenticated;
GRANT INSERT, UPDATE ON cron_job_config TO authenticated;

GRANT SELECT ON recent_cron_executions TO authenticated;
GRANT SELECT ON cron_job_success_rates TO authenticated;
GRANT SELECT ON failed_cron_jobs TO authenticated;
GRANT SELECT ON running_cron_jobs TO authenticated;

GRANT EXECUTE ON FUNCTION get_cron_job_stats TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_cron_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_cron_job_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_cron_job TO authenticated;

-- ============================================================================
-- 7. Initial Data
-- ============================================================================

-- Insert default configurations for all jobs
INSERT INTO cron_job_config (job_name, enabled) VALUES
  ('process-opportunity-offers', true),
  ('opportunity-reminders', true),
  ('process-promotion-deliveries', true),
  ('calculate-promotion-analytics', true),
  ('promotion-triggers', true),
  ('send-review-requests', true),
  ('review-follow-ups', true),
  ('process-tier-upgrades', true),
  ('process-achievements', true),
  ('process-referrals', true),
  ('aggregate-portal-analytics', true),
  ('aggregate-opportunity-analytics', true),
  ('health-check', true),
  ('cleanup-expired-sessions', true),
  ('cleanup-old-logs', true),
  ('cleanup-old-uptime-logs', true),
  ('cleanup-old-alerts', true)
ON CONFLICT (job_name) DO NOTHING;
