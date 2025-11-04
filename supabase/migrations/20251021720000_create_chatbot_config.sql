-- =====================================================
-- Chatbot Configuration Table
-- =====================================================
-- Stores customizable chatbot configuration for intents
-- allowing non-technical staff to manage responses

-- Clean up from previous runs
DROP TABLE IF EXISTS chatbot_config CASCADE;

CREATE TABLE chatbot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent varchar(50) UNIQUE NOT NULL,
  display_name varchar(100) NOT NULL,
  description text,
  response_templates jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_threshold decimal(3,2) DEFAULT 0.70 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
  auto_escalate_below decimal(3,2) DEFAULT 0.50 CHECK (auto_escalate_below >= 0 AND auto_escalate_below <= 1),
  requires_escalation boolean DEFAULT false,
  active boolean DEFAULT true,
  keywords jsonb DEFAULT '[]'::jsonb,
  phrases jsonb DEFAULT '[]'::jsonb,
  follow_up_questions jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_config_intent ON chatbot_config(intent);
CREATE INDEX IF NOT EXISTS idx_chatbot_config_active ON chatbot_config(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_chatbot_config_updated ON chatbot_config(updated_at DESC);

-- RLS policies
ALTER TABLE chatbot_config ENABLE ROW LEVEL SECURITY;

-- Staff can view all configuration
CREATE POLICY chatbot_config_staff_read
ON chatbot_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'dispatcher', 'technician')
  )
);

-- Admin and dispatchers can modify configuration
CREATE POLICY chatbot_config_admin_modify
ON chatbot_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'dispatcher')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'dispatcher')
  )
);

-- =====================================================
-- Trigger for updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_chatbot_config_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chatbot_config_timestamp ON chatbot_config;
CREATE TRIGGER trigger_update_chatbot_config_timestamp
  BEFORE UPDATE ON chatbot_config
  FOR EACH ROW
  EXECUTE FUNCTION update_chatbot_config_timestamp();

-- =====================================================
-- Seed default intents
-- =====================================================

INSERT INTO chatbot_config (intent, display_name, description, response_templates, confidence_threshold, auto_escalate_below, requires_escalation, keywords, phrases, follow_up_questions) VALUES
(
  'appointment_query',
  'Appointment Query',
  'Customer asking about their appointment schedule',
  '["Hi {customerName}! Your next appointment is scheduled for {appointmentDate} at {appointmentTime}. We''re looking forward to serving you!", "Hello {customerName}! I found your upcoming appointment on {appointmentDate} at {appointmentTime}. Is there anything else you''d like to know?", "Your next service appointment with us is on {appointmentDate} at {appointmentTime}, {customerName}. Need to make any changes?"]'::jsonb,
  0.70,
  0.50,
  false,
  '["appointment", "scheduled", "booking", "reservation", "when"]'::jsonb,
  '["when is my appointment", "what time is my appointment", "do i have an appointment", "next appointment", "upcoming appointment"]'::jsonb,
  '["Would you like to reschedule?", "Do you need directions to our location?", "Would you like a reminder the day before?"]'::jsonb
),
(
  'reschedule_request',
  'Reschedule Request',
  'Customer requesting to change their appointment',
  '["I''d be happy to help you reschedule your appointment, {customerName}. Let me connect you with our scheduling team who can find the best time for you.", "No problem, {customerName}! I''m transferring you to our scheduling specialist who can help you find a new time that works better.", "I understand you need to reschedule. Let me get you in touch with our team who can help you select a new date and time."]'::jsonb,
  0.70,
  0.70,
  true,
  '["reschedule", "change", "move", "different time", "cancel", "postpone"]'::jsonb,
  '["reschedule my appointment", "change appointment", "move my appointment", "need to reschedule", "change the time", "different date"]'::jsonb,
  '["What days work best for you?", "Do you prefer morning or afternoon appointments?"]'::jsonb
),
(
  'billing_question',
  'Billing Question',
  'Customer inquiring about billing or payments',
  '["Hi {customerName}! I can see your account information. Your current balance is {balance}. Would you like help with payment options?", "Hello {customerName}! According to our records, your balance is {balance}. I can help you with payment methods or connect you with our billing team.", "{customerName}, your account shows a balance of {balance}. Would you like to make a payment or speak with our billing department?"]'::jsonb,
  0.70,
  0.60,
  false,
  '["bill", "invoice", "payment", "charge", "cost", "pay", "owe", "balance"]'::jsonb,
  '["how much do i owe", "my bill", "payment options", "what do i owe", "invoice amount", "make a payment", "billing question"]'::jsonb,
  '["Would you like to make a payment now?", "Do you have questions about a specific charge?", "Would you like to set up a payment plan?"]'::jsonb
),
(
  'service_inquiry',
  'Service Inquiry',
  'Customer asking about available services',
  '["We offer comprehensive carpet and upholstery cleaning services, {customerName}! Our main services include:\n\n• Professional Carpet Cleaning\n• Tile & Grout Cleaning\n• Upholstery Cleaning\n• Water Damage Restoration\n• Stain Removal\n• Pet Odor Treatment\n\nWhich service interests you?", "Great question, {customerName}! We specialize in:\n\n✓ Carpet cleaning (residential & commercial)\n✓ Tile and grout restoration\n✓ Furniture upholstery cleaning\n✓ Emergency water damage services\n✓ Pet stain and odor removal\n\nCan I provide more details on any specific service?"]'::jsonb,
  0.70,
  0.50,
  false,
  '["service", "services", "offer", "provide", "do you", "clean", "cleaning"]'::jsonb,
  '["what services do you offer", "what do you do", "types of cleaning", "services available", "what can you clean", "carpet cleaning"]'::jsonb,
  '["Would you like to schedule a service?", "Do you need a price estimate?", "Would you like to know about our current specials?"]'::jsonb
),
(
  'hours_inquiry',
  'Hours Inquiry',
  'Customer asking about business hours',
  '["We''re here to help, {customerName}! Our business hours are:\n\n{businessHours}\n\nFor urgent service needs, please call us at {businessPhone}.", "Hi {customerName}! Our regular hours are {businessHours}. You can also reach us anytime at {businessPhone} for emergency services."]'::jsonb,
  0.70,
  0.40,
  false,
  '["hours", "open", "closed", "available", "when", "time"]'::jsonb,
  '["what are your hours", "when are you open", "business hours", "are you open", "what time do you close", "operating hours"]'::jsonb,
  '["Would you like to schedule an appointment?", "Do you need emergency service?"]'::jsonb
),
(
  'pricing_question',
  'Pricing Question',
  'Customer inquiring about pricing or quotes',
  '["Our pricing varies based on the size and type of service, {customerName}. For an accurate quote, I can connect you with our team who can provide a free estimate based on your specific needs.", "Hi {customerName}! We offer competitive pricing that depends on square footage, service type, and any special treatments needed. Would you like me to have our team call you with a personalized quote?"]'::jsonb,
  0.70,
  0.70,
  true,
  '["price", "pricing", "cost", "how much", "quote", "estimate", "rate"]'::jsonb,
  '["how much does it cost", "what are your prices", "get a quote", "price for", "how much for", "what do you charge", "pricing information"]'::jsonb,
  '["What type of service are you interested in?", "How many rooms need cleaning?", "Would you like a free on-site estimate?"]'::jsonb
),
(
  'general_question',
  'General Question',
  'Fallback for general inquiries',
  '["Thanks for reaching out, {customerName}! I''m here to help with appointment scheduling, service information, and billing questions. What can I assist you with today?", "Hi {customerName}! I can help you with:\n• Checking your appointments\n• Learning about our services\n• Billing and payment questions\n• Business hours and contact info\n\nWhat would you like to know?"]'::jsonb,
  0.70,
  0.30,
  false,
  '["help", "question", "information", "tell me"]'::jsonb,
  '["can you help", "i have a question", "tell me about"]'::jsonb,
  '["Would you like to check your upcoming appointments?", "Are you interested in learning about our services?", "Do you have billing questions?"]'::jsonb
),
(
  'unknown',
  'Unknown Intent',
  'Intent could not be determined',
  '["I''m not quite sure I understood that, {customerName}. Could you rephrase your question? Or, I can connect you with a team member who can help directly.", "I want to make sure I help you correctly, {customerName}. Could you tell me more about what you need? Alternatively, I can transfer you to a specialist."]'::jsonb,
  0.70,
  0.30,
  true,
  '[]'::jsonb,
  '[]'::jsonb,
  '["Would you like to speak with a team member?", "Can you describe your question another way?"]'::jsonb
);

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to get active chatbot configuration
CREATE OR REPLACE FUNCTION get_active_chatbot_config()
RETURNS TABLE (
  id uuid,
  intent varchar(50),
  display_name varchar(100),
  response_templates jsonb,
  confidence_threshold decimal(3,2),
  auto_escalate_below decimal(3,2),
  requires_escalation boolean,
  keywords jsonb,
  phrases jsonb,
  follow_up_questions jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.intent,
    cc.display_name,
    cc.response_templates,
    cc.confidence_threshold,
    cc.auto_escalate_below,
    cc.requires_escalation,
    cc.keywords,
    cc.phrases,
    cc.follow_up_questions
  FROM chatbot_config cc
  WHERE cc.active = true
  ORDER BY cc.display_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update chatbot config
CREATE OR REPLACE FUNCTION update_chatbot_config(
  p_intent varchar(50),
  p_response_templates jsonb DEFAULT NULL,
  p_confidence_threshold decimal(3,2) DEFAULT NULL,
  p_auto_escalate_below decimal(3,2) DEFAULT NULL,
  p_requires_escalation boolean DEFAULT NULL,
  p_active boolean DEFAULT NULL,
  p_keywords jsonb DEFAULT NULL,
  p_phrases jsonb DEFAULT NULL,
  p_follow_up_questions jsonb DEFAULT NULL,
  p_updated_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_config_id uuid;
BEGIN
  UPDATE chatbot_config
  SET
    response_templates = COALESCE(p_response_templates, response_templates),
    confidence_threshold = COALESCE(p_confidence_threshold, confidence_threshold),
    auto_escalate_below = COALESCE(p_auto_escalate_below, auto_escalate_below),
    requires_escalation = COALESCE(p_requires_escalation, requires_escalation),
    active = COALESCE(p_active, active),
    keywords = COALESCE(p_keywords, keywords),
    phrases = COALESCE(p_phrases, phrases),
    follow_up_questions = COALESCE(p_follow_up_questions, follow_up_questions),
    updated_by = p_updated_by,
    updated_at = now()
  WHERE intent = p_intent
  RETURNING id INTO v_config_id;

  RETURN v_config_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION get_active_chatbot_config() TO authenticated;
GRANT EXECUTE ON FUNCTION update_chatbot_config(varchar, jsonb, decimal, decimal, boolean, boolean, jsonb, jsonb, jsonb, uuid) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE chatbot_config IS 'Stores customizable chatbot configuration for each intent';
COMMENT ON FUNCTION get_active_chatbot_config() IS 'Get all active chatbot intent configurations';
COMMENT ON FUNCTION update_chatbot_config(varchar, jsonb, decimal, decimal, boolean, boolean, jsonb, jsonb, jsonb, uuid) IS 'Update chatbot configuration for a specific intent';
