-- =====================================================
-- Customer Communication Preferences
-- =====================================================
-- Manages customer communication preferences and opt-out status
-- Ensures compliance with CAN-SPAM, TCPA, and GDPR

-- =====================================================
-- Communication Preferences Table
-- =====================================================

CREATE TABLE IF NOT EXISTS customer_communication_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE UNIQUE NOT NULL,

  -- Channel preferences
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT true,
  portal_notifications_enabled boolean DEFAULT true,
  phone_calls_enabled boolean DEFAULT true,

  -- Message type preferences
  marketing_emails boolean DEFAULT true,
  appointment_reminders boolean DEFAULT true,
  service_updates boolean DEFAULT true,
  promotional_messages boolean DEFAULT false,
  billing_notifications boolean DEFAULT true,
  survey_requests boolean DEFAULT true,

  -- Contact preferences
  preferred_contact_method varchar(20) CHECK (preferred_contact_method IN ('email', 'sms', 'phone', 'portal')),
  preferred_contact_time varchar(20), -- 'morning', 'afternoon', 'evening', 'anytime'
  language_preference varchar(10) DEFAULT 'en',
  timezone varchar(50),

  -- Opt-out status
  do_not_contact boolean DEFAULT false,
  opted_out_at timestamptz,
  opt_out_reason text,

  -- Frequency preferences
  max_messages_per_week integer DEFAULT 10,
  quiet_hours_start time,
  quiet_hours_end time,

  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_customer_comm_prefs_customer ON customer_communication_preferences(customer_id);
CREATE INDEX idx_customer_comm_prefs_do_not_contact ON customer_communication_preferences(do_not_contact) WHERE do_not_contact = true;
CREATE INDEX idx_customer_comm_prefs_email_enabled ON customer_communication_preferences(email_enabled) WHERE email_enabled = true;
CREATE INDEX idx_customer_comm_prefs_sms_enabled ON customer_communication_preferences(sms_enabled) WHERE sms_enabled = true;

-- =====================================================
-- Communication Preference Violations Log
-- =====================================================

CREATE TABLE IF NOT EXISTS communication_preference_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  violation_type varchar(50) NOT NULL, -- 'do_not_contact', 'sms_disabled', 'email_disabled', 'quiet_hours', etc.
  attempted_channel varchar(20) NOT NULL,
  attempted_message_type varchar(50),
  blocked boolean DEFAULT true,
  staff_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for violation tracking
CREATE INDEX idx_comm_pref_violations_customer ON communication_preference_violations(customer_id);
CREATE INDEX idx_comm_pref_violations_type ON communication_preference_violations(violation_type);
CREATE INDEX idx_comm_pref_violations_created ON communication_preference_violations(created_at DESC);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE customer_communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_preference_violations ENABLE ROW LEVEL SECURITY;

-- Customers can view and update their own preferences
CREATE POLICY customer_comm_prefs_own_read
ON customer_communication_preferences
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

CREATE POLICY customer_comm_prefs_own_update
ON customer_communication_preferences
FOR UPDATE
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- Staff can view and update all preferences
CREATE POLICY customer_comm_prefs_staff_read
ON customer_communication_preferences
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

CREATE POLICY customer_comm_prefs_staff_update
ON customer_communication_preferences
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Staff can insert preferences
CREATE POLICY customer_comm_prefs_staff_insert
ON customer_communication_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Customers can insert their own preferences
CREATE POLICY customer_comm_prefs_own_insert
ON customer_communication_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- Staff can view all violations
CREATE POLICY comm_pref_violations_staff_read
ON communication_preference_violations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher')
  )
);

-- Customers can view their own violations
CREATE POLICY comm_pref_violations_own_read
ON communication_preference_violations
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_communication_preferences_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_communication_preferences_timestamp ON customer_communication_preferences;
CREATE TRIGGER trigger_update_communication_preferences_timestamp
  BEFORE UPDATE ON customer_communication_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_communication_preferences_timestamp();

-- Auto-set opted_out_at when do_not_contact is set to true
CREATE OR REPLACE FUNCTION set_opted_out_timestamp()
RETURNS trigger AS $$
BEGIN
  IF NEW.do_not_contact = true AND OLD.do_not_contact = false THEN
    NEW.opted_out_at = now();
  ELSIF NEW.do_not_contact = false THEN
    NEW.opted_out_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_opted_out_timestamp ON customer_communication_preferences;
CREATE TRIGGER trigger_set_opted_out_timestamp
  BEFORE UPDATE ON customer_communication_preferences
  FOR EACH ROW
  EXECUTE FUNCTION set_opted_out_timestamp();

-- Create default preferences when customer is created
CREATE OR REPLACE FUNCTION create_default_communication_preferences()
RETURNS trigger AS $$
BEGIN
  INSERT INTO customer_communication_preferences (customer_id)
  VALUES (NEW.id)
  ON CONFLICT (customer_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_default_communication_preferences ON customers;
CREATE TRIGGER trigger_create_default_communication_preferences
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION create_default_communication_preferences();

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to check if communication is allowed
CREATE OR REPLACE FUNCTION check_communication_allowed(
  p_customer_id uuid,
  p_channel varchar(20), -- 'email', 'sms', 'phone', 'portal'
  p_message_type varchar(50) DEFAULT NULL -- 'marketing', 'appointment', 'service', 'promotional', 'billing', 'survey'
)
RETURNS TABLE (
  allowed boolean,
  reason text
) AS $$
DECLARE
  v_prefs record;
BEGIN
  -- Get customer preferences
  SELECT * INTO v_prefs
  FROM customer_communication_preferences
  WHERE customer_id = p_customer_id;

  -- If no preferences exist, create default and allow
  IF NOT FOUND THEN
    INSERT INTO customer_communication_preferences (customer_id)
    VALUES (p_customer_id)
    RETURNING * INTO v_prefs;
  END IF;

  -- Check do not contact
  IF v_prefs.do_not_contact = true THEN
    RETURN QUERY SELECT false, 'Customer has opted out of all communications'::text;
    RETURN;
  END IF;

  -- Check channel-specific preferences
  IF p_channel = 'email' AND v_prefs.email_enabled = false THEN
    RETURN QUERY SELECT false, 'Customer has disabled email communications'::text;
    RETURN;
  END IF;

  IF p_channel = 'sms' AND v_prefs.sms_enabled = false THEN
    RETURN QUERY SELECT false, 'Customer has disabled SMS communications'::text;
    RETURN;
  END IF;

  IF p_channel = 'phone' AND v_prefs.phone_calls_enabled = false THEN
    RETURN QUERY SELECT false, 'Customer has disabled phone calls'::text;
    RETURN;
  END IF;

  IF p_channel = 'portal' AND v_prefs.portal_notifications_enabled = false THEN
    RETURN QUERY SELECT false, 'Customer has disabled portal notifications'::text;
    RETURN;
  END IF;

  -- Check message type preferences
  IF p_message_type IS NOT NULL THEN
    IF p_message_type = 'marketing' AND v_prefs.marketing_emails = false THEN
      RETURN QUERY SELECT false, 'Customer has opted out of marketing messages'::text;
      RETURN;
    END IF;

    IF p_message_type = 'promotional' AND v_prefs.promotional_messages = false THEN
      RETURN QUERY SELECT false, 'Customer has opted out of promotional messages'::text;
      RETURN;
    END IF;

    IF p_message_type = 'survey' AND v_prefs.survey_requests = false THEN
      RETURN QUERY SELECT false, 'Customer has opted out of survey requests'::text;
      RETURN;
    END IF;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, 'Communication allowed'::text;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to log preference violation
CREATE OR REPLACE FUNCTION log_preference_violation(
  p_customer_id uuid,
  p_violation_type varchar(50),
  p_attempted_channel varchar(20),
  p_attempted_message_type varchar(50) DEFAULT NULL,
  p_blocked boolean DEFAULT true,
  p_staff_user_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_violation_id uuid;
BEGIN
  INSERT INTO communication_preference_violations (
    customer_id,
    violation_type,
    attempted_channel,
    attempted_message_type,
    blocked,
    staff_user_id,
    details
  ) VALUES (
    p_customer_id,
    p_violation_type,
    p_attempted_channel,
    p_attempted_message_type,
    p_blocked,
    p_staff_user_id,
    p_details
  )
  RETURNING id INTO v_violation_id;

  RETURN v_violation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer communication history
CREATE OR REPLACE FUNCTION get_customer_communication_history(
  p_customer_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  communication_type varchar(50),
  channel varchar(20),
  subject text,
  sent_at timestamptz,
  delivered boolean,
  read boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH all_communications AS (
    -- Customer messages
    SELECT
      cm.id,
      'message'::varchar(50) as communication_type,
      CASE
        WHEN cm.sender_type = 'chatbot' THEN 'portal'
        ELSE 'portal'
      END::varchar(20) as channel,
      LEFT(cm.message_text, 100) as subject,
      cm.created_at as sent_at,
      true as delivered,
      cm.read_at IS NOT NULL as read
    FROM customer_messages cm
    WHERE cm.customer_id = p_customer_id
      AND cm.deleted_at IS NULL

    UNION ALL

    -- Broadcast deliveries
    SELECT
      bd.id,
      'broadcast'::varchar(50) as communication_type,
      bd.delivery_method::varchar(20) as channel,
      bm.subject as subject,
      bd.delivered_at as sent_at,
      bd.delivered_at IS NOT NULL as delivered,
      bd.read_at IS NOT NULL as read
    FROM broadcast_deliveries bd
    INNER JOIN broadcast_messages bm ON bm.id = bd.broadcast_id
    WHERE bd.customer_id = p_customer_id
      AND bd.failed = false
  )
  SELECT * FROM all_communications
  ORDER BY sent_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get preference violation statistics
CREATE OR REPLACE FUNCTION get_preference_violation_stats(
  p_customer_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  total_violations bigint,
  blocked_violations bigint,
  by_type jsonb,
  by_channel jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_violations,
    COUNT(CASE WHEN blocked THEN 1 END)::bigint as blocked_violations,
    jsonb_object_agg(
      violation_type,
      COUNT(*)
    ) FILTER (WHERE violation_type IS NOT NULL) as by_type,
    jsonb_object_agg(
      attempted_channel,
      COUNT(*)
    ) FILTER (WHERE attempted_channel IS NOT NULL) as by_channel
  FROM communication_preference_violations
  WHERE
    (p_customer_id IS NULL OR customer_id = p_customer_id)
    AND created_at >= now() - (p_days || ' days')::interval;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION check_communication_allowed(uuid, varchar, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION log_preference_violation(uuid, varchar, varchar, varchar, boolean, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_communication_history(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_preference_violation_stats(uuid, integer) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE customer_communication_preferences IS 'Stores customer communication preferences and opt-out status';
COMMENT ON TABLE communication_preference_violations IS 'Logs attempts to communicate that violated customer preferences';

COMMENT ON FUNCTION check_communication_allowed(uuid, varchar, varchar) IS 'Check if communication is allowed based on customer preferences';
COMMENT ON FUNCTION log_preference_violation(uuid, varchar, varchar, varchar, boolean, uuid, jsonb) IS 'Log a communication preference violation';
COMMENT ON FUNCTION get_customer_communication_history(uuid, integer) IS 'Get customer communication history across all channels';
COMMENT ON FUNCTION get_preference_violation_stats(uuid, integer) IS 'Get statistics on preference violations';
