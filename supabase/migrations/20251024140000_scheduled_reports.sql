-- Scheduled Reports and Report Generation Logs
-- Automated report generation and delivery system

-- ============================================================================
-- 1. Scheduled Reports Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL CHECK (
    report_type IN (
      'revenue_summary',
      'customer_activity',
      'opportunity_pipeline',
      'promotion_performance',
      'loyalty_engagement'
    )
  ),
  schedule VARCHAR(50) NOT NULL,
  recipients TEXT[] NOT NULL,
  filters JSONB,
  format VARCHAR(20) NOT NULL CHECK (format IN ('pdf', 'csv', 'excel')),
  enabled BOOLEAN DEFAULT TRUE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scheduled reports
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_enabled
  ON scheduled_reports(enabled);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_report_type
  ON scheduled_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by
  ON scheduled_reports(created_by_user_id);

-- GIN index for filters JSONB
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_filters
  ON scheduled_reports USING GIN(filters);

-- Comments
COMMENT ON TABLE scheduled_reports IS 'Scheduled report configurations';
COMMENT ON COLUMN scheduled_reports.name IS 'Display name for the report';
COMMENT ON COLUMN scheduled_reports.report_type IS 'Type of report to generate';
COMMENT ON COLUMN scheduled_reports.schedule IS 'Cron expression for report schedule';
COMMENT ON COLUMN scheduled_reports.recipients IS 'Array of email addresses to send report to';
COMMENT ON COLUMN scheduled_reports.filters IS 'Filter criteria for report data';
COMMENT ON COLUMN scheduled_reports.format IS 'Output format: pdf, csv, or excel';
COMMENT ON COLUMN scheduled_reports.enabled IS 'Whether report generation is active';

-- ============================================================================
-- 2. Report Generation Log Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_generation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL,
  recipients TEXT[],
  file_name VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for report generation log
CREATE INDEX IF NOT EXISTS idx_report_log_scheduled_report
  ON report_generation_log(scheduled_report_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_log_generated_at
  ON report_generation_log(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_log_errors
  ON report_generation_log(error_message)
  WHERE error_message IS NOT NULL;

-- Comments
COMMENT ON TABLE report_generation_log IS 'Log of report generation attempts';
COMMENT ON COLUMN report_generation_log.scheduled_report_id IS 'ID of the scheduled report';
COMMENT ON COLUMN report_generation_log.generated_at IS 'When the report was generated';
COMMENT ON COLUMN report_generation_log.recipients IS 'Email addresses report was sent to';
COMMENT ON COLUMN report_generation_log.file_name IS 'Name of generated file';
COMMENT ON COLUMN report_generation_log.error_message IS 'Error message if generation failed';

-- ============================================================================
-- 3. Views for Reporting
-- ============================================================================

-- Recent report generations
CREATE OR REPLACE VIEW recent_report_generations AS
SELECT
  rgl.id,
  sr.name AS report_name,
  sr.report_type,
  rgl.generated_at,
  rgl.file_name,
  rgl.error_message,
  CASE
    WHEN rgl.error_message IS NULL THEN 'success'
    ELSE 'failed'
  END AS status,
  array_length(rgl.recipients, 1) AS recipient_count
FROM report_generation_log rgl
JOIN scheduled_reports sr ON sr.id = rgl.scheduled_report_id
WHERE rgl.generated_at > NOW() - INTERVAL '30 days'
ORDER BY rgl.generated_at DESC;

COMMENT ON VIEW recent_report_generations IS 'Recent report generations with status';

-- Report generation statistics
CREATE OR REPLACE VIEW report_generation_stats AS
SELECT
  sr.id,
  sr.name,
  sr.report_type,
  sr.enabled,
  COUNT(rgl.id) AS total_generations,
  COUNT(rgl.id) FILTER (WHERE rgl.error_message IS NULL) AS successful_generations,
  COUNT(rgl.id) FILTER (WHERE rgl.error_message IS NOT NULL) AS failed_generations,
  ROUND(
    (COUNT(rgl.id) FILTER (WHERE rgl.error_message IS NULL)::NUMERIC /
     NULLIF(COUNT(rgl.id), 0)::NUMERIC) * 100,
    2
  ) AS success_rate,
  MAX(rgl.generated_at) AS last_generated_at,
  MAX(rgl.generated_at) FILTER (WHERE rgl.error_message IS NULL) AS last_success_at,
  MAX(rgl.generated_at) FILTER (WHERE rgl.error_message IS NOT NULL) AS last_failure_at
FROM scheduled_reports sr
LEFT JOIN report_generation_log rgl ON sr.id = rgl.scheduled_report_id
  AND rgl.generated_at > NOW() - INTERVAL '30 days'
GROUP BY sr.id, sr.name, sr.report_type, sr.enabled
ORDER BY sr.name;

COMMENT ON VIEW report_generation_stats IS 'Statistics for each scheduled report (last 30 days)';

-- Failed report generations
CREATE OR REPLACE VIEW failed_report_generations AS
SELECT
  rgl.id,
  sr.name AS report_name,
  sr.report_type,
  rgl.generated_at,
  rgl.error_message,
  rgl.recipients
FROM report_generation_log rgl
JOIN scheduled_reports sr ON sr.id = rgl.scheduled_report_id
WHERE rgl.error_message IS NOT NULL
ORDER BY rgl.generated_at DESC
LIMIT 100;

COMMENT ON VIEW failed_report_generations IS 'Most recent 100 failed report generations';

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Function to get report generation history
CREATE OR REPLACE FUNCTION get_report_generation_history(
  p_report_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  generated_at TIMESTAMPTZ,
  recipients TEXT[],
  file_name VARCHAR,
  error_message TEXT,
  status VARCHAR
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    id,
    generated_at,
    recipients,
    file_name,
    error_message,
    CASE
      WHEN error_message IS NULL THEN 'success'
      ELSE 'failed'
    END AS status
  FROM report_generation_log
  WHERE scheduled_report_id = p_report_id
    AND generated_at > NOW() - (p_days || ' days')::INTERVAL
  ORDER BY generated_at DESC;
$$;

COMMENT ON FUNCTION get_report_generation_history IS 'Get generation history for a specific report';

-- Function to cleanup old report logs
CREATE OR REPLACE FUNCTION cleanup_old_report_logs(
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
    DELETE FROM report_generation_log
    WHERE generated_at < NOW() - (p_retention_days || ' days')::INTERVAL
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_report_logs IS 'Delete report logs older than specified days (default 90)';

-- Function to get report success rate
CREATE OR REPLACE FUNCTION get_report_success_rate(
  p_report_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
AS $$
  SELECT
    COALESCE(
      ROUND(
        (COUNT(*) FILTER (WHERE error_message IS NULL)::NUMERIC /
         NULLIF(COUNT(*), 0)::NUMERIC) * 100,
        2
      ),
      100.0
    )
  FROM report_generation_log
  WHERE scheduled_report_id = p_report_id
    AND generated_at > NOW() - (p_days || ' days')::INTERVAL;
$$;

COMMENT ON FUNCTION get_report_success_rate IS 'Calculate success rate for a report';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_report_timestamp()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_scheduled_reports_timestamp
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_report_timestamp();

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generation_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all reports
CREATE POLICY "Admins can view all scheduled reports"
  ON scheduled_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admins can create reports
CREATE POLICY "Admins can create scheduled reports"
  ON scheduled_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admins can update their own reports or any report
CREATE POLICY "Admins can update scheduled reports"
  ON scheduled_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admins can delete reports
CREATE POLICY "Admins can delete scheduled reports"
  ON scheduled_reports FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admins can view all report logs
CREATE POLICY "Admins can view all report logs"
  ON report_generation_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Service role can insert logs
CREATE POLICY "Service role can insert report logs"
  ON report_generation_log FOR INSERT
  WITH CHECK (TRUE);

-- Prevent updates and deletes on logs (immutable)
CREATE POLICY "Report logs are immutable"
  ON report_generation_log FOR UPDATE
  USING (FALSE);

CREATE POLICY "Report logs cannot be deleted manually"
  ON report_generation_log FOR DELETE
  USING (FALSE);

-- ============================================================================
-- 6. Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_reports TO authenticated;
GRANT SELECT, INSERT ON report_generation_log TO authenticated;

GRANT SELECT ON recent_report_generations TO authenticated;
GRANT SELECT ON report_generation_stats TO authenticated;
GRANT SELECT ON failed_report_generations TO authenticated;

GRANT EXECUTE ON FUNCTION get_report_generation_history TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_report_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_report_success_rate TO authenticated;

-- ============================================================================
-- 7. Sample Data (Optional)
-- ============================================================================

-- Insert example scheduled reports (commented out by default)
-- Uncomment to add sample reports

/*
INSERT INTO scheduled_reports (name, report_type, schedule, recipients, format, enabled) VALUES
  (
    'Daily Revenue Summary',
    'revenue_summary',
    '0 8 * * *',
    ARRAY['admin@dirtfreecarpet.com'],
    'pdf',
    true
  ),
  (
    'Weekly Customer Activity',
    'customer_activity',
    '0 8 * * 1',
    ARRAY['admin@dirtfreecarpet.com', 'manager@dirtfreecarpet.com'],
    'excel',
    true
  ),
  (
    'Monthly Opportunity Pipeline',
    'opportunity_pipeline',
    '0 8 1 * *',
    ARRAY['sales@dirtfreecarpet.com'],
    'csv',
    true
  ),
  (
    'Weekly Promotion Performance',
    'promotion_performance',
    '0 8 * * 1',
    ARRAY['marketing@dirtfreecarpet.com'],
    'pdf',
    true
  ),
  (
    'Monthly Loyalty Engagement',
    'loyalty_engagement',
    '0 8 1 * *',
    ARRAY['admin@dirtfreecarpet.com'],
    'excel',
    true
  );
*/
