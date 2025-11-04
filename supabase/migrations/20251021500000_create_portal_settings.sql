-- =====================================================
-- Portal Settings Enhancement
-- =====================================================
-- Extends existing customer preferences with portal-specific settings
-- Adds support for auto-booking, preferred technician, and more

-- Add portal-specific columns to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS auto_booking_enabled boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS preferred_technician_id uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS portal_language text DEFAULT 'en' CHECK (portal_language IN ('en', 'es')) NOT NULL,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Los_Angeles' NOT NULL;

-- Create index for preferred technician lookups
CREATE INDEX IF NOT EXISTS idx_customers_preferred_technician
ON customers(preferred_technician_id)
WHERE preferred_technician_id IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN customers.auto_booking_enabled IS 'Whether appointments should be auto-confirmed without staff approval';
COMMENT ON COLUMN customers.preferred_technician_id IS 'Customer''s preferred technician for all jobs';
COMMENT ON COLUMN customers.portal_language IS 'Language preference for portal interface';
COMMENT ON COLUMN customers.timezone IS 'Customer''s timezone for appointment scheduling';

-- =====================================================
-- Portal Settings History
-- =====================================================
-- Track changes to portal settings for audit purposes

CREATE TABLE IF NOT EXISTS portal_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by text NOT NULL CHECK (changed_by IN ('customer', 'staff', 'system')),
  changed_via text NOT NULL CHECK (changed_via IN ('portal', 'crm', 'api', 'migration')),
  changed_at timestamptz DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text,
  notes text
);

-- Index for history queries
CREATE INDEX idx_portal_settings_history_customer
ON portal_settings_history(customer_id, changed_at DESC);

CREATE INDEX idx_portal_settings_history_setting
ON portal_settings_history(setting_key, changed_at DESC);

-- RLS policies for settings history
ALTER TABLE portal_settings_history ENABLE ROW LEVEL SECURITY;

-- Customers can view their own settings history
CREATE POLICY portal_settings_history_customer_read
ON portal_settings_history
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers
    WHERE user_id = auth.uid()
  )
);

-- Staff can view all settings history
CREATE POLICY portal_settings_history_staff_read
ON portal_settings_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher')
  )
);

-- System can insert history records
CREATE POLICY portal_settings_history_insert
ON portal_settings_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to record settings changes
CREATE OR REPLACE FUNCTION record_portal_settings_change()
RETURNS trigger AS $$
BEGIN
  -- Record notification preferences change
  IF OLD.email_notifications IS DISTINCT FROM NEW.email_notifications THEN
    INSERT INTO portal_settings_history (customer_id, setting_key, old_value, new_value, changed_by, changed_via)
    VALUES (NEW.id, 'email_notifications', to_jsonb(OLD.email_notifications), to_jsonb(NEW.email_notifications), 'customer', 'portal');
  END IF;

  IF OLD.sms_notifications IS DISTINCT FROM NEW.sms_notifications THEN
    INSERT INTO portal_settings_history (customer_id, setting_key, old_value, new_value, changed_by, changed_via)
    VALUES (NEW.id, 'sms_notifications', to_jsonb(OLD.sms_notifications), to_jsonb(NEW.sms_notifications), 'customer', 'portal');
  END IF;

  -- Record communication preferences change
  IF OLD.preferred_communication IS DISTINCT FROM NEW.preferred_communication THEN
    INSERT INTO portal_settings_history (customer_id, setting_key, old_value, new_value, changed_by, changed_via)
    VALUES (NEW.id, 'preferred_communication', to_jsonb(OLD.preferred_communication), to_jsonb(NEW.preferred_communication), 'customer', 'portal');
  END IF;

  -- Record auto-booking change
  IF OLD.auto_booking_enabled IS DISTINCT FROM NEW.auto_booking_enabled THEN
    INSERT INTO portal_settings_history (customer_id, setting_key, old_value, new_value, changed_by, changed_via)
    VALUES (NEW.id, 'auto_booking_enabled', to_jsonb(OLD.auto_booking_enabled), to_jsonb(NEW.auto_booking_enabled), 'customer', 'portal');
  END IF;

  -- Record preferred technician change
  IF OLD.preferred_technician_id IS DISTINCT FROM NEW.preferred_technician_id THEN
    INSERT INTO portal_settings_history (customer_id, setting_key, old_value, new_value, changed_by, changed_via)
    VALUES (NEW.id, 'preferred_technician_id', to_jsonb(OLD.preferred_technician_id), to_jsonb(NEW.preferred_technician_id), 'customer', 'portal');
  END IF;

  -- Record language change
  IF OLD.portal_language IS DISTINCT FROM NEW.portal_language THEN
    INSERT INTO portal_settings_history (customer_id, setting_key, old_value, new_value, changed_by, changed_via)
    VALUES (NEW.id, 'portal_language', to_jsonb(OLD.portal_language), to_jsonb(NEW.portal_language), 'customer', 'portal');
  END IF;

  -- Record timezone change
  IF OLD.timezone IS DISTINCT FROM NEW.timezone THEN
    INSERT INTO portal_settings_history (customer_id, setting_key, old_value, new_value, changed_by, changed_via)
    VALUES (NEW.id, 'timezone', to_jsonb(OLD.timezone), to_jsonb(NEW.timezone), 'customer', 'portal');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to customers table
DROP TRIGGER IF EXISTS trigger_record_portal_settings_change ON customers;
CREATE TRIGGER trigger_record_portal_settings_change
  AFTER UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION record_portal_settings_change();

-- =====================================================
-- Get Portal Settings Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_portal_settings(p_customer_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_settings jsonb;
  v_preferred_tech jsonb;
BEGIN
  -- Get customer settings
  SELECT jsonb_build_object(
    'customerId', c.id,
    'notifications', jsonb_build_object(
      'email', COALESCE(c.email_notifications, true),
      'sms', COALESCE(c.sms_notifications, true),
      'push', true
    ),
    'communication', jsonb_build_object(
      'preferredMethod', COALESCE(c.preferred_communication, 'email'),
      'marketingOptOut', COALESCE(c.marketing_opt_out, false)
    ),
    'autoBooking', jsonb_build_object(
      'enabled', COALESCE(c.auto_booking_enabled, false)
    ),
    'preferences', jsonb_build_object(
      'language', COALESCE(c.portal_language, 'en'),
      'timezone', COALESCE(c.timezone, 'America/Los_Angeles')
    )
  )
  INTO v_settings
  FROM customers c
  WHERE c.id = p_customer_id;

  -- Get preferred technician details if set
  IF v_settings IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'email', u.email,
      'phone', u.phone
    )
    INTO v_preferred_tech
    FROM customers c
    LEFT JOIN users u ON u.id = c.preferred_technician_id
    WHERE c.id = p_customer_id
    AND c.preferred_technician_id IS NOT NULL;

    -- Add preferred technician to settings
    v_settings := jsonb_set(
      v_settings,
      '{preferredTechnician}',
      COALESCE(v_preferred_tech, 'null'::jsonb)
    );
  END IF;

  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_portal_settings(uuid) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE portal_settings_history IS 'Tracks all changes to customer portal settings for audit and conflict resolution';
COMMENT ON FUNCTION get_portal_settings(uuid) IS 'Returns comprehensive portal settings for a customer including preferences and preferred technician';
COMMENT ON FUNCTION record_portal_settings_change() IS 'Automatically records settings changes to portal_settings_history table';
