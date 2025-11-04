-- ================================================================
-- Portal Notifications System
-- ================================================================
-- Creates in-app notification system for customer portal
-- Supports multiple notification types with delivery tracking
-- ================================================================

-- Create portal_notifications table
CREATE TABLE IF NOT EXISTS portal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Notification content
  type text NOT NULL CHECK (type IN (
    'appointment_reminder',
    'appointment_confirmed',
    'appointment_rescheduled',
    'appointment_cancelled',
    'technician_on_way',
    'service_completed',
    'invoice_created',
    'invoice_due',
    'invoice_overdue',
    'payment_received',
    'message_reply',
    'promotion_available',
    'loyalty_reward',
    'survey_request',
    'general'
  )),
  title text NOT NULL,
  message text NOT NULL,

  -- Related entities
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  thread_id uuid REFERENCES truck_threads(id) ON DELETE SET NULL,

  -- Action link
  action_url text,
  action_label text,

  -- Status tracking
  is_read boolean DEFAULT false NOT NULL,
  read_at timestamptz,

  -- Priority
  priority text CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal' NOT NULL,

  -- Delivery tracking
  email_sent boolean DEFAULT false,
  email_sent_at timestamptz,
  sms_sent boolean DEFAULT false,
  sms_sent_at timestamptz,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portal_notifications_customer_id
  ON portal_notifications(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_notifications_unread
  ON portal_notifications(customer_id, is_read, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_portal_notifications_type
  ON portal_notifications(customer_id, type);

CREATE INDEX IF NOT EXISTS idx_portal_notifications_job
  ON portal_notifications(job_id)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_notifications_invoice
  ON portal_notifications(invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_notifications_priority
  ON portal_notifications(customer_id, priority, created_at DESC)
  WHERE priority IN ('high', 'urgent');

CREATE INDEX IF NOT EXISTS idx_portal_notifications_expires
  ON portal_notifications(expires_at)
  WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE portal_notifications ENABLE ROW LEVEL SECURITY;

-- Customers can view their own notifications
CREATE POLICY "Customers can view own notifications"
  ON portal_notifications FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE email = auth.email()
    )
  );

-- Customers can update their own notifications (mark as read)
CREATE POLICY "Customers can update own notifications"
  ON portal_notifications FOR UPDATE
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE email = auth.email()
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers
      WHERE email = auth.email()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_portal_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_portal_notification_updated_at ON portal_notifications;
CREATE TRIGGER trigger_update_portal_notification_updated_at
  BEFORE UPDATE ON portal_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_portal_notification_updated_at();

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM portal_notifications
  WHERE expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_as_read(
  p_notification_id uuid,
  p_customer_id uuid
)
RETURNS boolean AS $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE portal_notifications
  SET
    is_read = true,
    read_at = now()
  WHERE
    id = p_notification_id
    AND customer_id = p_customer_id
    AND is_read = false;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a customer
CREATE OR REPLACE FUNCTION mark_all_notifications_as_read(
  p_customer_id uuid
)
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE portal_notifications
  SET
    is_read = true,
    read_at = now()
  WHERE
    customer_id = p_customer_id
    AND is_read = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_customer_id uuid
)
RETURNS integer AS $$
DECLARE
  unread_count integer;
BEGIN
  SELECT COUNT(*)
  INTO unread_count
  FROM portal_notifications
  WHERE
    customer_id = p_customer_id
    AND is_read = false
    AND (expires_at IS NULL OR expires_at > now());

  RETURN unread_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for notification summary
CREATE OR REPLACE VIEW notification_summary AS
SELECT
  customer_id,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_count,
  COUNT(*) FILTER (WHERE priority IN ('high', 'urgent')) as priority_count,
  COUNT(*) FILTER (WHERE type = 'appointment_reminder') as appointment_reminders,
  COUNT(*) FILTER (WHERE type LIKE 'invoice_%') as invoice_notifications,
  COUNT(*) FILTER (WHERE type = 'message_reply') as message_replies,
  MAX(created_at) as last_notification_at
FROM portal_notifications
WHERE expires_at IS NULL OR expires_at > now()
GROUP BY customer_id;

-- Grant access to view
GRANT SELECT ON notification_summary TO authenticated;

-- Add helpful comments
COMMENT ON TABLE portal_notifications IS 'In-app notifications for customer portal';
COMMENT ON COLUMN portal_notifications.type IS 'Type of notification (appointment, invoice, message, etc.)';
COMMENT ON COLUMN portal_notifications.priority IS 'Notification priority level';
COMMENT ON COLUMN portal_notifications.email_sent IS 'Whether notification was sent via email';
COMMENT ON COLUMN portal_notifications.sms_sent IS 'Whether notification was sent via SMS';
COMMENT ON COLUMN portal_notifications.expires_at IS 'When notification expires and can be auto-deleted';
COMMENT ON FUNCTION mark_notification_as_read IS 'Mark a single notification as read';
COMMENT ON FUNCTION mark_all_notifications_as_read IS 'Mark all customer notifications as read';
COMMENT ON FUNCTION cleanup_expired_notifications IS 'Remove expired notifications (run via cron)';
COMMENT ON VIEW notification_summary IS 'Summary of notifications per customer';
