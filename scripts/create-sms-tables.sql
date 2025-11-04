-- =====================================================
-- SMS System Tables for Dirt Free CRM
-- =====================================================

-- SMS Messages table for storing all SMS communications
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sid VARCHAR(255) UNIQUE, -- Twilio message SID
  to_number VARCHAR(20) NOT NULL,
  from_number VARCHAR(20) NOT NULL,
  body TEXT NOT NULL,
  direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
  status VARCHAR(30) DEFAULT 'queued',
  error_message TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
  metadata JSONB,
  price DECIMAL(10, 4),
  price_unit VARCHAR(3),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- SMS Templates table for custom message templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50),
  body TEXT NOT NULL,
  variables TEXT[], -- Array of variable names used in template
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- SMS Opt-outs table for tracking unsubscribes
CREATE TABLE IF NOT EXISTS sms_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id),
  opted_out_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opted_in_at TIMESTAMP WITH TIME ZONE,
  reason VARCHAR(255),
  is_active BOOLEAN DEFAULT true
);

-- SMS Campaigns for bulk messaging
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  target_criteria JSONB, -- Criteria for selecting recipients
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS Campaign Recipients
CREATE TABLE IF NOT EXISTS sms_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  phone_number VARCHAR(20) NOT NULL,
  message_sid VARCHAR(255),
  status VARCHAR(30),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- =====================================================
-- Views
-- =====================================================

-- SMS Conversations view for grouping messages by customer
CREATE OR REPLACE VIEW sms_conversations AS
SELECT
  customer_id,
  COUNT(*) as message_count,
  COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_count,
  COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  MAX(created_at) as last_message_at,
  MIN(created_at) as first_message_at,
  (
    SELECT body
    FROM sms_messages m2
    WHERE m2.customer_id = m.customer_id
    ORDER BY created_at DESC
    LIMIT 1
  ) as last_message_body
FROM sms_messages m
WHERE deleted_at IS NULL
  AND customer_id IS NOT NULL
GROUP BY customer_id;

-- SMS Activity view for analytics
CREATE OR REPLACE VIEW sms_activity_daily AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE direction = 'outbound') as messages_sent,
  COUNT(*) FILTER (WHERE direction = 'inbound') as messages_received,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(DISTINCT customer_id) as unique_customers,
  SUM(price) as total_cost
FROM sms_messages
WHERE deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Customer SMS Summary view
CREATE OR REPLACE VIEW customer_sms_summary AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.phone_e164,
  c.sms_notifications,
  COUNT(m.id) as total_messages,
  COUNT(m.id) FILTER (WHERE m.direction = 'outbound') as messages_sent_to,
  COUNT(m.id) FILTER (WHERE m.direction = 'inbound') as messages_received_from,
  MAX(m.created_at) as last_message_at,
  EXISTS(
    SELECT 1 FROM sms_opt_outs
    WHERE phone_number = c.phone_e164
    AND is_active = true
  ) as is_opted_out
FROM customers c
LEFT JOIN sms_messages m ON m.customer_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.phone_e164, c.sms_notifications;

-- =====================================================
-- Indexes
-- =====================================================

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_sms_messages_customer_id
ON sms_messages(customer_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_job_id
ON sms_messages(job_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at
ON sms_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_messages_sid
ON sms_messages(sid);

CREATE INDEX IF NOT EXISTS idx_sms_messages_to_number
ON sms_messages(to_number);

CREATE INDEX IF NOT EXISTS idx_sms_messages_direction_status
ON sms_messages(direction, status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_phone
ON sms_opt_outs(phone_number)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status
ON sms_campaigns(status, scheduled_at);

-- =====================================================
-- Functions
-- =====================================================

-- Function to get conversation thread
CREATE OR REPLACE FUNCTION get_sms_conversation(
  p_customer_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  body TEXT,
  direction VARCHAR(10),
  status VARCHAR(30),
  created_at TIMESTAMP WITH TIME ZONE,
  from_name VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.body,
    m.direction,
    m.status,
    m.created_at,
    CASE
      WHEN m.direction = 'outbound' THEN 'Dirt Free'
      ELSE c.name
    END as from_name
  FROM sms_messages m
  LEFT JOIN customers c ON m.customer_id = c.id
  WHERE m.customer_id = p_customer_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to check if phone is opted out
CREATE OR REPLACE FUNCTION is_phone_opted_out(p_phone VARCHAR(20))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1
    FROM sms_opt_outs
    WHERE phone_number = p_phone
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Triggers
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_updated_at();

CREATE TRIGGER sms_templates_updated_at
  BEFORE UPDATE ON sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================

-- Enable RLS
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

-- SMS Messages policies
CREATE POLICY "SMS messages viewable by admin and dispatcher" ON sms_messages
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'dispatcher')
    OR (
      auth.jwt() ->> 'role' = 'technician'
      AND technician_id IN (
        SELECT id FROM technicians WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "SMS messages can be created by admin and dispatcher" ON sms_messages
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'dispatcher'));

CREATE POLICY "SMS messages can be updated by admin and dispatcher" ON sms_messages
  FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'dispatcher'));

-- SMS Templates policies
CREATE POLICY "SMS templates viewable by all authenticated" ON sms_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "SMS templates manageable by admin and dispatcher" ON sms_templates
  FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'dispatcher'));

-- SMS Campaigns policies
CREATE POLICY "SMS campaigns manageable by admin and dispatcher" ON sms_campaigns
  FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'dispatcher'));

-- =====================================================
-- Sample Data (for development)
-- =====================================================

-- Insert sample templates
INSERT INTO sms_templates (name, category, body, variables) VALUES
  ('appointment_confirmation', 'appointment', 'Hi {name}, your appointment is confirmed for {date} at {time}.', ARRAY['name', 'date', 'time']),
  ('tech_on_way', 'service', 'Your technician {tech_name} is on the way! ETA: {eta}', ARRAY['tech_name', 'eta']),
  ('job_complete', 'service', 'Service complete! Thank you for choosing Dirt Free. Invoice: {link}', ARRAY['link']),
  ('payment_reminder', 'billing', 'Reminder: Invoice #{number} for ${amount} is due {date}.', ARRAY['number', 'amount', 'date'])
ON CONFLICT (name) DO NOTHING;