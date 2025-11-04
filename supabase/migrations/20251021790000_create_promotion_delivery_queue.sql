-- =====================================================
-- Promotion Delivery Queue Migration
-- =====================================================
-- Creates tables and functions for managing promotion delivery queue
-- Handles batched, rate-limited delivery processing

-- Drop existing objects if they exist
DROP TABLE IF EXISTS promotion_delivery_queue CASCADE;
DROP INDEX IF EXISTS idx_delivery_queue_status;
DROP INDEX IF EXISTS idx_delivery_queue_promotion;
DROP INDEX IF EXISTS idx_delivery_queue_customer;
DROP FUNCTION IF EXISTS get_pending_deliveries(integer);
DROP FUNCTION IF EXISTS mark_delivery_processing(uuid);
DROP FUNCTION IF EXISTS mark_delivery_delivered(uuid);
DROP FUNCTION IF EXISTS mark_delivery_failed(uuid, text);

-- =====================================================
-- Promotion Delivery Queue Table
-- =====================================================
CREATE TABLE IF NOT EXISTS promotion_delivery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delivery_method varchar(20) NOT NULL CHECK (delivery_method IN ('portal', 'email', 'sms')),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_attempt_at timestamp,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(promotion_id, customer_id, delivery_method)
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX idx_delivery_queue_status ON promotion_delivery_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_delivery_queue_promotion ON promotion_delivery_queue(promotion_id);
CREATE INDEX idx_delivery_queue_customer ON promotion_delivery_queue(customer_id);
CREATE INDEX idx_delivery_queue_created ON promotion_delivery_queue(created_at);
CREATE INDEX idx_delivery_queue_method ON promotion_delivery_queue(delivery_method);

-- =====================================================
-- Updated At Trigger
-- =====================================================
CREATE TRIGGER set_updated_at_delivery_queue
  BEFORE UPDATE ON promotion_delivery_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Get Pending Deliveries Function
-- =====================================================
-- Returns batch of pending deliveries for processing
CREATE OR REPLACE FUNCTION get_pending_deliveries(batch_size integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  promotion_id uuid,
  customer_id uuid,
  delivery_method varchar,
  attempts integer,
  promotion_title varchar,
  promo_code varchar,
  customer_email varchar,
  customer_phone varchar,
  customer_name varchar
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pdq.id,
    pdq.promotion_id,
    pdq.customer_id,
    pdq.delivery_method,
    pdq.attempts,
    p.title as promotion_title,
    p.promo_code,
    c.email as customer_email,
    c.phone as customer_phone,
    c.full_name as customer_name
  FROM promotion_delivery_queue pdq
  JOIN promotions p ON pdq.promotion_id = p.id
  JOIN customers c ON pdq.customer_id = c.id
  WHERE pdq.status = 'pending'
    AND pdq.attempts < pdq.max_attempts
    AND p.status = 'active'
    AND (pdq.last_attempt_at IS NULL OR pdq.last_attempt_at < NOW() - INTERVAL '5 minutes')
  ORDER BY pdq.created_at ASC
  LIMIT batch_size
  FOR UPDATE OF pdq SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Mark Delivery Processing
-- =====================================================
CREATE OR REPLACE FUNCTION mark_delivery_processing(delivery_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE promotion_delivery_queue
  SET
    status = 'processing',
    attempts = attempts + 1,
    last_attempt_at = NOW(),
    updated_at = NOW()
  WHERE id = delivery_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Mark Delivery Delivered
-- =====================================================
CREATE OR REPLACE FUNCTION mark_delivery_delivered(delivery_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE promotion_delivery_queue
  SET
    status = 'delivered',
    updated_at = NOW()
  WHERE id = delivery_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Mark Delivery Failed
-- =====================================================
CREATE OR REPLACE FUNCTION mark_delivery_failed(delivery_id uuid, error_msg text)
RETURNS void AS $$
DECLARE
  current_attempts integer;
  max_attempts_value integer;
BEGIN
  -- Get current attempts
  SELECT attempts, max_attempts INTO current_attempts, max_attempts_value
  FROM promotion_delivery_queue
  WHERE id = delivery_id;

  -- Update status based on attempts
  UPDATE promotion_delivery_queue
  SET
    status = CASE
      WHEN current_attempts >= max_attempts_value THEN 'failed'
      ELSE 'pending'
    END,
    error_message = error_msg,
    updated_at = NOW()
  WHERE id = delivery_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Queue Promotion Deliveries Function
-- =====================================================
-- Creates delivery queue entries for a promotion
CREATE OR REPLACE FUNCTION queue_promotion_deliveries(
  p_promotion_id uuid,
  p_customer_ids uuid[],
  p_delivery_channels text[]
)
RETURNS integer AS $$
DECLARE
  customer_id uuid;
  channel text;
  inserted_count integer := 0;
BEGIN
  -- Loop through customers and channels
  FOREACH customer_id IN ARRAY p_customer_ids
  LOOP
    FOREACH channel IN ARRAY p_delivery_channels
    LOOP
      -- Insert delivery queue entry (ignore duplicates)
      INSERT INTO promotion_delivery_queue (
        promotion_id,
        customer_id,
        delivery_method,
        status
      )
      VALUES (
        p_promotion_id,
        customer_id,
        channel,
        'pending'
      )
      ON CONFLICT (promotion_id, customer_id, delivery_method) DO NOTHING;

      -- Check if row was inserted
      IF FOUND THEN
        inserted_count := inserted_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Get Delivery Statistics
-- =====================================================
CREATE OR REPLACE FUNCTION get_delivery_statistics(p_promotion_id uuid)
RETURNS TABLE (
  total_queued bigint,
  pending bigint,
  processing bigint,
  delivered bigint,
  failed bigint,
  by_method jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_queued,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending,
    COUNT(*) FILTER (WHERE status = 'processing')::bigint as processing,
    COUNT(*) FILTER (WHERE status = 'delivered')::bigint as delivered,
    COUNT(*) FILTER (WHERE status = 'failed')::bigint as failed,
    jsonb_object_agg(
      delivery_method,
      jsonb_build_object(
        'total', method_count,
        'delivered', delivered_count,
        'failed', failed_count
      )
    ) as by_method
  FROM (
    SELECT
      delivery_method,
      COUNT(*)::bigint as method_count,
      COUNT(*) FILTER (WHERE status = 'delivered')::bigint as delivered_count,
      COUNT(*) FILTER (WHERE status = 'failed')::bigint as failed_count
    FROM promotion_delivery_queue
    WHERE promotion_id = p_promotion_id
    GROUP BY delivery_method
  ) method_stats
  CROSS JOIN (
    SELECT promotion_id
    FROM promotion_delivery_queue
    WHERE promotion_id = p_promotion_id
    LIMIT 1
  ) promo;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE promotion_delivery_queue ENABLE ROW LEVEL SECURITY;

-- Staff can view all delivery queue entries
CREATE POLICY "Staff can view delivery queue"
  ON promotion_delivery_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Only system/service role can modify delivery queue
CREATE POLICY "Service role can manage delivery queue"
  ON promotion_delivery_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE promotion_delivery_queue IS 'Queue for managing promotion deliveries across multiple channels';
COMMENT ON FUNCTION get_pending_deliveries IS 'Returns batch of pending deliveries with row-level locking';
COMMENT ON FUNCTION queue_promotion_deliveries IS 'Creates delivery queue entries for a promotion and list of customers';
COMMENT ON FUNCTION get_delivery_statistics IS 'Returns delivery statistics for a promotion';
