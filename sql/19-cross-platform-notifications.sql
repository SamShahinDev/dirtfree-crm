-- =====================================================
-- CROSS-PLATFORM NOTIFICATIONS SYSTEM
-- Creates unified notification system that works across
-- CRM, Portal, and Website platforms
-- =====================================================

-- 1. CREATE CROSS-PLATFORM NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS cross_platform_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Targeting
  recipient_type VARCHAR(20) NOT NULL, -- 'customer', 'staff', 'all_staff', 'role'
  recipient_id UUID, -- customer_id or user_id (nullable for all_staff or role)
  recipient_role VARCHAR(50), -- for role-based notifications

  -- Notification content
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
    -- 'booking', 'payment', 'message', 'alert', 'promotion', 'system', 'reminder'
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'

  -- Delivery channels
  channels JSONB NOT NULL DEFAULT '["portal"]',
    -- ['portal', 'email', 'sms', 'push', 'crm']

  -- Content per channel
  email_subject VARCHAR(255),
  email_body TEXT,
  sms_body TEXT,

  -- Action
  action_url TEXT,
  action_label VARCHAR(100),

  -- Metadata
  metadata JSONB,
  related_entity_type VARCHAR(50), -- 'job', 'invoice', 'message', etc
  related_entity_id UUID,

  -- Delivery tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_channels JSONB DEFAULT '[]',
  failed_channels JSONB DEFAULT '[]',

  -- Read tracking (for in-app notifications)
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON cross_platform_notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON cross_platform_notifications(recipient_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON cross_platform_notifications(scheduled_for) WHERE scheduled_for IS NOT NULL AND sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON cross_platform_notifications(notification_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON cross_platform_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON cross_platform_notifications(recipient_role) WHERE recipient_role IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE cross_platform_notifications IS 'Unified notifications across all platforms (CRM, Portal, Website)';
COMMENT ON COLUMN cross_platform_notifications.recipient_type IS 'Type of recipient: customer, staff, all_staff, or role';
COMMENT ON COLUMN cross_platform_notifications.channels IS 'Array of delivery channels to use';
COMMENT ON COLUMN cross_platform_notifications.metadata IS 'Additional data for notification context';
COMMENT ON COLUMN cross_platform_notifications.delivered_channels IS 'Channels that successfully delivered';
COMMENT ON COLUMN cross_platform_notifications.failed_channels IS 'Channels that failed to deliver';

-- 2. ROW LEVEL SECURITY POLICIES
ALTER TABLE cross_platform_notifications ENABLE ROW LEVEL SECURITY;

-- Customers can view their own notifications
CREATE POLICY "Customers can view own notifications"
  ON cross_platform_notifications FOR SELECT
  USING (
    recipient_type = 'customer' AND
    recipient_id IN (
      SELECT id FROM customers WHERE email = auth.email()
    )
  );

-- Customers can mark their own notifications as read
CREATE POLICY "Customers can update own notifications"
  ON cross_platform_notifications FOR UPDATE
  USING (
    recipient_type = 'customer' AND
    recipient_id IN (
      SELECT id FROM customers WHERE email = auth.email()
    )
  )
  WITH CHECK (
    recipient_type = 'customer' AND
    recipient_id IN (
      SELECT id FROM customers WHERE email = auth.email()
    )
  );

-- Staff can view notifications for staff
CREATE POLICY "Staff can view staff notifications"
  ON cross_platform_notifications FOR SELECT
  USING (
    recipient_type IN ('staff', 'all_staff', 'role') AND
    (
      recipient_id = auth.uid() OR
      recipient_type = 'all_staff' OR
      recipient_role IN (
        SELECT role FROM users WHERE id = auth.uid()
      )
    )
  );

-- Staff can mark their notifications as read
CREATE POLICY "Staff can update own notifications"
  ON cross_platform_notifications FOR UPDATE
  USING (
    recipient_type IN ('staff', 'all_staff', 'role') AND
    (
      recipient_id = auth.uid() OR
      recipient_type = 'all_staff' OR
      recipient_role IN (
        SELECT role FROM users WHERE id = auth.uid()
      )
    )
  );

-- Only service role can insert notifications
CREATE POLICY "Service role can insert notifications"
  ON cross_platform_notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Service role can do anything
CREATE POLICY "Service role full access"
  ON cross_platform_notifications
  USING (auth.role() = 'service_role');

-- 3. ENABLE REAL-TIME SUBSCRIPTIONS
-- This allows Portal and CRM to receive notifications in real-time
-- Note: This needs to be run in Supabase Dashboard or CLI
-- ALTER PUBLICATION supabase_realtime ADD TABLE cross_platform_notifications;

-- 4. CREATE UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON cross_platform_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- 5. CREATE NOTIFICATION SUMMARY VIEW
CREATE OR REPLACE VIEW notification_summary AS
SELECT
  recipient_type,
  recipient_id,
  notification_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE NOT read) as unread_count,
  COUNT(*) FILTER (WHERE read) as read_count,
  MAX(created_at) as latest_notification
FROM cross_platform_notifications
GROUP BY recipient_type, recipient_id, notification_type;

COMMENT ON VIEW notification_summary IS 'Summary of notifications by recipient and type';

-- 6. CREATE HELPER FUNCTIONS

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE cross_platform_notifications
  SET
    read = true,
    read_at = NOW(),
    updated_at = NOW()
  WHERE id = notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a recipient
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_recipient_type VARCHAR,
  p_recipient_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE cross_platform_notifications
  SET
    read = true,
    read_at = NOW(),
    updated_at = NOW()
  WHERE
    recipient_type = p_recipient_type AND
    recipient_id = p_recipient_id AND
    read = false;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread count
CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_recipient_type VARCHAR,
  p_recipient_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unread_count
  FROM cross_platform_notifications
  WHERE
    recipient_type = p_recipient_type AND
    recipient_id = p_recipient_id AND
    read = false AND
    (expires_at IS NULL OR expires_at > NOW());

  RETURN unread_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  -- Delete read notifications older than 90 days
  DELETE FROM cross_platform_notifications
  WHERE
    read = true AND
    created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  -- Delete expired notifications
  DELETE FROM cross_platform_notifications
  WHERE
    expires_at IS NOT NULL AND
    expires_at < NOW();

  GET DIAGNOSTICS rows_deleted = rows_deleted + ROW_COUNT;

  RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. CREATE NOTIFICATION TEMPLATES TABLE (OPTIONAL)
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key VARCHAR(100) UNIQUE NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  default_channels JSONB DEFAULT '["portal"]',

  -- Template content with placeholders
  title_template TEXT NOT NULL,
  message_template TEXT NOT NULL,
  email_subject_template TEXT,
  email_body_template TEXT,
  sms_body_template TEXT,

  -- Metadata
  description TEXT,
  variables JSONB, -- List of available variables for this template

  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_key ON notification_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(notification_type);

COMMENT ON TABLE notification_templates IS 'Reusable notification templates with placeholders';

-- Seed some common notification templates
INSERT INTO notification_templates (template_key, template_name, notification_type, default_channels, title_template, message_template, email_subject_template, email_body_template, sms_body_template, variables) VALUES
  (
    'booking_confirmation',
    'Booking Confirmation',
    'booking',
    '["portal", "email", "sms"]',
    'Booking Confirmed',
    'Your service appointment on {{date}} has been confirmed.',
    'Booking Confirmation - Dirt Free Carpet',
    'Hi {{customer_name}},<br><br>Your service appointment on {{date}} at {{time}} has been confirmed.<br><br>Service: {{service_name}}<br>Address: {{address}}<br><br>Thank you!',
    'Your Dirt Free appointment on {{date}} at {{time}} is confirmed. Reply STOP to opt out.',
    '{"customer_name": "Customer name", "date": "Appointment date", "time": "Appointment time", "service_name": "Service name", "address": "Service address"}'
  ),
  (
    'payment_received',
    'Payment Received',
    'payment',
    '["portal", "email", "sms"]',
    'Payment Received',
    'Your payment of ${{amount}} has been received. Thank you!',
    'Payment Confirmation - Dirt Free Carpet',
    'Hi {{customer_name}},<br><br>We have received your payment of ${{amount}}.<br><br>Invoice: #{{invoice_number}}<br>Payment Method: {{payment_method}}<br><br>Thank you for your business!',
    'Payment of ${{amount}} received. Thank you! -Dirt Free',
    '{"customer_name": "Customer name", "amount": "Payment amount", "invoice_number": "Invoice number", "payment_method": "Payment method"}'
  ),
  (
    'message_reply',
    'Message Reply',
    'message',
    '["portal", "email", "sms"]',
    'New Message',
    '{{staff_name}} replied to your message',
    'New Message from {{staff_name}} - Dirt Free Carpet',
    'Hi {{customer_name}},<br><br>{{staff_name}} replied to your message:<br><br>"{{message_preview}}"<br><br>Log in to your portal to view the full conversation.',
    '{{staff_name}} replied to your message. Check your portal.',
    '{"customer_name": "Customer name", "staff_name": "Staff name", "message_preview": "Message preview"}'
  ),
  (
    'appointment_reminder',
    'Appointment Reminder',
    'reminder',
    '["portal", "email", "sms"]',
    'Appointment Reminder',
    'Reminder: You have an appointment tomorrow at {{time}}',
    'Appointment Reminder - Dirt Free Carpet',
    'Hi {{customer_name}},<br><br>This is a reminder about your appointment tomorrow:<br><br>Date: {{date}}<br>Time: {{time}}<br>Service: {{service_name}}<br>Address: {{address}}<br><br>See you tomorrow!',
    'Reminder: Your Dirt Free appointment is tomorrow at {{time}}. Reply STOP to opt out.',
    '{"customer_name": "Customer name", "date": "Appointment date", "time": "Appointment time", "service_name": "Service name", "address": "Service address"}'
  ),
  (
    'promotion_available',
    'Promotion Available',
    'promotion',
    '["portal", "email"]',
    'Special Offer Available!',
    'Check out our latest offer: {{promotion_title}}',
    'Special Offer: {{promotion_title}} - Dirt Free Carpet',
    'Hi {{customer_name}},<br><br>We have a special offer just for you:<br><br><strong>{{promotion_title}}</strong><br>{{promotion_description}}<br><br>Valid until: {{expiry_date}}<br><br>Book now to take advantage of this offer!',
    NULL,
    '{"customer_name": "Customer name", "promotion_title": "Promotion title", "promotion_description": "Promotion description", "expiry_date": "Expiry date"}'
  )
ON CONFLICT (template_key) DO NOTHING;

-- Enable RLS on templates
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view templates
CREATE POLICY "Authenticated users can view templates"
  ON notification_templates FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can modify templates
CREATE POLICY "Admins can modify templates"
  ON notification_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 8. GRANTS
GRANT SELECT ON cross_platform_notifications TO authenticated;
GRANT SELECT ON notification_summary TO authenticated;
GRANT SELECT ON notification_templates TO authenticated;
GRANT ALL ON cross_platform_notifications TO service_role;
GRANT ALL ON notification_templates TO service_role;

-- =====================================================
-- NOTES FOR MANUAL SETUP
-- =====================================================

-- IMPORTANT: Enable real-time in Supabase Dashboard:
-- 1. Go to Database > Replication
-- 2. Enable replication for cross_platform_notifications table
-- 3. Or run: ALTER PUBLICATION supabase_realtime ADD TABLE cross_platform_notifications;

-- IMPORTANT: Set up cron job for scheduled notifications:
-- 1. Add cron job in Vercel or your hosting platform
-- 2. Schedule to run: */5 * * * * (every 5 minutes)
-- 3. Endpoint: /api/cron/process-scheduled-notifications
-- 4. Include Authorization header with CRON_SECRET

-- IMPORTANT: Set up cron job for cleanup:
-- 1. Schedule to run daily at 2 AM: 0 2 * * *
-- 2. Endpoint: /api/cron/cleanup-notifications
-- 3. Include Authorization header with CRON_SECRET
