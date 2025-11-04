-- =====================================================
-- Broadcast Messaging System
-- =====================================================
-- Enables targeted mass communication for service updates,
-- promotions, or emergency notices

-- =====================================================
-- Broadcast Messages Table
-- =====================================================

CREATE TABLE IF NOT EXISTS broadcast_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject varchar(255) NOT NULL,
  message_text text NOT NULL,
  delivery_methods jsonb NOT NULL DEFAULT '["portal"]'::jsonb, -- ['portal', 'email', 'sms']
  recipient_filter jsonb DEFAULT '{}'::jsonb,
  recipient_count integer DEFAULT 0,
  scheduled_for timestamptz,
  status varchar(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  completed_at timestamptz,
  delivery_success_count integer DEFAULT 0,
  delivery_failed_count integer DEFAULT 0,
  estimated_cost_usd numeric(10,2) DEFAULT 0,
  actual_cost_usd numeric(10,2),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_broadcast_messages_status ON broadcast_messages(status);
CREATE INDEX idx_broadcast_messages_scheduled ON broadcast_messages(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_broadcast_messages_created_by ON broadcast_messages(created_by_user_id);
CREATE INDEX idx_broadcast_messages_created_at ON broadcast_messages(created_at DESC);

-- =====================================================
-- Broadcast Deliveries Table
-- =====================================================

CREATE TABLE IF NOT EXISTS broadcast_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid REFERENCES broadcast_messages(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  delivery_method varchar(20) NOT NULL CHECK (delivery_method IN ('portal', 'email', 'sms')),
  delivered_at timestamptz,
  read_at timestamptz,
  failed boolean DEFAULT false,
  failure_reason text,
  cost_usd numeric(10,2),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_broadcast_deliveries_broadcast ON broadcast_deliveries(broadcast_id);
CREATE INDEX idx_broadcast_deliveries_customer ON broadcast_deliveries(customer_id);
CREATE INDEX idx_broadcast_deliveries_status ON broadcast_deliveries(broadcast_id, failed, delivered_at);
CREATE INDEX idx_broadcast_deliveries_read ON broadcast_deliveries(customer_id, read_at) WHERE read_at IS NOT NULL;

-- Unique constraint to prevent duplicate deliveries
CREATE UNIQUE INDEX idx_broadcast_deliveries_unique ON broadcast_deliveries(broadcast_id, customer_id, delivery_method);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_deliveries ENABLE ROW LEVEL SECURITY;

-- Staff can view all broadcast messages
CREATE POLICY broadcast_messages_staff_read
ON broadcast_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher')
  )
);

-- Staff can create broadcast messages
CREATE POLICY broadcast_messages_staff_insert
ON broadcast_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher')
  )
);

-- Staff can update their own broadcasts (or admins can update all)
CREATE POLICY broadcast_messages_staff_update
ON broadcast_messages
FOR UPDATE
TO authenticated
USING (
  created_by_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  created_by_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Staff can delete their own broadcasts
CREATE POLICY broadcast_messages_staff_delete
ON broadcast_messages
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

-- Staff can view all deliveries
CREATE POLICY broadcast_deliveries_staff_read
ON broadcast_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher')
  )
);

-- Customers can view their own deliveries
CREATE POLICY broadcast_deliveries_customer_read
ON broadcast_deliveries
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
CREATE OR REPLACE FUNCTION update_broadcast_message_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_broadcast_message_timestamp ON broadcast_messages;
CREATE TRIGGER trigger_update_broadcast_message_timestamp
  BEFORE UPDATE ON broadcast_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_broadcast_message_timestamp();

-- Auto-update delivery counters
CREATE OR REPLACE FUNCTION update_broadcast_delivery_counters()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE broadcast_messages
    SET
      delivery_success_count = (
        SELECT COUNT(*) FROM broadcast_deliveries
        WHERE broadcast_id = NEW.broadcast_id
        AND delivered_at IS NOT NULL
        AND failed = false
      ),
      delivery_failed_count = (
        SELECT COUNT(*) FROM broadcast_deliveries
        WHERE broadcast_id = NEW.broadcast_id
        AND failed = true
      )
    WHERE id = NEW.broadcast_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_broadcast_delivery_counters ON broadcast_deliveries;
CREATE TRIGGER trigger_update_broadcast_delivery_counters
  AFTER INSERT OR UPDATE ON broadcast_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_broadcast_delivery_counters();

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to filter recipients based on criteria
CREATE OR REPLACE FUNCTION get_broadcast_recipients(
  p_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  email text,
  phone text,
  zone_id uuid
) AS $$
DECLARE
  v_zones uuid[];
  v_service_types text[];
  v_tags text[];
  v_last_visit_start date;
  v_last_visit_end date;
  v_specific_ids uuid[];
BEGIN
  -- Extract filter parameters
  v_zones := CASE
    WHEN p_filter ? 'zones' THEN
      ARRAY(SELECT jsonb_array_elements_text(p_filter->'zones')::uuid)
    ELSE NULL
  END;

  v_service_types := CASE
    WHEN p_filter ? 'serviceTypes' THEN
      ARRAY(SELECT jsonb_array_elements_text(p_filter->'serviceTypes'))
    ELSE NULL
  END;

  v_tags := CASE
    WHEN p_filter ? 'tags' THEN
      ARRAY(SELECT jsonb_array_elements_text(p_filter->'tags'))
    ELSE NULL
  END;

  v_last_visit_start := (p_filter->>'lastVisitStart')::date;
  v_last_visit_end := (p_filter->>'lastVisitEnd')::date;

  v_specific_ids := CASE
    WHEN p_filter ? 'specificIds' THEN
      ARRAY(SELECT jsonb_array_elements_text(p_filter->'specificIds')::uuid)
    ELSE NULL
  END;

  RETURN QUERY
  SELECT DISTINCT
    c.id as customer_id,
    c.full_name as customer_name,
    c.email,
    c.phone,
    c.zone_id
  FROM customers c
  WHERE
    -- Not deleted
    c.deleted_at IS NULL

    -- Zone filter
    AND (v_zones IS NULL OR c.zone_id = ANY(v_zones))

    -- Service type filter (has had at least one job of this type)
    AND (
      v_service_types IS NULL
      OR EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.customer_id = c.id
        AND j.service_type = ANY(v_service_types)
      )
    )

    -- Tags filter
    AND (
      v_tags IS NULL
      OR c.tags ?| v_tags
    )

    -- Last visit date filter
    AND (
      (v_last_visit_start IS NULL AND v_last_visit_end IS NULL)
      OR c.last_service_date BETWEEN COALESCE(v_last_visit_start, '1900-01-01'::date)
                                 AND COALESCE(v_last_visit_end, '2100-12-31'::date)
    )

    -- Specific IDs filter (overrides all other filters if present)
    AND (
      v_specific_ids IS NULL
      OR c.id = ANY(v_specific_ids)
    )
  ORDER BY c.full_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get recipient count
CREATE OR REPLACE FUNCTION get_broadcast_recipient_count(
  p_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM get_broadcast_recipients(p_filter))::integer;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to create broadcast deliveries
CREATE OR REPLACE FUNCTION create_broadcast_deliveries(
  p_broadcast_id uuid,
  p_delivery_methods text[]
)
RETURNS integer AS $$
DECLARE
  v_broadcast record;
  v_recipient record;
  v_method text;
  v_count integer := 0;
BEGIN
  -- Get broadcast details
  SELECT * INTO v_broadcast
  FROM broadcast_messages
  WHERE id = p_broadcast_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Broadcast message not found';
  END IF;

  -- Get recipients based on filter
  FOR v_recipient IN
    SELECT * FROM get_broadcast_recipients(v_broadcast.recipient_filter)
  LOOP
    -- Create delivery record for each method
    FOREACH v_method IN ARRAY p_delivery_methods
    LOOP
      -- Skip if customer doesn't have contact info for this method
      IF (v_method = 'email' AND v_recipient.email IS NULL) OR
         (v_method = 'sms' AND v_recipient.phone IS NULL) THEN
        CONTINUE;
      END IF;

      INSERT INTO broadcast_deliveries (
        broadcast_id,
        customer_id,
        delivery_method
      ) VALUES (
        p_broadcast_id,
        v_recipient.customer_id,
        v_method
      )
      ON CONFLICT (broadcast_id, customer_id, delivery_method) DO NOTHING;

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to process scheduled broadcasts
CREATE OR REPLACE FUNCTION process_scheduled_broadcasts()
RETURNS integer AS $$
DECLARE
  v_broadcast record;
  v_count integer := 0;
  v_delivery_methods text[];
BEGIN
  FOR v_broadcast IN
    SELECT *
    FROM broadcast_messages
    WHERE status = 'scheduled'
    AND scheduled_for <= now()
    ORDER BY scheduled_for
  LOOP
    -- Convert jsonb to text array
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_broadcast.delivery_methods))
    INTO v_delivery_methods;

    -- Update status to sending
    UPDATE broadcast_messages
    SET status = 'sending', sent_at = now()
    WHERE id = v_broadcast.id;

    -- Create delivery records
    PERFORM create_broadcast_deliveries(v_broadcast.id, v_delivery_methods);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get broadcast statistics
CREATE OR REPLACE FUNCTION get_broadcast_statistics(
  p_broadcast_id uuid
)
RETURNS TABLE (
  total_recipients integer,
  delivered_count integer,
  failed_count integer,
  read_count integer,
  delivery_rate numeric,
  read_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::integer as total_recipients,
    COUNT(CASE WHEN delivered_at IS NOT NULL AND NOT failed THEN 1 END)::integer as delivered_count,
    COUNT(CASE WHEN failed THEN 1 END)::integer as failed_count,
    COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END)::integer as read_count,
    ROUND((COUNT(CASE WHEN delivered_at IS NOT NULL AND NOT failed THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 2) as delivery_rate,
    ROUND((COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(CASE WHEN delivered_at IS NOT NULL AND NOT failed THEN 1 END), 0) * 100)::numeric, 2) as read_rate
  FROM broadcast_deliveries
  WHERE broadcast_id = p_broadcast_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to mark delivery as read
CREATE OR REPLACE FUNCTION mark_broadcast_delivery_read(
  p_delivery_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE broadcast_deliveries
  SET read_at = now()
  WHERE id = p_delivery_id
  AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to estimate SMS cost
CREATE OR REPLACE FUNCTION estimate_sms_cost(
  p_message_text text,
  p_recipient_count integer,
  p_cost_per_segment numeric DEFAULT 0.0079 -- Twilio pricing ~$0.0079/segment
)
RETURNS numeric AS $$
DECLARE
  v_message_length integer;
  v_segments integer;
  v_total_cost numeric;
BEGIN
  v_message_length := LENGTH(p_message_text);

  -- Calculate SMS segments (160 chars per segment, 153 for multi-part)
  IF v_message_length <= 160 THEN
    v_segments := 1;
  ELSE
    v_segments := CEIL(v_message_length::numeric / 153);
  END IF;

  v_total_cost := v_segments * p_recipient_count * p_cost_per_segment;

  RETURN ROUND(v_total_cost, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION get_broadcast_recipients(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_broadcast_recipient_count(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION create_broadcast_deliveries(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION process_scheduled_broadcasts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_broadcast_statistics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_broadcast_delivery_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION estimate_sms_cost(text, integer, numeric) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE broadcast_messages IS 'Stores broadcast messages for mass communication';
COMMENT ON TABLE broadcast_deliveries IS 'Tracks individual delivery status for each broadcast recipient';

COMMENT ON FUNCTION get_broadcast_recipients(jsonb) IS 'Get list of customers matching filter criteria';
COMMENT ON FUNCTION get_broadcast_recipient_count(jsonb) IS 'Get count of customers matching filter criteria';
COMMENT ON FUNCTION create_broadcast_deliveries(uuid, text[]) IS 'Create delivery records for a broadcast message';
COMMENT ON FUNCTION process_scheduled_broadcasts() IS 'Process and send scheduled broadcasts';
COMMENT ON FUNCTION get_broadcast_statistics(uuid) IS 'Get delivery and read statistics for a broadcast';
COMMENT ON FUNCTION mark_broadcast_delivery_read(uuid) IS 'Mark a broadcast delivery as read';
COMMENT ON FUNCTION estimate_sms_cost(text, integer, numeric) IS 'Estimate SMS cost based on message length and recipient count';
