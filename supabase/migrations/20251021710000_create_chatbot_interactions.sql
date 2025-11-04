-- =====================================================
-- Chatbot Interactions Table
-- =====================================================
-- Tracks all chatbot conversations and intent detection
-- for customer support automation and analytics

-- Clean up from previous runs
DROP TABLE IF EXISTS chatbot_interactions CASCADE;
DROP TABLE IF EXISTS chatbot_sessions CASCADE;

CREATE TABLE chatbot_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  message_type varchar(20) NOT NULL CHECK (message_type IN ('customer_query', 'bot_response', 'escalation', 'human_response')),
  message_text text NOT NULL,
  intent_detected varchar(50),
  confidence_score decimal(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  bot_response_text text,
  escalated_to_human boolean DEFAULT false,
  escalated_at timestamptz,
  escalated_to_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_customer ON chatbot_interactions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_session ON chatbot_interactions(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_intent ON chatbot_interactions(intent_detected) WHERE intent_detected IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_escalated ON chatbot_interactions(escalated_to_human, escalated_at DESC) WHERE escalated_to_human = true;
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_created ON chatbot_interactions(created_at DESC);

-- RLS policies
ALTER TABLE chatbot_interactions ENABLE ROW LEVEL SECURITY;

-- Staff can view all interactions
CREATE POLICY chatbot_interactions_staff_read
ON chatbot_interactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'dispatcher', 'technician')
  )
);

-- Note: Customer read access removed - customers table doesn't have user_id linking to auth.users
-- If customer portal access is needed, a separate customer_users junction table should be created

-- System can insert all interactions (via service role)
CREATE POLICY chatbot_interactions_insert
ON chatbot_interactions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Staff can update interactions (for escalation)
CREATE POLICY chatbot_interactions_staff_update
ON chatbot_interactions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'dispatcher', 'technician')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'dispatcher', 'technician')
  )
);

-- =====================================================
-- Chatbot Sessions Table
-- =====================================================
-- Tracks active chatbot sessions and context

CREATE TABLE chatbot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now() NOT NULL,
  last_activity_at timestamptz DEFAULT now() NOT NULL,
  ended_at timestamptz,
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'escalated', 'resolved', 'abandoned')),
  context jsonb DEFAULT '{}'::jsonb,
  satisfaction_rating integer CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  satisfaction_feedback text,
  CONSTRAINT valid_session_times CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_customer ON chatbot_sessions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_session_id ON chatbot_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_status ON chatbot_sessions(status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_active ON chatbot_sessions(last_activity_at DESC) WHERE status = 'active';

-- RLS policies
ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;

-- Staff can view all sessions
CREATE POLICY chatbot_sessions_staff_read
ON chatbot_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'dispatcher', 'technician')
  )
);

-- Note: Customer read access removed - customers table doesn't have user_id linking to auth.users
-- If customer portal access is needed, a separate customer_users junction table should be created

-- System can insert/update sessions
CREATE POLICY chatbot_sessions_modify
ON chatbot_sessions
FOR ALL
TO authenticated
WITH CHECK (true);

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to create or update chatbot session
CREATE OR REPLACE FUNCTION upsert_chatbot_session(
  p_session_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_session_uuid uuid;
BEGIN
  INSERT INTO chatbot_sessions (
    session_id,
    customer_id,
    started_at,
    last_activity_at,
    context
  )
  VALUES (
    p_session_id,
    p_customer_id,
    now(),
    now(),
    p_context
  )
  ON CONFLICT (session_id)
  DO UPDATE SET
    last_activity_at = now(),
    context = COALESCE(p_context, chatbot_sessions.context)
  RETURNING id INTO v_session_uuid;

  RETURN v_session_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to log chatbot interaction
CREATE OR REPLACE FUNCTION log_chatbot_interaction(
  p_session_id uuid,
  p_customer_id uuid,
  p_message_type varchar(20),
  p_message_text text,
  p_intent_detected varchar(50) DEFAULT NULL,
  p_confidence_score decimal(3,2) DEFAULT NULL,
  p_bot_response_text text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_interaction_id uuid;
BEGIN
  -- Update session last activity
  PERFORM upsert_chatbot_session(p_session_id, p_customer_id);

  -- Insert interaction
  INSERT INTO chatbot_interactions (
    customer_id,
    session_id,
    message_type,
    message_text,
    intent_detected,
    confidence_score,
    bot_response_text,
    metadata
  )
  VALUES (
    p_customer_id,
    p_session_id,
    p_message_type,
    p_message_text,
    p_intent_detected,
    p_confidence_score,
    p_bot_response_text,
    p_metadata
  )
  RETURNING id INTO v_interaction_id;

  RETURN v_interaction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to escalate chatbot conversation to human
CREATE OR REPLACE FUNCTION escalate_chatbot_conversation(
  p_session_id uuid,
  p_escalated_to_user_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_interaction_id uuid;
  v_customer_id uuid;
BEGIN
  -- Get customer ID from session
  SELECT customer_id INTO v_customer_id
  FROM chatbot_sessions
  WHERE session_id = p_session_id;

  -- Update session status
  UPDATE chatbot_sessions
  SET status = 'escalated'
  WHERE session_id = p_session_id;

  -- Log escalation interaction
  INSERT INTO chatbot_interactions (
    customer_id,
    session_id,
    message_type,
    message_text,
    escalated_to_human,
    escalated_at,
    escalated_to_user_id
  )
  VALUES (
    v_customer_id,
    p_session_id,
    'escalation',
    'Conversation escalated to human support',
    true,
    now(),
    p_escalated_to_user_id
  )
  RETURNING id INTO v_interaction_id;

  RETURN v_interaction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get chatbot session history
CREATE OR REPLACE FUNCTION get_chatbot_session_history(
  p_session_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  message_type varchar(20),
  message_text text,
  intent_detected varchar(50),
  confidence_score decimal(3,2),
  bot_response_text text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.message_type,
    ci.message_text,
    ci.intent_detected,
    ci.confidence_score,
    ci.bot_response_text,
    ci.created_at
  FROM chatbot_interactions ci
  WHERE ci.session_id = p_session_id
  ORDER BY ci.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get chatbot analytics
CREATE OR REPLACE FUNCTION get_chatbot_analytics(
  p_start_date timestamptz DEFAULT now() - interval '30 days',
  p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE (
  total_sessions bigint,
  total_interactions bigint,
  escalation_rate numeric,
  avg_confidence_score numeric,
  top_intents jsonb,
  avg_session_length interval
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT cs.session_id) AS total_sessions,
    COUNT(ci.id) AS total_interactions,
    ROUND(
      (COUNT(DISTINCT CASE WHEN cs.status = 'escalated' THEN cs.session_id END)::numeric /
       NULLIF(COUNT(DISTINCT cs.session_id), 0)) * 100,
      2
    ) AS escalation_rate,
    ROUND(AVG(ci.confidence_score)::numeric, 2) AS avg_confidence_score,
    (
      SELECT jsonb_agg(intent_data ORDER BY intent_count DESC)
      FROM (
        SELECT
          ci2.intent_detected,
          COUNT(*) as intent_count
        FROM chatbot_interactions ci2
        WHERE ci2.created_at >= p_start_date
        AND ci2.created_at <= p_end_date
        AND ci2.intent_detected IS NOT NULL
        GROUP BY ci2.intent_detected
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) AS intent_data
    ) AS top_intents,
    AVG(
      EXTRACT(EPOCH FROM (cs.ended_at - cs.started_at)) * interval '1 second'
    ) AS avg_session_length
  FROM chatbot_sessions cs
  LEFT JOIN chatbot_interactions ci ON ci.session_id = cs.session_id
  WHERE cs.started_at >= p_start_date
  AND cs.started_at <= p_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to clean up abandoned sessions
CREATE OR REPLACE FUNCTION cleanup_abandoned_chatbot_sessions(
  p_inactivity_minutes integer DEFAULT 30
)
RETURNS integer AS $$
DECLARE
  v_updated_count integer;
BEGIN
  UPDATE chatbot_sessions
  SET
    status = 'abandoned',
    ended_at = last_activity_at
  WHERE status = 'active'
  AND last_activity_at < now() - (p_inactivity_minutes || ' minutes')::interval;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION upsert_chatbot_session(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION log_chatbot_interaction(uuid, uuid, varchar, text, varchar, decimal, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION escalate_chatbot_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_chatbot_session_history(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_chatbot_analytics(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_abandoned_chatbot_sessions(integer) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE chatbot_interactions IS 'Logs all chatbot interactions including queries, responses, and escalations';
COMMENT ON TABLE chatbot_sessions IS 'Tracks chatbot conversation sessions and maintains context';

COMMENT ON FUNCTION upsert_chatbot_session(uuid, uuid, jsonb) IS 'Create or update chatbot session with context';
COMMENT ON FUNCTION log_chatbot_interaction(uuid, uuid, varchar, text, varchar, decimal, text, jsonb) IS 'Log a chatbot interaction (query or response)';
COMMENT ON FUNCTION escalate_chatbot_conversation(uuid, uuid) IS 'Escalate chatbot conversation to human support';
COMMENT ON FUNCTION get_chatbot_session_history(uuid, integer) IS 'Get conversation history for a session';
COMMENT ON FUNCTION get_chatbot_analytics(timestamptz, timestamptz) IS 'Get chatbot performance analytics';
COMMENT ON FUNCTION cleanup_abandoned_chatbot_sessions(integer) IS 'Mark inactive sessions as abandoned';
