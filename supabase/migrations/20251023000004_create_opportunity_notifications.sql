-- Opportunity Notification Preferences and Functions
-- Manages user preferences for opportunity-related notifications

-- User Notification Preferences Table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notification Types
  notify_new_opportunity_assigned BOOLEAN DEFAULT true,
  notify_follow_up_due_today BOOLEAN DEFAULT true,
  notify_follow_up_overdue BOOLEAN DEFAULT true,
  notify_offer_claimed BOOLEAN DEFAULT true,
  notify_opportunity_expiring BOOLEAN DEFAULT true,

  -- Delivery Channels
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  portal_notifications BOOLEAN DEFAULT true,

  -- Timing Preferences
  reminder_time TIME DEFAULT '08:00:00', -- Daily reminder time
  overdue_escalation_days INT DEFAULT 3, -- Days before escalating overdue
  expiring_warning_days INT DEFAULT 7, -- Days before expiring to warn

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Index for quick user lookup
CREATE INDEX idx_notification_prefs_user ON user_notification_preferences(user_id);

-- Function to get or create user notification preferences
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS user_notification_preferences AS $$
DECLARE
  v_preferences user_notification_preferences;
BEGIN
  -- Try to get existing preferences
  SELECT * INTO v_preferences
  FROM user_notification_preferences
  WHERE user_id = p_user_id;

  -- If not found, create default preferences
  IF NOT FOUND THEN
    INSERT INTO user_notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_preferences;
  END IF;

  RETURN v_preferences;
END;
$$ LANGUAGE plpgsql;

-- Function to get users who need follow-up reminders today
CREATE OR REPLACE FUNCTION get_users_with_followups_today()
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  opportunity_count INT,
  preferences JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    u.email as user_email,
    u.full_name as user_name,
    COUNT(mo.id)::INT as opportunity_count,
    to_jsonb(unp.*) as preferences
  FROM users u
  INNER JOIN user_notification_preferences unp ON unp.user_id = u.id
  INNER JOIN missed_opportunities mo ON mo.assigned_to_user_id = u.id
  WHERE
    unp.notify_follow_up_due_today = true
    AND DATE(mo.follow_up_scheduled_date) = CURRENT_DATE
    AND mo.status NOT IN ('converted', 'declined')
    AND mo.converted = false
  GROUP BY u.id, u.email, u.full_name, unp.*;
END;
$$ LANGUAGE plpgsql;

-- Function to get users with overdue follow-ups
CREATE OR REPLACE FUNCTION get_users_with_overdue_followups()
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  opportunity_count INT,
  days_overdue INT,
  preferences JSONB,
  manager_id UUID,
  manager_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    u.email as user_email,
    u.full_name as user_name,
    COUNT(mo.id)::INT as opportunity_count,
    MAX(CURRENT_DATE - DATE(mo.follow_up_scheduled_date))::INT as days_overdue,
    to_jsonb(unp.*) as preferences,
    NULL::UUID as manager_id, -- Can be enhanced with manager lookup
    NULL::TEXT as manager_email
  FROM users u
  INNER JOIN user_notification_preferences unp ON unp.user_id = u.id
  INNER JOIN missed_opportunities mo ON mo.assigned_to_user_id = u.id
  WHERE
    unp.notify_follow_up_overdue = true
    AND DATE(mo.follow_up_scheduled_date) < CURRENT_DATE
    AND mo.status NOT IN ('converted', 'declined')
    AND mo.converted = false
  GROUP BY u.id, u.email, u.full_name, unp.*
  HAVING MAX(CURRENT_DATE - DATE(mo.follow_up_scheduled_date)) >= 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get opportunities expiring soon
CREATE OR REPLACE FUNCTION get_opportunities_expiring_soon()
RETURNS TABLE (
  opportunity_id UUID,
  customer_name TEXT,
  opportunity_type TEXT,
  estimated_value NUMERIC,
  days_until_expiry INT,
  assigned_user_id UUID,
  assigned_user_email TEXT,
  assigned_user_name TEXT,
  preferences JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mo.id as opportunity_id,
    c.full_name as customer_name,
    mo.opportunity_type,
    mo.estimated_value,
    (DATE(oo.expires_at) - CURRENT_DATE)::INT as days_until_expiry,
    u.id as assigned_user_id,
    u.email as assigned_user_email,
    u.full_name as assigned_user_name,
    to_jsonb(unp.*) as preferences
  FROM missed_opportunities mo
  INNER JOIN customers c ON c.id = mo.customer_id
  INNER JOIN users u ON u.id = mo.assigned_to_user_id
  INNER JOIN user_notification_preferences unp ON unp.user_id = u.id
  LEFT JOIN opportunity_offers oo ON oo.opportunity_id = mo.id
  WHERE
    unp.notify_opportunity_expiring = true
    AND mo.status = 'offer_sent'
    AND mo.converted = false
    AND oo.expires_at IS NOT NULL
    AND DATE(oo.expires_at) > CURRENT_DATE
    AND DATE(oo.expires_at) <= CURRENT_DATE + unp.expiring_warning_days
    AND oo.claimed_at IS NULL; -- Only if not yet claimed
END;
$$ LANGUAGE plpgsql;

-- Function to get offer claimed notifications
CREATE OR REPLACE FUNCTION get_recent_offer_claims()
RETURNS TABLE (
  opportunity_id UUID,
  customer_name TEXT,
  offer_code TEXT,
  offer_percentage NUMERIC,
  claimed_at TIMESTAMPTZ,
  assigned_user_id UUID,
  assigned_user_email TEXT,
  assigned_user_name TEXT,
  preferences JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mo.id as opportunity_id,
    c.full_name as customer_name,
    oo.offer_code,
    oo.offer_percentage,
    oo.claimed_at,
    u.id as assigned_user_id,
    u.email as assigned_user_email,
    u.full_name as assigned_user_name,
    to_jsonb(unp.*) as preferences
  FROM missed_opportunities mo
  INNER JOIN customers c ON c.id = mo.customer_id
  INNER JOIN users u ON u.id = mo.assigned_to_user_id
  INNER JOIN user_notification_preferences unp ON unp.user_id = u.id
  INNER JOIN opportunity_offers oo ON oo.opportunity_id = mo.id
  WHERE
    unp.notify_offer_claimed = true
    AND oo.claimed_at >= NOW() - INTERVAL '1 hour' -- Recent claims only
    AND mo.converted = false;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_timestamp
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_timestamp();

-- Comments
COMMENT ON TABLE user_notification_preferences IS 'User preferences for opportunity notification delivery and timing';
COMMENT ON FUNCTION get_user_notification_preferences IS 'Gets or creates default notification preferences for a user';
COMMENT ON FUNCTION get_users_with_followups_today IS 'Returns users who have follow-ups due today with their preferences';
COMMENT ON FUNCTION get_users_with_overdue_followups IS 'Returns users with overdue follow-ups for escalation';
COMMENT ON FUNCTION get_opportunities_expiring_soon IS 'Returns opportunities with offers expiring soon';
COMMENT ON FUNCTION get_recent_offer_claims IS 'Returns recently claimed offers for notification';
