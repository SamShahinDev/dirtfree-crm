-- =====================================================
-- Promotion Triggers Migration
-- =====================================================
-- Creates tables and functions for automated promotion triggers
-- Enables automated customer re-engagement and rewards

-- Drop existing objects if they exist
DROP TABLE IF EXISTS automated_promotion_deliveries CASCADE;
DROP TABLE IF EXISTS promotion_triggers CASCADE;
DROP INDEX IF EXISTS idx_triggers_active;
DROP INDEX IF EXISTS idx_automated_deliveries_customer;
DROP INDEX IF EXISTS idx_automated_deliveries_trigger;
DROP FUNCTION IF EXISTS get_inactive_customers(integer);
DROP FUNCTION IF EXISTS get_birthday_customers();
DROP FUNCTION IF EXISTS get_anniversary_customers();
DROP FUNCTION IF EXISTS get_high_value_customers(numeric);
DROP FUNCTION IF EXISTS log_trigger_execution(uuid, integer, integer);

-- =====================================================
-- Promotion Triggers Table
-- =====================================================
CREATE TABLE IF NOT EXISTS promotion_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name varchar(50) UNIQUE NOT NULL,
  trigger_type varchar(30) NOT NULL CHECK (trigger_type IN ('inactive_customer', 'birthday', 'anniversary', 'high_value', 'referral', 'custom')),
  description text,

  -- Trigger conditions (JSONB for flexibility)
  trigger_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Promotion template (JSONB defining the promotion to create)
  promotion_template jsonb NOT NULL,

  -- Delivery settings
  delivery_channels jsonb NOT NULL DEFAULT '["email"]'::jsonb,
  auto_deliver boolean NOT NULL DEFAULT true,

  -- Execution settings
  active boolean NOT NULL DEFAULT true,
  execution_frequency varchar(20) DEFAULT 'daily' CHECK (execution_frequency IN ('daily', 'weekly', 'monthly')),

  -- Tracking
  last_run_at timestamp,
  total_executions integer DEFAULT 0,
  total_deliveries integer DEFAULT 0,

  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Automated Promotion Deliveries Table
-- =====================================================
CREATE TABLE IF NOT EXISTS automated_promotion_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_trigger_id uuid NOT NULL REFERENCES promotion_triggers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,

  -- Delivery tracking
  triggered_at timestamp NOT NULL DEFAULT NOW(),
  delivered_at timestamp,
  viewed_at timestamp,
  claimed_at timestamp,
  redeemed_at timestamp,

  -- Metadata
  trigger_data jsonb,
  discount_amount numeric(10,2),

  created_at timestamp NOT NULL DEFAULT NOW(),

  UNIQUE(promotion_trigger_id, customer_id, promotion_id)
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX idx_triggers_active ON promotion_triggers(active) WHERE active = true;
CREATE INDEX idx_triggers_type ON promotion_triggers(trigger_type);
CREATE INDEX idx_automated_deliveries_customer ON automated_promotion_deliveries(customer_id);
CREATE INDEX idx_automated_deliveries_trigger ON automated_promotion_deliveries(promotion_trigger_id);
CREATE INDEX idx_automated_deliveries_triggered ON automated_promotion_deliveries(triggered_at DESC);

-- =====================================================
-- Updated At Trigger
-- =====================================================
CREATE TRIGGER set_updated_at_triggers
  BEFORE UPDATE ON promotion_triggers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Get Inactive Customers Function
-- =====================================================
CREATE OR REPLACE FUNCTION get_inactive_customers(days_inactive integer DEFAULT 180)
RETURNS TABLE (
  customer_id uuid,
  last_service_date date,
  days_since_service integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as customer_id,
    c.last_service_date,
    DATE_PART('day', NOW() - c.last_service_date)::integer as days_since_service
  FROM customers c
  WHERE c.last_service_date IS NOT NULL
    AND c.last_service_date < NOW() - INTERVAL '1 day' * days_inactive
    AND c.deleted_at IS NULL
  ORDER BY c.last_service_date ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Get Birthday Customers Function
-- =====================================================
CREATE OR REPLACE FUNCTION get_birthday_customers()
RETURNS TABLE (
  customer_id uuid,
  birthday date,
  days_until_birthday integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as customer_id,
    c.birthday,
    CASE
      WHEN DATE_PART('doy', c.birthday) >= DATE_PART('doy', NOW())
      THEN (DATE_PART('doy', c.birthday) - DATE_PART('doy', NOW()))::integer
      ELSE (365 - DATE_PART('doy', NOW()) + DATE_PART('doy', c.birthday))::integer
    END as days_until_birthday
  FROM customers c
  WHERE c.birthday IS NOT NULL
    AND c.deleted_at IS NULL
    -- Birthday is within the next 7 days
    AND (
      (DATE_PART('doy', c.birthday) >= DATE_PART('doy', NOW())
       AND DATE_PART('doy', c.birthday) <= DATE_PART('doy', NOW() + INTERVAL '7 days'))
      OR
      (DATE_PART('doy', c.birthday) + 365 <= DATE_PART('doy', NOW() + INTERVAL '7 days') + 365)
    )
  ORDER BY days_until_birthday ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Get Anniversary Customers Function
-- =====================================================
CREATE OR REPLACE FUNCTION get_anniversary_customers()
RETURNS TABLE (
  customer_id uuid,
  first_service_date date,
  years_as_customer integer,
  days_until_anniversary integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as customer_id,
    c.created_at::date as first_service_date,
    DATE_PART('year', AGE(NOW(), c.created_at))::integer as years_as_customer,
    CASE
      WHEN DATE_PART('doy', c.created_at) >= DATE_PART('doy', NOW())
      THEN (DATE_PART('doy', c.created_at) - DATE_PART('doy', NOW()))::integer
      ELSE (365 - DATE_PART('doy', NOW()) + DATE_PART('doy', c.created_at))::integer
    END as days_until_anniversary
  FROM customers c
  WHERE c.deleted_at IS NULL
    AND DATE_PART('year', AGE(NOW(), c.created_at)) >= 1
    -- Anniversary is within the next 7 days
    AND (
      (DATE_PART('doy', c.created_at) >= DATE_PART('doy', NOW())
       AND DATE_PART('doy', c.created_at) <= DATE_PART('doy', NOW() + INTERVAL '7 days'))
      OR
      (DATE_PART('doy', c.created_at) + 365 <= DATE_PART('doy', NOW() + INTERVAL '7 days') + 365)
    )
  ORDER BY days_until_anniversary ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Get High-Value Customers Function
-- =====================================================
CREATE OR REPLACE FUNCTION get_high_value_customers(min_lifetime_value numeric DEFAULT 1000)
RETURNS TABLE (
  customer_id uuid,
  lifetime_value numeric,
  total_jobs integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as customer_id,
    COALESCE(c.lifetime_value, 0) as lifetime_value,
    COALESCE(c.total_jobs, 0) as total_jobs
  FROM customers c
  WHERE c.deleted_at IS NULL
    AND COALESCE(c.lifetime_value, 0) >= min_lifetime_value
  ORDER BY c.lifetime_value DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Log Trigger Execution Function
-- =====================================================
CREATE OR REPLACE FUNCTION log_trigger_execution(
  p_trigger_id uuid,
  p_customers_found integer,
  p_deliveries_created integer
)
RETURNS void AS $$
BEGIN
  UPDATE promotion_triggers
  SET
    last_run_at = NOW(),
    total_executions = total_executions + 1,
    total_deliveries = total_deliveries + p_deliveries_created,
    updated_at = NOW()
  WHERE id = p_trigger_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE promotion_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_promotion_deliveries ENABLE ROW LEVEL SECURITY;

-- Staff can view all triggers
CREATE POLICY "Staff can view triggers"
  ON promotion_triggers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admins can modify triggers
CREATE POLICY "Admins can manage triggers"
  ON promotion_triggers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Staff can view automated deliveries
CREATE POLICY "Staff can view automated deliveries"
  ON automated_promotion_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Service role can manage all
CREATE POLICY "Service role can manage triggers"
  ON promotion_triggers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage automated deliveries"
  ON automated_promotion_deliveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Seed Default Triggers
-- =====================================================
INSERT INTO promotion_triggers (trigger_name, trigger_type, description, trigger_conditions, promotion_template, delivery_channels) VALUES
(
  'inactive_customer_180d',
  'inactive_customer',
  'Re-engage customers who haven''t booked in 180 days',
  '{"days_inactive": 180}',
  '{
    "title": "We Miss You! Come Back Special",
    "description": "It''s been a while since your last service. We''d love to see you again!",
    "promotion_type": "percentage_off",
    "discount_percentage": 15,
    "target_audience": "inactive",
    "valid_days": 30
  }',
  '["email"]'
),
(
  'birthday_special',
  'birthday',
  'Send birthday promotion 1 week before customer birthday',
  '{"days_before": 7}',
  '{
    "title": "Happy Birthday! Special Gift Inside",
    "description": "Celebrate your birthday with a special discount on your next service!",
    "promotion_type": "dollar_off",
    "discount_value": 20,
    "target_audience": "all_customers",
    "valid_days": 30
  }',
  '["email", "sms"]'
),
(
  'anniversary_reward',
  'anniversary',
  'Thank customers on their service anniversary',
  '{"years": 1}',
  '{
    "title": "Thank You for {years} Year(s) with Us!",
    "description": "We appreciate your loyalty! Enjoy this special anniversary discount.",
    "promotion_type": "percentage_off",
    "discount_percentage": 10,
    "target_audience": "all_customers",
    "valid_days": 60
  }',
  '["email"]'
),
(
  'vip_exclusive',
  'high_value',
  'Monthly VIP offers for high-value customers',
  '{"min_lifetime_value": 1000}',
  '{
    "title": "VIP Exclusive: Thank You for Your Business",
    "description": "As a valued VIP customer, enjoy this exclusive offer!",
    "promotion_type": "percentage_off",
    "discount_percentage": 15,
    "target_audience": "vip",
    "valid_days": 30
  }',
  '["email"]'
);

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE promotion_triggers IS 'Defines automated promotion trigger rules';
COMMENT ON TABLE automated_promotion_deliveries IS 'Tracks automated promotion deliveries';
COMMENT ON FUNCTION get_inactive_customers IS 'Returns customers who haven''t had service in specified days';
COMMENT ON FUNCTION get_birthday_customers IS 'Returns customers with upcoming birthdays';
COMMENT ON FUNCTION get_anniversary_customers IS 'Returns customers with upcoming service anniversaries';
COMMENT ON FUNCTION get_high_value_customers IS 'Returns customers above specified lifetime value threshold';
