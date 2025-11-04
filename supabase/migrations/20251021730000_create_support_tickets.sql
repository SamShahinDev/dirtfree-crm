-- =====================================================
-- Support Tickets Table
-- =====================================================
-- Manages escalated chatbot conversations and support tickets
-- with priority routing and staff assignment

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number varchar(20) UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  chatbot_session_id uuid,
  escalation_reason text NOT NULL,
  priority varchar(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status varchar(20) DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_notes text,
  customer_rating integer CHECK (customer_rating >= 1 AND customer_rating <= 5),
  customer_feedback text,
  tags jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_assignment CHECK (
    (assigned_to_user_id IS NULL AND assigned_at IS NULL) OR
    (assigned_to_user_id IS NOT NULL AND assigned_at IS NOT NULL)
  ),
  CONSTRAINT valid_resolution CHECK (
    (status IN ('resolved', 'closed') AND resolved_at IS NOT NULL) OR
    (status NOT IN ('resolved', 'closed') AND resolved_at IS NULL)
  )
);

-- Indexes for efficient queries
CREATE INDEX idx_support_tickets_customer ON support_tickets(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_support_tickets_session ON support_tickets(chatbot_session_id) WHERE chatbot_session_id IS NOT NULL;
CREATE INDEX idx_support_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority, created_at DESC);
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to_user_id, status) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_support_tickets_open ON support_tickets(created_at DESC) WHERE status IN ('open', 'assigned', 'in_progress');
CREATE INDEX idx_support_tickets_ticket_number ON support_tickets(ticket_number);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);

-- RLS policies
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Staff can view all tickets
CREATE POLICY support_tickets_staff_read
ON support_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Customers can view their own tickets
CREATE POLICY support_tickets_customer_read
ON support_tickets
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers
    WHERE user_id = auth.uid()
  )
);

-- Staff can create tickets
CREATE POLICY support_tickets_staff_insert
ON support_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Staff can update tickets
CREATE POLICY support_tickets_staff_update
ON support_tickets
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

-- Customers can update their own tickets (rating/feedback only)
CREATE POLICY support_tickets_customer_update
ON support_tickets
FOR UPDATE
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers
    WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- Support Ticket Messages Table
-- =====================================================
-- Stores conversation messages for support tickets

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type varchar(20) NOT NULL CHECK (sender_type IN ('customer', 'staff', 'system', 'bot')),
  sender_id uuid,
  message_text text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  is_internal_note boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at ASC);
CREATE INDEX idx_support_ticket_messages_sender ON support_ticket_messages(sender_id) WHERE sender_id IS NOT NULL;

-- RLS policies
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Staff can view all messages
CREATE POLICY support_ticket_messages_staff_read
ON support_ticket_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Customers can view non-internal messages for their tickets
CREATE POLICY support_ticket_messages_customer_read
ON support_ticket_messages
FOR SELECT
TO authenticated
USING (
  is_internal_note = false
  AND ticket_id IN (
    SELECT st.id FROM support_tickets st
    JOIN customers c ON c.id = st.customer_id
    WHERE c.user_id = auth.uid()
  )
);

-- Staff can insert messages
CREATE POLICY support_ticket_messages_staff_insert
ON support_ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Customers can insert messages to their tickets
CREATE POLICY support_ticket_messages_customer_insert
ON support_ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'customer'
  AND is_internal_note = false
  AND ticket_id IN (
    SELECT st.id FROM support_tickets st
    JOIN customers c ON c.id = st.customer_id
    WHERE c.user_id = auth.uid()
  )
);

-- =====================================================
-- Staff Notifications Table
-- =====================================================
-- Tracks notifications sent to staff about escalations

CREATE TABLE IF NOT EXISTS staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
  notification_type varchar(50) NOT NULL,
  channel varchar(20) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  sent_at timestamptz DEFAULT now() NOT NULL,
  read_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_staff_notifications_user ON staff_notifications(user_id, sent_at DESC);
CREATE INDEX idx_staff_notifications_ticket ON staff_notifications(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX idx_staff_notifications_unread ON staff_notifications(user_id, sent_at DESC) WHERE read_at IS NULL;

-- RLS policies
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY staff_notifications_own_read
ON staff_notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY staff_notifications_own_update
ON staff_notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- System can insert notifications
CREATE POLICY staff_notifications_insert
ON staff_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_support_ticket_timestamp ON support_tickets;
CREATE TRIGGER trigger_update_support_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_timestamp();

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to generate unique ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS varchar AS $$
DECLARE
  v_ticket_number varchar(20);
  v_exists boolean;
BEGIN
  LOOP
    -- Generate format: TKT-YYYYMMDD-XXXX (e.g., TKT-20250122-1234)
    v_ticket_number := 'TKT-' ||
                       to_char(now(), 'YYYYMMDD') || '-' ||
                       lpad(floor(random() * 10000)::text, 4, '0');

    -- Check if ticket number already exists
    SELECT EXISTS(SELECT 1 FROM support_tickets WHERE ticket_number = v_ticket_number) INTO v_exists;

    -- Exit loop if unique
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_ticket_number;
END;
$$ LANGUAGE plpgsql;

-- Function to create support ticket from escalation
CREATE OR REPLACE FUNCTION create_support_ticket(
  p_customer_id uuid,
  p_chatbot_session_id uuid,
  p_escalation_reason text,
  p_priority varchar(20) DEFAULT 'medium',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_ticket_id uuid;
  v_ticket_number varchar(20);
BEGIN
  -- Generate unique ticket number
  v_ticket_number := generate_ticket_number();

  -- Create ticket
  INSERT INTO support_tickets (
    ticket_number,
    customer_id,
    chatbot_session_id,
    escalation_reason,
    priority,
    status,
    metadata
  )
  VALUES (
    v_ticket_number,
    p_customer_id,
    p_chatbot_session_id,
    p_escalation_reason,
    p_priority,
    'open',
    p_metadata
  )
  RETURNING id INTO v_ticket_id;

  -- Update chatbot session status
  UPDATE chatbot_sessions
  SET status = 'escalated'
  WHERE session_id = p_chatbot_session_id;

  -- Log escalation in chatbot interactions
  INSERT INTO chatbot_interactions (
    customer_id,
    session_id,
    message_type,
    message_text,
    escalated_to_human,
    escalated_at,
    metadata
  )
  VALUES (
    p_customer_id,
    p_chatbot_session_id,
    'escalation',
    'Conversation escalated to support ticket: ' || v_ticket_number,
    true,
    now(),
    jsonb_build_object('ticket_id', v_ticket_id, 'ticket_number', v_ticket_number)
  );

  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql;

-- Function to assign ticket to staff
CREATE OR REPLACE FUNCTION assign_ticket(
  p_ticket_id uuid,
  p_user_id uuid
)
RETURNS boolean AS $$
BEGIN
  UPDATE support_tickets
  SET
    assigned_to_user_id = p_user_id,
    assigned_at = now(),
    status = CASE WHEN status = 'open' THEN 'assigned' ELSE status END
  WHERE id = p_ticket_id;

  -- Add system message
  INSERT INTO support_ticket_messages (
    ticket_id,
    sender_type,
    message_text
  )
  VALUES (
    p_ticket_id,
    'system',
    'Ticket assigned to staff member'
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve ticket
CREATE OR REPLACE FUNCTION resolve_ticket(
  p_ticket_id uuid,
  p_resolution_notes text
)
RETURNS boolean AS $$
BEGIN
  UPDATE support_tickets
  SET
    status = 'resolved',
    resolved_at = now(),
    resolution_notes = p_resolution_notes
  WHERE id = p_ticket_id;

  -- Add system message
  INSERT INTO support_ticket_messages (
    ticket_id,
    sender_type,
    message_text
  )
  VALUES (
    p_ticket_id,
    'system',
    'Ticket resolved: ' || p_resolution_notes
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to get open ticket count by priority
CREATE OR REPLACE FUNCTION get_open_ticket_counts()
RETURNS TABLE (
  priority varchar(20),
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.priority,
    COUNT(*) as count
  FROM support_tickets st
  WHERE st.status IN ('open', 'assigned', 'in_progress')
  GROUP BY st.priority
  ORDER BY
    CASE st.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get ticket queue
CREATE OR REPLACE FUNCTION get_ticket_queue(
  p_status_filter varchar(20) DEFAULT NULL,
  p_priority_filter varchar(20) DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  ticket_number varchar(20),
  customer_id uuid,
  customer_name text,
  escalation_reason text,
  priority varchar(20),
  status varchar(20),
  assigned_to_user_id uuid,
  assigned_to_name text,
  created_at timestamptz,
  unread_messages bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id,
    st.ticket_number,
    st.customer_id,
    COALESCE(c.first_name || ' ' || c.last_name, 'Unknown') as customer_name,
    st.escalation_reason,
    st.priority,
    st.status,
    st.assigned_to_user_id,
    u.email as assigned_to_name,
    st.created_at,
    (
      SELECT COUNT(*)
      FROM support_ticket_messages stm
      WHERE stm.ticket_id = st.id
      AND stm.sender_type = 'customer'
      AND stm.created_at > COALESCE(st.updated_at, st.created_at)
    ) as unread_messages
  FROM support_tickets st
  LEFT JOIN customers c ON c.id = st.customer_id
  LEFT JOIN users u ON u.id = st.assigned_to_user_id
  WHERE
    (p_status_filter IS NULL OR st.status = p_status_filter)
    AND (p_priority_filter IS NULL OR st.priority = p_priority_filter)
    AND (p_assigned_to IS NULL OR st.assigned_to_user_id = p_assigned_to)
  ORDER BY
    CASE st.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    st.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get ticket with conversation history
CREATE OR REPLACE FUNCTION get_ticket_with_history(p_ticket_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_ticket jsonb;
  v_messages jsonb;
  v_chatbot_history jsonb;
BEGIN
  -- Get ticket details
  SELECT jsonb_build_object(
    'id', st.id,
    'ticketNumber', st.ticket_number,
    'customerId', st.customer_id,
    'customerName', COALESCE(c.first_name || ' ' || c.last_name, 'Unknown'),
    'customerEmail', c.email,
    'customerPhone', c.phone,
    'escalationReason', st.escalation_reason,
    'priority', st.priority,
    'status', st.status,
    'assignedToUserId', st.assigned_to_user_id,
    'assignedToName', u.email,
    'createdAt', st.created_at,
    'resolvedAt', st.resolved_at,
    'resolutionNotes', st.resolution_notes
  )
  INTO v_ticket
  FROM support_tickets st
  LEFT JOIN customers c ON c.id = st.customer_id
  LEFT JOIN users u ON u.id = st.assigned_to_user_id
  WHERE st.id = p_ticket_id;

  -- Get ticket messages
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', stm.id,
      'senderType', stm.sender_type,
      'messageText', stm.message_text,
      'isInternalNote', stm.is_internal_note,
      'createdAt', stm.created_at
    )
    ORDER BY stm.created_at ASC
  )
  INTO v_messages
  FROM support_ticket_messages stm
  WHERE stm.ticket_id = p_ticket_id;

  -- Get chatbot conversation history if session exists
  SELECT jsonb_agg(
    jsonb_build_object(
      'messageType', ci.message_type,
      'messageText', ci.message_text,
      'botResponseText', ci.bot_response_text,
      'intentDetected', ci.intent_detected,
      'confidenceScore', ci.confidence_score,
      'createdAt', ci.created_at
    )
    ORDER BY ci.created_at ASC
  )
  INTO v_chatbot_history
  FROM chatbot_interactions ci
  WHERE ci.session_id = (
    SELECT chatbot_session_id FROM support_tickets WHERE id = p_ticket_id
  );

  RETURN jsonb_build_object(
    'ticket', v_ticket,
    'messages', COALESCE(v_messages, '[]'::jsonb),
    'chatbotHistory', COALESCE(v_chatbot_history, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION generate_ticket_number() TO authenticated;
GRANT EXECUTE ON FUNCTION create_support_ticket(uuid, uuid, text, varchar, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_ticket(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_ticket(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_open_ticket_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_queue(varchar, varchar, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_with_history(uuid) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE support_tickets IS 'Stores escalated chatbot conversations and support tickets';
COMMENT ON TABLE support_ticket_messages IS 'Messages exchanged in support tickets';
COMMENT ON TABLE staff_notifications IS 'Notifications sent to staff about escalations';

COMMENT ON FUNCTION create_support_ticket(uuid, uuid, text, varchar, jsonb) IS 'Create support ticket from chatbot escalation';
COMMENT ON FUNCTION assign_ticket(uuid, uuid) IS 'Assign ticket to staff member';
COMMENT ON FUNCTION resolve_ticket(uuid, text) IS 'Mark ticket as resolved with notes';
COMMENT ON FUNCTION get_open_ticket_counts() IS 'Get count of open tickets by priority';
COMMENT ON FUNCTION get_ticket_queue(varchar, varchar, uuid, integer) IS 'Get filtered ticket queue';
COMMENT ON FUNCTION get_ticket_with_history(uuid) IS 'Get ticket with full conversation history';
