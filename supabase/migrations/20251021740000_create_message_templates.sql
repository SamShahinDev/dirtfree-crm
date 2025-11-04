-- =====================================================
-- Message Templates Table
-- =====================================================
-- Stores pre-written message templates for quick staff responses
-- with variable substitution and usage tracking

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category varchar(50) NOT NULL CHECK (category IN ('billing', 'scheduling', 'services', 'complaints', 'general', 'follow_up', 'emergency')),
  title varchar(100) NOT NULL,
  template_text text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  tags jsonb DEFAULT '[]'::jsonb,
  use_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_message_templates_category ON message_templates(category) WHERE active = true;
CREATE INDEX idx_message_templates_active ON message_templates(active, use_count DESC);
CREATE INDEX idx_message_templates_created ON message_templates(created_at DESC);
CREATE INDEX idx_message_templates_use_count ON message_templates(use_count DESC) WHERE active = true;
CREATE INDEX idx_message_templates_title ON message_templates(title);

-- Full text search index
CREATE INDEX idx_message_templates_text_search ON message_templates USING gin(to_tsvector('english', title || ' ' || template_text));

-- RLS policies
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Staff can view all templates
CREATE POLICY message_templates_staff_read
ON message_templates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Staff can create templates
CREATE POLICY message_templates_staff_insert
ON message_templates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Staff can update their own templates, admins can update all
CREATE POLICY message_templates_own_update
ON message_templates
FOR UPDATE
TO authenticated
USING (
  created_by_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  created_by_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Staff can delete their own templates, admins can delete all
CREATE POLICY message_templates_own_delete
ON message_templates
FOR DELETE
TO authenticated
USING (
  created_by_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_template_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_message_template_timestamp ON message_templates;
CREATE TRIGGER trigger_update_message_template_timestamp
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_message_template_timestamp();

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to increment template use count
CREATE OR REPLACE FUNCTION increment_template_usage(p_template_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE message_templates
  SET
    use_count = use_count + 1,
    last_used_at = now()
  WHERE id = p_template_id;
END;
$$ LANGUAGE plpgsql;

-- Function to search templates
CREATE OR REPLACE FUNCTION search_message_templates(
  p_search_query text,
  p_category varchar(50) DEFAULT NULL,
  p_active_only boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  category varchar(50),
  title varchar(100),
  template_text text,
  variables jsonb,
  tags jsonb,
  use_count integer,
  last_used_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.id,
    mt.category,
    mt.title,
    mt.template_text,
    mt.variables,
    mt.tags,
    mt.use_count,
    mt.last_used_at
  FROM message_templates mt
  WHERE
    (NOT p_active_only OR mt.active = true)
    AND (p_category IS NULL OR mt.category = p_category)
    AND (
      p_search_query IS NULL
      OR p_search_query = ''
      OR to_tsvector('english', mt.title || ' ' || mt.template_text) @@ plainto_tsquery('english', p_search_query)
      OR mt.title ILIKE '%' || p_search_query || '%'
      OR mt.template_text ILIKE '%' || p_search_query || '%'
    )
  ORDER BY
    CASE
      WHEN p_search_query IS NOT NULL AND p_search_query != '' THEN
        ts_rank(to_tsvector('english', mt.title || ' ' || mt.template_text), plainto_tsquery('english', p_search_query))
      ELSE 0
    END DESC,
    mt.use_count DESC,
    mt.title;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get popular templates
CREATE OR REPLACE FUNCTION get_popular_templates(
  p_category varchar(50) DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  category varchar(50),
  title varchar(100),
  template_text text,
  variables jsonb,
  use_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.id,
    mt.category,
    mt.title,
    mt.template_text,
    mt.variables,
    mt.use_count
  FROM message_templates mt
  WHERE
    mt.active = true
    AND (p_category IS NULL OR mt.category = p_category)
  ORDER BY mt.use_count DESC, mt.last_used_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get template statistics
CREATE OR REPLACE FUNCTION get_template_statistics()
RETURNS TABLE (
  category varchar(50),
  template_count bigint,
  total_uses bigint,
  avg_uses numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.category,
    COUNT(*) as template_count,
    SUM(mt.use_count) as total_uses,
    ROUND(AVG(mt.use_count), 2) as avg_uses
  FROM message_templates mt
  WHERE mt.active = true
  GROUP BY mt.category
  ORDER BY total_uses DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Seed Default Templates
-- =====================================================

INSERT INTO message_templates (category, title, template_text, variables, tags) VALUES
(
  'scheduling',
  'Appointment Confirmation',
  'Hi {customerName}, this is {technicianName} from Dirt Free Carpet. I''m confirming your appointment for {serviceType} on {appointmentDate} at {appointmentTime}. I''ll arrive at your location within our scheduled time window. If you have any questions, feel free to reply. See you soon!',
  '["customerName", "technicianName", "serviceType", "appointmentDate", "appointmentTime"]'::jsonb,
  '["confirmation", "appointment"]'::jsonb
),
(
  'scheduling',
  'Appointment Reminder - 24 Hours',
  'Hello {customerName}! This is a reminder that your {serviceType} appointment is scheduled for tomorrow, {appointmentDate} at {appointmentTime}. We look forward to serving you! Reply CONFIRM to confirm or RESCHEDULE if you need to change the time.',
  '["customerName", "serviceType", "appointmentDate", "appointmentTime"]'::jsonb,
  '["reminder", "appointment"]'::jsonb
),
(
  'scheduling',
  'Running Late',
  'Hi {customerName}, this is {technicianName}. I''m running about {delayMinutes} minutes behind schedule due to {delayReason}. I apologize for the inconvenience and will be there as soon as possible. Thank you for your patience!',
  '["customerName", "technicianName", "delayMinutes", "delayReason"]'::jsonb,
  '["delay", "apology"]'::jsonb
),
(
  'scheduling',
  'Reschedule Request',
  'Hi {customerName}, we received your request to reschedule your appointment originally scheduled for {originalDate}. We have the following times available: {availableSlots}. Please let me know which works best for you.',
  '["customerName", "originalDate", "availableSlots"]'::jsonb,
  '["reschedule", "availability"]'::jsonb
),
(
  'services',
  'Service Complete',
  'Hi {customerName}, we''ve completed your {serviceType} service. Your carpets/floors should be dry in approximately {dryTime} hours. Here are some care tips: {careTips}. Thank you for choosing Dirt Free Carpet! We''d appreciate your feedback.',
  '["customerName", "serviceType", "dryTime", "careTips"]'::jsonb,
  '["completion", "care-tips"]'::jsonb
),
(
  'services',
  'Service Quote',
  'Hi {customerName}, thank you for your interest in our {serviceType}! Based on your {squareFootage} sq ft area, the estimated cost is {estimatedCost}. This includes {includedServices}. Would you like to schedule an appointment?',
  '["customerName", "serviceType", "squareFootage", "estimatedCost", "includedServices"]'::jsonb,
  '["quote", "pricing"]'::jsonb
),
(
  'billing',
  'Payment Received',
  'Hi {customerName}, we''ve received your payment of {paymentAmount} for invoice #{invoiceNumber}. Thank you for your prompt payment! Your receipt has been emailed to {customerEmail}.',
  '["customerName", "paymentAmount", "invoiceNumber", "customerEmail"]'::jsonb,
  '["payment", "receipt"]'::jsonb
),
(
  'billing',
  'Payment Reminder',
  'Hi {customerName}, this is a friendly reminder that invoice #{invoiceNumber} for {invoiceAmount} is due on {dueDate}. You can pay online at {paymentLink} or call us to arrange payment. Thank you!',
  '["customerName", "invoiceNumber", "invoiceAmount", "dueDate", "paymentLink"]'::jsonb,
  '["reminder", "payment"]'::jsonb
),
(
  'billing',
  'Payment Plan Offer',
  'Hi {customerName}, we understand that the balance of {balance} might be difficult to pay all at once. We can set up a payment plan of {installmentAmount} per month for {numberOfMonths} months. Would this work better for you?',
  '["customerName", "balance", "installmentAmount", "numberOfMonths"]'::jsonb,
  '["payment-plan", "flexibility"]'::jsonb
),
(
  'complaints',
  'Complaint Acknowledgment',
  'Hi {customerName}, I sincerely apologize for your experience with {issueDescription}. This is not the level of service we strive to provide. I''m personally looking into this matter and will have a resolution for you within {responseTime}. Thank you for bringing this to our attention.',
  '["customerName", "issueDescription", "responseTime"]'::jsonb,
  '["apology", "escalation"]'::jsonb
),
(
  'complaints',
  'Issue Resolution',
  'Hi {customerName}, I wanted to follow up on the issue you reported. We''ve {resolutionAction} and want to make this right. As a gesture of goodwill, we''re offering {compensation}. We value your business and hope to restore your confidence in our service.',
  '["customerName", "resolutionAction", "compensation"]'::jsonb,
  '["resolution", "compensation"]'::jsonb
),
(
  'general',
  'Thank You',
  'Thank you {customerName}! We appreciate your business and hope you''re satisfied with our {serviceType} service. If you have a moment, we''d love a review: {reviewLink}. We look forward to serving you again!',
  '["customerName", "serviceType", "reviewLink"]'::jsonb,
  '["thank-you", "review"]'::jsonb
),
(
  'general',
  'Out of Service Area',
  'Hi {customerName}, thank you for your interest! Unfortunately, we don''t currently service the {location} area. However, I''d be happy to recommend a trusted partner in your area or add you to our notification list if we expand services there.',
  '["customerName", "location"]'::jsonb,
  '["referral", "service-area"]'::jsonb
),
(
  'follow_up',
  'Satisfaction Check',
  'Hi {customerName}, it''s been {daysSinceService} days since we serviced your {serviceType}. We wanted to check in - how is everything? Are you satisfied with the results? We''re here if you need anything!',
  '["customerName", "daysSinceService", "serviceType"]'::jsonb,
  '["follow-up", "satisfaction"]'::jsonb
),
(
  'follow_up',
  'Maintenance Reminder',
  'Hi {customerName}, it''s been {monthsSinceService} months since your last {serviceType} service. Regular maintenance helps extend the life of your carpets. Would you like to schedule your next appointment? We have availability on {availableDates}.',
  '["customerName", "monthsSinceService", "serviceType", "availableDates"]'::jsonb,
  '["maintenance", "scheduling"]'::jsonb
),
(
  'emergency',
  'Emergency Response',
  'Hi {customerName}, we received your emergency service request for {emergencyType}. A technician will be dispatched to your location within {responseTime}. In the meantime, {emergencyInstructions}. We''re on our way!',
  '["customerName", "emergencyType", "responseTime", "emergencyInstructions"]'::jsonb,
  '["emergency", "urgent"]'::jsonb
);

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION increment_template_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_message_templates(text, varchar, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_templates(varchar, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_template_statistics() TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE message_templates IS 'Pre-written message templates for quick staff responses with variable substitution';
COMMENT ON FUNCTION increment_template_usage(uuid) IS 'Increment use count when template is used';
COMMENT ON FUNCTION search_message_templates(text, varchar, boolean) IS 'Full text search for templates';
COMMENT ON FUNCTION get_popular_templates(varchar, integer) IS 'Get most frequently used templates';
COMMENT ON FUNCTION get_template_statistics() IS 'Get template usage statistics by category';
