-- =====================================================
-- Portal Health & Status System
-- =====================================================
-- Tracks feature flags, system status, and incidents

-- =====================================================
-- Feature Flags
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT false NOT NULL,
  rollout_percentage integer DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  user_ids uuid[] DEFAULT ARRAY[]::uuid[],
  customer_ids uuid[] DEFAULT ARRAY[]::uuid[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Index for quick lookups
CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled);

-- RLS policies
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone can read feature flags (portal needs to check them)
CREATE POLICY feature_flags_read
ON feature_flags
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify feature flags
CREATE POLICY feature_flags_modify
ON feature_flags
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- =====================================================
-- System Status & Incidents
-- =====================================================

CREATE TABLE IF NOT EXISTS system_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance')),
  component text NOT NULL CHECK (component IN ('api', 'database', 'stripe', 'twilio', 'email', 'portal', 'crm')),
  message text,
  started_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Index for quick lookups
CREATE INDEX idx_system_status_component ON system_status(component, started_at DESC);
CREATE INDEX idx_system_status_unresolved ON system_status(component) WHERE resolved_at IS NULL;

-- RLS policies
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;

-- Anyone can read system status
CREATE POLICY system_status_read
ON system_status
FOR SELECT
TO authenticated
USING (true);

-- Only admins can create/update status
CREATE POLICY system_status_modify
ON system_status
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- =====================================================
-- Maintenance Windows
-- =====================================================

CREATE TABLE IF NOT EXISTS maintenance_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  affects_portal boolean DEFAULT true NOT NULL,
  affects_crm boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Index for upcoming maintenance
CREATE INDEX idx_maintenance_windows_upcoming ON maintenance_windows(scheduled_start) WHERE status IN ('scheduled', 'in_progress');

-- RLS policies
ALTER TABLE maintenance_windows ENABLE ROW LEVEL SECURITY;

-- Anyone can read maintenance windows
CREATE POLICY maintenance_windows_read
ON maintenance_windows
FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage maintenance windows
CREATE POLICY maintenance_windows_modify
ON maintenance_windows
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- =====================================================
-- Health Check Logs
-- =====================================================

CREATE TABLE IF NOT EXISTS health_check_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  response_time_ms integer,
  error_message text,
  checked_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Partition by month for performance (optional, can be added later)
CREATE INDEX idx_health_check_logs_component_time ON health_check_logs(component, checked_at DESC);
CREATE INDEX idx_health_check_logs_status ON health_check_logs(status, checked_at DESC);

-- Auto-delete old logs after 30 days
-- This will be handled by a cron job or manually

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to check if a feature is enabled for a user
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_feature_key text,
  p_user_id uuid DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_flag feature_flags;
  v_random_value integer;
BEGIN
  -- Get feature flag
  SELECT * INTO v_flag
  FROM feature_flags
  WHERE key = p_feature_key;

  -- Feature doesn't exist or is disabled
  IF v_flag IS NULL OR v_flag.enabled = false THEN
    RETURN false;
  END IF;

  -- Check if user is in whitelist
  IF p_user_id IS NOT NULL AND p_user_id = ANY(v_flag.user_ids) THEN
    RETURN true;
  END IF;

  -- Check if customer is in whitelist
  IF p_customer_id IS NOT NULL AND p_customer_id = ANY(v_flag.customer_ids) THEN
    RETURN true;
  END IF;

  -- Check rollout percentage
  -- Use deterministic hash for consistent results per user/customer
  IF p_user_id IS NOT NULL THEN
    v_random_value := (hashtext(p_user_id::text) % 100)::integer;
  ELSIF p_customer_id IS NOT NULL THEN
    v_random_value := (hashtext(p_customer_id::text) % 100)::integer;
  ELSE
    v_random_value := (random() * 100)::integer;
  END IF;

  RETURN v_random_value < v_flag.rollout_percentage;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get current system status
CREATE OR REPLACE FUNCTION get_system_status()
RETURNS TABLE (
  component text,
  status text,
  message text,
  since timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (s.component)
    s.component,
    s.status,
    s.message,
    s.started_at
  FROM system_status s
  WHERE s.resolved_at IS NULL
  ORDER BY s.component, s.started_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get upcoming maintenance windows
CREATE OR REPLACE FUNCTION get_upcoming_maintenance(p_hours_ahead integer DEFAULT 168)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text,
  affects_portal boolean,
  affects_crm boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.title,
    m.description,
    m.scheduled_start,
    m.scheduled_end,
    m.status,
    m.affects_portal,
    m.affects_crm
  FROM maintenance_windows m
  WHERE m.status IN ('scheduled', 'in_progress')
    AND m.scheduled_start <= now() + (p_hours_ahead || ' hours')::interval
  ORDER BY m.scheduled_start ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to log health check
CREATE OR REPLACE FUNCTION log_health_check(
  p_component text,
  p_status text,
  p_response_time_ms integer DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO health_check_logs (
    component,
    status,
    response_time_ms,
    error_message,
    metadata
  )
  VALUES (
    p_component,
    p_status,
    p_response_time_ms,
    p_error_message,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp for feature flags
CREATE OR REPLACE FUNCTION update_feature_flag_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_feature_flag_timestamp ON feature_flags;
CREATE TRIGGER trigger_update_feature_flag_timestamp
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flag_timestamp();

-- =====================================================
-- Insert default feature flags
-- =====================================================

INSERT INTO feature_flags (key, name, description, enabled, rollout_percentage)
VALUES
  ('portal_analytics', 'Portal Analytics', 'Enable analytics tracking in customer portal', true, 100),
  ('portal_messaging', 'Portal Messaging', 'Enable messaging features in portal', true, 100),
  ('portal_auto_booking', 'Auto Booking', 'Enable automatic booking confirmation', true, 100),
  ('portal_payment_methods', 'Payment Methods', 'Enable saved payment methods', true, 100),
  ('portal_notifications', 'Portal Notifications', 'Enable in-app notifications', true, 100),
  ('portal_dark_mode', 'Dark Mode', 'Enable dark mode theme', false, 0),
  ('portal_ai_chat', 'AI Chat Support', 'Enable AI-powered chat support', false, 0),
  ('portal_loyalty_program', 'Loyalty Program', 'Enable loyalty points and rewards', false, 0)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION is_feature_enabled(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_upcoming_maintenance(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION log_health_check(text, text, integer, text, jsonb) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE feature_flags IS 'Feature flags for controlling feature rollouts and A/B testing';
COMMENT ON TABLE system_status IS 'System component status and incident tracking';
COMMENT ON TABLE maintenance_windows IS 'Scheduled maintenance windows';
COMMENT ON TABLE health_check_logs IS 'Health check monitoring logs';

COMMENT ON FUNCTION is_feature_enabled(text, uuid, uuid) IS 'Check if a feature flag is enabled for a user or customer';
COMMENT ON FUNCTION get_system_status() IS 'Get current status of all system components';
COMMENT ON FUNCTION get_upcoming_maintenance(integer) IS 'Get upcoming maintenance windows within specified hours';
COMMENT ON FUNCTION log_health_check(text, text, integer, text, jsonb) IS 'Log a health check result';
