-- =====================================================
-- INTEGRATION HEALTH MONITORING SYSTEM
-- Tracks connectivity and health between all platforms
-- and external services
-- =====================================================

-- 1. CREATE INTEGRATION HEALTH TABLE
CREATE TABLE IF NOT EXISTS integration_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_name VARCHAR(100) NOT NULL UNIQUE,
  integration_type VARCHAR(50) NOT NULL, -- 'api', 'database', 'service', 'platform'

  -- Health status
  status VARCHAR(20) NOT NULL DEFAULT 'unknown', -- 'healthy', 'degraded', 'down', 'unknown'
  last_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_failure_at TIMESTAMP WITH TIME ZONE,

  -- Performance metrics
  response_time_ms INTEGER,
  success_rate DECIMAL(5,2), -- Last 24 hours
  error_count INTEGER DEFAULT 0,
  uptime_percentage DECIMAL(5,2), -- Last 30 days

  -- Error details
  last_error_message TEXT,
  last_error_details JSONB,

  -- Configuration
  endpoint_url TEXT,
  check_interval_minutes INTEGER DEFAULT 5,
  timeout_seconds INTEGER DEFAULT 30,
  enabled BOOLEAN DEFAULT true,

  -- Alerting
  alert_on_failure BOOLEAN DEFAULT true,
  alert_threshold INTEGER DEFAULT 3, -- Failures before alert
  consecutive_failures INTEGER DEFAULT 0,
  alert_sent_at TIMESTAMP WITH TIME ZONE,
  alert_email VARCHAR(255),

  -- Metadata
  description TEXT,
  metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_integration_health_status ON integration_health(status, last_check_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_health_type ON integration_health(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_health_enabled ON integration_health(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_integration_health_name ON integration_health(integration_name);

COMMENT ON TABLE integration_health IS 'Tracks health status of all platform integrations and external services';
COMMENT ON COLUMN integration_health.status IS 'Current health status: healthy, degraded, down, unknown';
COMMENT ON COLUMN integration_health.integration_type IS 'Type of integration: platform, database, service, api';
COMMENT ON COLUMN integration_health.consecutive_failures IS 'Number of consecutive failures (resets on success)';

-- 2. CREATE INTEGRATION HEALTH LOG TABLE
CREATE TABLE IF NOT EXISTS integration_health_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_name VARCHAR(100) NOT NULL,
  check_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL,
  response_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  error_details JSONB,
  metadata JSONB,

  -- Foreign key to integration_health
  integration_id UUID REFERENCES integration_health(id) ON DELETE CASCADE
);

-- Create indexes for health log
CREATE INDEX IF NOT EXISTS idx_health_log_integration ON integration_health_log(integration_name, check_time DESC);
CREATE INDEX IF NOT EXISTS idx_health_log_time ON integration_health_log(check_time DESC);
CREATE INDEX IF NOT EXISTS idx_health_log_success ON integration_health_log(success, check_time DESC);
CREATE INDEX IF NOT EXISTS idx_health_log_integration_id ON integration_health_log(integration_id);

-- Partition by month for better performance (optional)
-- This can be added later if the table grows large

COMMENT ON TABLE integration_health_log IS 'Historical log of all integration health checks';

-- 3. INSERT INITIAL INTEGRATIONS TO MONITOR
INSERT INTO integration_health (
  integration_name,
  integration_type,
  endpoint_url,
  check_interval_minutes,
  description
) VALUES
  (
    'CRM Platform',
    'platform',
    NULL, -- Will be set based on environment
    5,
    'Main CRM application for managing customers, jobs, and operations'
  ),
  (
    'Customer Portal',
    'platform',
    NULL, -- Will be set based on environment
    5,
    'Customer-facing portal for bookings, payments, and communication'
  ),
  (
    'Marketing Website',
    'platform',
    NULL, -- Will be set based on environment
    10,
    'Public-facing marketing website'
  ),
  (
    'Supabase Database',
    'database',
    NULL,
    2,
    'Primary PostgreSQL database via Supabase'
  ),
  (
    'Stripe Payment Gateway',
    'service',
    'https://api.stripe.com/v1/charges?limit=1',
    15,
    'Payment processing service'
  ),
  (
    'Twilio SMS Service',
    'service',
    NULL,
    15,
    'SMS messaging service via Twilio'
  ),
  (
    'Resend Email Service',
    'service',
    NULL,
    15,
    'Transactional email service via Resend'
  ),
  (
    'Supabase Storage',
    'service',
    NULL,
    10,
    'File storage service'
  ),
  (
    'Supabase Auth',
    'service',
    NULL,
    5,
    'Authentication service'
  )
ON CONFLICT (integration_name) DO NOTHING;

-- 4. ROW LEVEL SECURITY
ALTER TABLE integration_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_health_log ENABLE ROW LEVEL SECURITY;

-- Admin and manager can view health data
CREATE POLICY "Admins can view integration health"
  ON integration_health FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Service role has full access
CREATE POLICY "Service role full access to integration health"
  ON integration_health
  USING (auth.role() = 'service_role');

-- Admins can view health logs
CREATE POLICY "Admins can view integration health logs"
  ON integration_health_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Service role has full access to logs
CREATE POLICY "Service role full access to health logs"
  ON integration_health_log
  USING (auth.role() = 'service_role');

-- 5. CREATE UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_integration_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_integration_health_updated_at
  BEFORE UPDATE ON integration_health
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_health_updated_at();

-- 6. CREATE HELPER FUNCTIONS

-- Function to calculate success rate over last 24 hours
CREATE OR REPLACE FUNCTION calculate_success_rate(p_integration_name VARCHAR)
RETURNS DECIMAL AS $$
DECLARE
  success_rate DECIMAL;
BEGIN
  SELECT
    ROUND(
      (COUNT(*) FILTER (WHERE success = true)::DECIMAL /
       NULLIF(COUNT(*)::DECIMAL, 0)) * 100,
      2
    )
  INTO success_rate
  FROM integration_health_log
  WHERE
    integration_name = p_integration_name AND
    check_time > NOW() - INTERVAL '24 hours';

  RETURN COALESCE(success_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate uptime percentage over last 30 days
CREATE OR REPLACE FUNCTION calculate_uptime(p_integration_name VARCHAR)
RETURNS DECIMAL AS $$
DECLARE
  uptime DECIMAL;
BEGIN
  SELECT
    ROUND(
      (COUNT(*) FILTER (WHERE status IN ('healthy', 'degraded'))::DECIMAL /
       NULLIF(COUNT(*)::DECIMAL, 0)) * 100,
      2
    )
  INTO uptime
  FROM integration_health_log
  WHERE
    integration_name = p_integration_name AND
    check_time > NOW() - INTERVAL '30 days';

  RETURN COALESCE(uptime, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get average response time over last hour
CREATE OR REPLACE FUNCTION get_avg_response_time(p_integration_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  avg_time INTEGER;
BEGIN
  SELECT ROUND(AVG(response_time_ms))::INTEGER
  INTO avg_time
  FROM integration_health_log
  WHERE
    integration_name = p_integration_name AND
    check_time > NOW() - INTERVAL '1 hour' AND
    success = true;

  RETURN COALESCE(avg_time, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old health logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_health_logs()
RETURNS INTEGER AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  DELETE FROM integration_health_log
  WHERE check_time < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE VIEWS FOR MONITORING

-- Current health status view
CREATE OR REPLACE VIEW v_integration_health_current AS
SELECT
  ih.integration_name,
  ih.integration_type,
  ih.status,
  ih.last_check_at,
  ih.response_time_ms,
  ih.consecutive_failures,
  ih.success_rate,
  ih.uptime_percentage,
  ih.last_error_message,
  ih.enabled,
  CASE
    WHEN ih.last_check_at < NOW() - (ih.check_interval_minutes * 2 || ' minutes')::INTERVAL THEN 'stale'
    ELSE 'current'
  END as check_status
FROM integration_health ih
ORDER BY
  CASE ih.status
    WHEN 'down' THEN 1
    WHEN 'degraded' THEN 2
    WHEN 'unknown' THEN 3
    WHEN 'healthy' THEN 4
  END,
  ih.integration_type,
  ih.integration_name;

COMMENT ON VIEW v_integration_health_current IS 'Current health status of all integrations with staleness check';

-- Health summary by type
CREATE OR REPLACE VIEW v_integration_health_summary AS
SELECT
  integration_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'healthy') as healthy_count,
  COUNT(*) FILTER (WHERE status = 'degraded') as degraded_count,
  COUNT(*) FILTER (WHERE status = 'down') as down_count,
  COUNT(*) FILTER (WHERE status = 'unknown') as unknown_count,
  ROUND(AVG(response_time_ms), 0) as avg_response_time_ms,
  ROUND(AVG(success_rate), 2) as avg_success_rate,
  ROUND(AVG(uptime_percentage), 2) as avg_uptime
FROM integration_health
WHERE enabled = true
GROUP BY integration_type;

COMMENT ON VIEW v_integration_health_summary IS 'Summary statistics grouped by integration type';

-- Recent failures view
CREATE OR REPLACE VIEW v_recent_integration_failures AS
SELECT
  ihl.integration_name,
  ihl.check_time,
  ihl.error_message,
  ihl.response_time_ms,
  ih.integration_type,
  ih.status as current_status
FROM integration_health_log ihl
JOIN integration_health ih ON ih.integration_name = ihl.integration_name
WHERE
  ihl.success = false AND
  ihl.check_time > NOW() - INTERVAL '24 hours'
ORDER BY ihl.check_time DESC;

COMMENT ON VIEW v_recent_integration_failures IS 'Recent failures in the last 24 hours';

-- 8. GRANTS
GRANT SELECT ON integration_health TO authenticated;
GRANT SELECT ON integration_health_log TO authenticated;
GRANT SELECT ON v_integration_health_current TO authenticated;
GRANT SELECT ON v_integration_health_summary TO authenticated;
GRANT SELECT ON v_recent_integration_failures TO authenticated;
GRANT ALL ON integration_health TO service_role;
GRANT ALL ON integration_health_log TO service_role;

-- =====================================================
-- NOTES FOR MANUAL SETUP
-- =====================================================

-- IMPORTANT: Set up cron job for health checks:
-- 1. Schedule to run every 5 minutes: */5 * * * *
-- 2. Endpoint: /api/cron/check-integration-health
-- 3. Include Authorization header with CRON_SECRET

-- IMPORTANT: Set up cron job for cleanup:
-- 1. Schedule to run daily: 0 3 * * *
-- 2. Endpoint: /api/cron/cleanup-health-logs
-- 3. Include Authorization header with CRON_SECRET

-- IMPORTANT: Update endpoint URLs in integration_health table:
-- UPDATE integration_health SET endpoint_url = 'https://your-crm-url/api/health'
-- WHERE integration_name = 'CRM Platform';

-- IMPORTANT: Set alert email addresses:
-- UPDATE integration_health SET alert_email = 'alerts@dirtfreecarpet.com'
-- WHERE alert_on_failure = true;
