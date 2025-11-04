-- =====================================================
-- Real-Time Messaging Infrastructure
-- =====================================================
-- Tables and functions for real-time messaging features:
-- - Message read receipts
-- - Typing indicators
-- - Online/offline status
-- - Message delivery tracking

-- =====================================================
-- Message Read Receipts
-- =====================================================

CREATE TABLE IF NOT EXISTS message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES customer_messages(id) ON DELETE CASCADE,
  read_by_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  read_by_customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT read_by_either_user_or_customer CHECK (
    (read_by_user_id IS NOT NULL AND read_by_customer_id IS NULL) OR
    (read_by_user_id IS NULL AND read_by_customer_id IS NOT NULL)
  ),
  CONSTRAINT unique_message_reader UNIQUE (message_id, read_by_user_id, read_by_customer_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX idx_message_read_receipts_user ON message_read_receipts(read_by_user_id) WHERE read_by_user_id IS NOT NULL;
CREATE INDEX idx_message_read_receipts_customer ON message_read_receipts(read_by_customer_id) WHERE read_by_customer_id IS NOT NULL;
CREATE INDEX idx_message_read_receipts_read_at ON message_read_receipts(read_at DESC);

-- RLS policies
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Staff can view all read receipts
CREATE POLICY message_read_receipts_staff_read
ON message_read_receipts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Customers can view read receipts for their messages
CREATE POLICY message_read_receipts_customer_read
ON message_read_receipts
FOR SELECT
TO authenticated
USING (
  read_by_customer_id IN (
    SELECT id FROM customers
    WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM customer_messages cm
    WHERE cm.id = message_id
    AND cm.customer_id IN (
      SELECT id FROM customers
      WHERE user_id = auth.uid()
    )
  )
);

-- Anyone can insert read receipts
CREATE POLICY message_read_receipts_insert
ON message_read_receipts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- Message Typing Indicators
-- =====================================================

CREATE TABLE IF NOT EXISTS message_typing_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  is_typing boolean DEFAULT true NOT NULL,
  started_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT typing_by_either_user_or_customer CHECK (
    (user_id IS NOT NULL AND customer_id IS NULL) OR
    (user_id IS NULL AND customer_id IS NOT NULL)
  ),
  CONSTRAINT unique_conversation_typer UNIQUE (conversation_id, user_id, customer_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_message_typing_indicators_conversation ON message_typing_indicators(conversation_id);
CREATE INDEX idx_message_typing_indicators_active ON message_typing_indicators(conversation_id) WHERE is_typing = true AND expires_at > now();
CREATE INDEX idx_message_typing_indicators_expires ON message_typing_indicators(expires_at);

-- RLS policies
ALTER TABLE message_typing_indicators ENABLE ROW LEVEL SECURITY;

-- Staff can view all typing indicators
CREATE POLICY message_typing_indicators_staff_read
ON message_typing_indicators
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Customers can view typing indicators for their conversations
CREATE POLICY message_typing_indicators_customer_read
ON message_typing_indicators
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers
    WHERE user_id = auth.uid()
  )
);

-- Staff can insert/update typing indicators
CREATE POLICY message_typing_indicators_staff_modify
ON message_typing_indicators
FOR ALL
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

-- Customers can insert/update their own typing indicators
CREATE POLICY message_typing_indicators_customer_modify
ON message_typing_indicators
FOR ALL
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
-- Online/Offline Status
-- =====================================================

CREATE TABLE IF NOT EXISTS user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  customer_id uuid UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('online', 'away', 'offline')),
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT presence_for_either_user_or_customer CHECK (
    (user_id IS NOT NULL AND customer_id IS NULL) OR
    (user_id IS NULL AND customer_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_user_presence_user ON user_presence(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_presence_customer ON user_presence(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_user_presence_status ON user_presence(status, last_seen_at DESC);

-- RLS policies
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Everyone can view presence
CREATE POLICY user_presence_read
ON user_presence
FOR SELECT
TO authenticated
USING (true);

-- Users can update their own presence
CREATE POLICY user_presence_staff_modify
ON user_presence
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Customers can update their own presence
CREATE POLICY user_presence_customer_modify
ON user_presence
FOR ALL
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
-- Message Delivery Status
-- =====================================================

CREATE TABLE IF NOT EXISTS message_delivery_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES customer_messages(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  recipient_type text NOT NULL CHECK (recipient_type IN ('customer', 'staff')),
  recipient_id uuid NOT NULL,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_reason text,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_message_recipient UNIQUE (message_id, recipient_id)
);

-- Indexes
CREATE INDEX idx_message_delivery_status_message ON message_delivery_status(message_id);
CREATE INDEX idx_message_delivery_status_recipient ON message_delivery_status(recipient_id);
CREATE INDEX idx_message_delivery_status_status ON message_delivery_status(status);

-- RLS policies
ALTER TABLE message_delivery_status ENABLE ROW LEVEL SECURITY;

-- Staff can view all delivery statuses
CREATE POLICY message_delivery_status_staff_read
ON message_delivery_status
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher', 'technician')
  )
);

-- Customers can view delivery status for their messages
CREATE POLICY message_delivery_status_customer_read
ON message_delivery_status
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_messages cm
    JOIN customers c ON c.id = cm.customer_id
    WHERE cm.id = message_id
    AND c.user_id = auth.uid()
  )
);

-- System can insert/update delivery status
CREATE POLICY message_delivery_status_modify
ON message_delivery_status
FOR ALL
TO authenticated
WITH CHECK (true);

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to mark message as read
CREATE OR REPLACE FUNCTION mark_message_as_read(
  p_message_id uuid,
  p_reader_user_id uuid DEFAULT NULL,
  p_reader_customer_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_receipt_id uuid;
BEGIN
  -- Insert read receipt (UPSERT)
  INSERT INTO message_read_receipts (
    message_id,
    read_by_user_id,
    read_by_customer_id,
    read_at
  )
  VALUES (
    p_message_id,
    p_reader_user_id,
    p_reader_customer_id,
    now()
  )
  ON CONFLICT (message_id, read_by_user_id, read_by_customer_id)
  DO UPDATE SET read_at = now()
  RETURNING id INTO v_receipt_id;

  -- Update delivery status to 'read'
  UPDATE message_delivery_status
  SET
    status = 'read',
    read_at = now(),
    updated_at = now()
  WHERE message_id = p_message_id
    AND (
      (recipient_id = p_reader_user_id AND recipient_type = 'staff') OR
      (recipient_id = p_reader_customer_id AND recipient_type = 'customer')
    );

  RETURN v_receipt_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update typing indicator
CREATE OR REPLACE FUNCTION update_typing_indicator(
  p_conversation_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_is_typing boolean DEFAULT true,
  p_expires_in_seconds integer DEFAULT 5
)
RETURNS uuid AS $$
DECLARE
  v_indicator_id uuid;
  v_expires_at timestamptz;
BEGIN
  v_expires_at := now() + (p_expires_in_seconds || ' seconds')::interval;

  -- Insert or update typing indicator
  INSERT INTO message_typing_indicators (
    conversation_id,
    user_id,
    customer_id,
    is_typing,
    started_at,
    expires_at,
    updated_at
  )
  VALUES (
    p_conversation_id,
    p_user_id,
    p_customer_id,
    p_is_typing,
    now(),
    v_expires_at,
    now()
  )
  ON CONFLICT (conversation_id, user_id, customer_id)
  DO UPDATE SET
    is_typing = p_is_typing,
    expires_at = v_expires_at,
    updated_at = now()
  RETURNING id INTO v_indicator_id;

  RETURN v_indicator_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update user presence
CREATE OR REPLACE FUNCTION update_user_presence(
  p_user_id uuid DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_status text DEFAULT 'online',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_presence_id uuid;
BEGIN
  -- Insert or update presence
  INSERT INTO user_presence (
    user_id,
    customer_id,
    status,
    last_seen_at,
    metadata
  )
  VALUES (
    p_user_id,
    p_customer_id,
    p_status,
    now(),
    p_metadata
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL
  DO UPDATE SET
    status = p_status,
    last_seen_at = now(),
    metadata = p_metadata
  RETURNING id INTO v_presence_id;

  IF v_presence_id IS NULL THEN
    INSERT INTO user_presence (
      user_id,
      customer_id,
      status,
      last_seen_at,
      metadata
    )
    VALUES (
      p_user_id,
      p_customer_id,
      p_status,
      now(),
      p_metadata
    )
    ON CONFLICT (customer_id) WHERE customer_id IS NOT NULL
    DO UPDATE SET
      status = p_status,
      last_seen_at = now(),
      metadata = p_metadata
    RETURNING id INTO v_presence_id;
  END IF;

  RETURN v_presence_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired typing indicators
CREATE OR REPLACE FUNCTION cleanup_expired_typing_indicators()
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM message_typing_indicators
  WHERE expires_at < now()
  OR (is_typing = false AND updated_at < now() - interval '1 minute');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_message_count(
  p_user_id uuid DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NOT NULL THEN
    -- Count unread messages for staff
    SELECT COUNT(DISTINCT cm.id)
    INTO v_count
    FROM customer_messages cm
    WHERE cm.sender_type = 'customer'
    AND NOT EXISTS (
      SELECT 1 FROM message_read_receipts mrr
      WHERE mrr.message_id = cm.id
      AND mrr.read_by_user_id = p_user_id
    );
  ELSIF p_customer_id IS NOT NULL THEN
    -- Count unread messages for customer
    SELECT COUNT(DISTINCT cm.id)
    INTO v_count
    FROM customer_messages cm
    WHERE cm.customer_id = p_customer_id
    AND cm.sender_type = 'staff'
    AND NOT EXISTS (
      SELECT 1 FROM message_read_receipts mrr
      WHERE mrr.message_id = cm.id
      AND mrr.read_by_customer_id = p_customer_id
    );
  ELSE
    v_count := 0;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_typing_indicators_timestamp ON message_typing_indicators;
CREATE TRIGGER trigger_update_typing_indicators_timestamp
  BEFORE UPDATE ON message_typing_indicators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_update_delivery_status_timestamp ON message_delivery_status;
CREATE TRIGGER trigger_update_delivery_status_timestamp
  BEFORE UPDATE ON message_delivery_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_timestamp();

-- =====================================================
-- Enable Realtime
-- =====================================================

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE customer_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE message_typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE message_delivery_status;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION mark_message_as_read(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_typing_indicator(uuid, uuid, uuid, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_presence(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_typing_indicators() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count(uuid, uuid) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE message_read_receipts IS 'Tracks when messages are read by users or customers';
COMMENT ON TABLE message_typing_indicators IS 'Real-time typing indicators for conversations';
COMMENT ON TABLE user_presence IS 'Online/offline status for users and customers';
COMMENT ON TABLE message_delivery_status IS 'Message delivery and read status tracking';

COMMENT ON FUNCTION mark_message_as_read(uuid, uuid, uuid) IS 'Mark a message as read and update delivery status';
COMMENT ON FUNCTION update_typing_indicator(uuid, uuid, uuid, boolean, integer) IS 'Update or create typing indicator';
COMMENT ON FUNCTION update_user_presence(uuid, uuid, text, jsonb) IS 'Update user/customer online presence';
COMMENT ON FUNCTION cleanup_expired_typing_indicators() IS 'Remove expired typing indicators';
COMMENT ON FUNCTION get_unread_message_count(uuid, uuid) IS 'Get count of unread messages for user or customer';
