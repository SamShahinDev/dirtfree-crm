-- =====================================================
-- Promotions and Offers System
-- =====================================================
-- Manages promotional campaigns, discounts, and special offers
-- with automated delivery and redemption tracking

-- =====================================================
-- Promotions Table
-- =====================================================

CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic information
  title varchar(255) NOT NULL,
  description text,
  promotion_type varchar(30) NOT NULL CHECK (promotion_type IN (
    'percentage_off',
    'dollar_off',
    'free_addon',
    'bogo',
    'seasonal',
    'referral',
    'loyalty'
  )),

  -- Discount values
  discount_value numeric(10,2),
  discount_percentage numeric(5,2) CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  free_addon_service varchar(100),

  -- Targeting
  target_audience varchar(30) DEFAULT 'all_customers' CHECK (target_audience IN (
    'all_customers',
    'inactive',
    'vip',
    'new',
    'zone_specific',
    'service_specific',
    'custom'
  )),
  target_zones uuid[], -- Array of zone IDs
  target_service_types varchar(50)[],
  target_customer_tags varchar(50)[],
  min_job_value numeric(10,2),
  max_job_value numeric(10,2),

  -- Validity period
  start_date date NOT NULL,
  end_date date NOT NULL,
  max_redemptions integer,
  redemptions_per_customer integer DEFAULT 1,
  current_redemptions integer DEFAULT 0,

  -- Delivery settings
  delivery_channels jsonb DEFAULT '["portal"]'::jsonb,
  auto_deliver boolean DEFAULT true,
  delivery_scheduled_for timestamptz,
  last_delivered_at timestamptz,

  -- Promo code
  promo_code varchar(50) UNIQUE,
  case_sensitive boolean DEFAULT false,

  -- Status
  status varchar(20) DEFAULT 'draft' CHECK (status IN (
    'draft',
    'scheduled',
    'active',
    'paused',
    'expired',
    'cancelled',
    'completed'
  )),

  -- Terms and conditions
  terms_and_conditions text,
  exclude_other_promotions boolean DEFAULT false,

  -- Metadata
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_discount CHECK (
    (promotion_type = 'percentage_off' AND discount_percentage IS NOT NULL) OR
    (promotion_type = 'dollar_off' AND discount_value IS NOT NULL) OR
    (promotion_type IN ('free_addon', 'bogo', 'seasonal', 'referral', 'loyalty'))
  )
);

-- Indexes for efficient queries
CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotions_promo_code ON promotions(promo_code) WHERE promo_code IS NOT NULL;
CREATE INDEX idx_promotions_type ON promotions(promotion_type);
CREATE INDEX idx_promotions_active ON promotions(status, start_date, end_date) WHERE status IN ('active', 'scheduled');
CREATE INDEX idx_promotions_created_by ON promotions(created_by_user_id);

-- =====================================================
-- Promotion Deliveries Table
-- =====================================================

CREATE TABLE IF NOT EXISTS promotion_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES promotions(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,

  -- Delivery tracking
  delivered_via jsonb, -- ['email', 'sms', 'portal']
  delivered_at timestamptz DEFAULT now(),
  viewed_at timestamptz,

  -- Claim tracking
  claimed_at timestamptz,
  claim_code varchar(50),

  -- Redemption tracking
  redeemed_at timestamptz,
  applied_to_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  discount_amount numeric(10,2),

  -- Status
  expired boolean DEFAULT false,
  expired_at timestamptz,

  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_promo_deliveries_promotion ON promotion_deliveries(promotion_id);
CREATE INDEX idx_promo_deliveries_customer ON promotion_deliveries(customer_id);
CREATE INDEX idx_promo_deliveries_status ON promotion_deliveries(promotion_id, customer_id, redeemed_at);
CREATE INDEX idx_promo_deliveries_expired ON promotion_deliveries(expired, expired_at);
CREATE INDEX idx_promo_deliveries_job ON promotion_deliveries(applied_to_job_id) WHERE applied_to_job_id IS NOT NULL;

-- Unique constraint to prevent duplicate deliveries
CREATE UNIQUE INDEX idx_promo_deliveries_unique ON promotion_deliveries(promotion_id, customer_id);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_deliveries ENABLE ROW LEVEL SECURITY;

-- Staff can view all promotions
CREATE POLICY promotions_staff_read
ON promotions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'dispatcher')
  )
);

-- Staff can create promotions
CREATE POLICY promotions_staff_insert
ON promotions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Staff can update promotions
CREATE POLICY promotions_staff_update
ON promotions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

-- Staff can delete promotions
CREATE POLICY promotions_staff_delete
ON promotions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Customers can view active promotions
CREATE POLICY promotions_customer_read
ON promotions
FOR SELECT
TO authenticated
USING (
  status = 'active'
  AND start_date <= CURRENT_DATE
  AND end_date >= CURRENT_DATE
);

-- Staff can view all deliveries
CREATE POLICY promo_deliveries_staff_read
ON promotion_deliveries
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
CREATE POLICY promo_deliveries_customer_read
ON promotion_deliveries
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- Customers can update their own deliveries (for claiming/viewing)
CREATE POLICY promo_deliveries_customer_update
ON promotion_deliveries
FOR UPDATE
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_promotion_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_promotion_timestamp ON promotions;
CREATE TRIGGER trigger_update_promotion_timestamp
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotion_timestamp();

-- Auto-update status based on dates
CREATE OR REPLACE FUNCTION auto_update_promotion_status()
RETURNS trigger AS $$
BEGIN
  -- If promotion is scheduled and start date has passed, make it active
  IF NEW.status = 'scheduled' AND NEW.start_date <= CURRENT_DATE THEN
    NEW.status = 'active';
  END IF;

  -- If promotion is active and end date has passed, mark as expired
  IF NEW.status = 'active' AND NEW.end_date < CURRENT_DATE THEN
    NEW.status = 'expired';
  END IF;

  -- If max redemptions reached, mark as completed
  IF NEW.max_redemptions IS NOT NULL AND NEW.current_redemptions >= NEW.max_redemptions THEN
    NEW.status = 'completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_update_promotion_status ON promotions;
CREATE TRIGGER trigger_auto_update_promotion_status
  BEFORE INSERT OR UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_promotion_status();

-- Increment redemption counter
CREATE OR REPLACE FUNCTION increment_promotion_redemptions()
RETURNS trigger AS $$
BEGIN
  IF NEW.redeemed_at IS NOT NULL AND OLD.redeemed_at IS NULL THEN
    UPDATE promotions
    SET current_redemptions = current_redemptions + 1
    WHERE id = NEW.promotion_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_promotion_redemptions ON promotion_deliveries;
CREATE TRIGGER trigger_increment_promotion_redemptions
  AFTER UPDATE ON promotion_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION increment_promotion_redemptions();

-- =====================================================
-- Database Functions
-- =====================================================

-- Function to get eligible promotions for a customer
CREATE OR REPLACE FUNCTION get_eligible_promotions(
  p_customer_id uuid,
  p_job_value numeric DEFAULT NULL,
  p_service_type varchar DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title varchar(255),
  description text,
  promotion_type varchar(30),
  discount_value numeric(10,2),
  discount_percentage numeric(5,2),
  promo_code varchar(50),
  end_date date,
  terms_and_conditions text
) AS $$
DECLARE
  v_customer record;
  v_zone_id uuid;
BEGIN
  -- Get customer details
  SELECT c.*, c.zone_id INTO v_customer
  FROM customers c
  WHERE c.id = p_customer_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_zone_id := v_customer.zone_id;

  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.description,
    p.promotion_type,
    p.discount_value,
    p.discount_percentage,
    p.promo_code,
    p.end_date,
    p.terms_and_conditions
  FROM promotions p
  WHERE
    -- Active and within date range
    p.status = 'active'
    AND p.start_date <= CURRENT_DATE
    AND p.end_date >= CURRENT_DATE

    -- Not exceeded max redemptions
    AND (p.max_redemptions IS NULL OR p.current_redemptions < p.max_redemptions)

    -- Check customer redemption limit
    AND (
      SELECT COUNT(*)
      FROM promotion_deliveries pd
      WHERE pd.promotion_id = p.id
      AND pd.customer_id = p_customer_id
      AND pd.redeemed_at IS NOT NULL
    ) < p.redemptions_per_customer

    -- Check target audience
    AND (
      p.target_audience = 'all_customers'
      OR (p.target_audience = 'zone_specific' AND v_zone_id = ANY(p.target_zones))
      OR (p.target_audience = 'service_specific' AND p_service_type = ANY(p.target_service_types))
    )

    -- Check job value requirements
    AND (p.min_job_value IS NULL OR p_job_value >= p.min_job_value)
    AND (p.max_job_value IS NULL OR p_job_value <= p.max_job_value)
  ORDER BY p.discount_percentage DESC NULLS LAST, p.discount_value DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to validate and apply promo code
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_promo_code varchar(50),
  p_customer_id uuid,
  p_job_value numeric DEFAULT NULL
)
RETURNS TABLE (
  valid boolean,
  promotion_id uuid,
  discount_amount numeric(10,2),
  message text
) AS $$
DECLARE
  v_promotion record;
  v_redemption_count integer;
  v_discount numeric(10,2);
BEGIN
  -- Find promotion by code
  SELECT * INTO v_promotion
  FROM promotions
  WHERE (
    CASE
      WHEN case_sensitive THEN promo_code = p_promo_code
      ELSE LOWER(promo_code) = LOWER(p_promo_code)
    END
  );

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric(10,2), 'Invalid promo code'::text;
    RETURN;
  END IF;

  -- Check if promotion is active
  IF v_promotion.status != 'active' THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric(10,2), 'This promotion is not currently active'::text;
    RETURN;
  END IF;

  -- Check date range
  IF CURRENT_DATE < v_promotion.start_date OR CURRENT_DATE > v_promotion.end_date THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric(10,2), 'This promotion has expired'::text;
    RETURN;
  END IF;

  -- Check max redemptions
  IF v_promotion.max_redemptions IS NOT NULL AND v_promotion.current_redemptions >= v_promotion.max_redemptions THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric(10,2), 'This promotion has reached its maximum redemptions'::text;
    RETURN;
  END IF;

  -- Check customer redemption limit
  SELECT COUNT(*) INTO v_redemption_count
  FROM promotion_deliveries
  WHERE promotion_id = v_promotion.id
  AND customer_id = p_customer_id
  AND redeemed_at IS NOT NULL;

  IF v_redemption_count >= v_promotion.redemptions_per_customer THEN
    RETURN QUERY SELECT false, NULL::uuid, 0::numeric(10,2), 'You have already used this promotion the maximum number of times'::text;
    RETURN;
  END IF;

  -- Check min/max job value
  IF p_job_value IS NOT NULL THEN
    IF v_promotion.min_job_value IS NOT NULL AND p_job_value < v_promotion.min_job_value THEN
      RETURN QUERY SELECT false, NULL::uuid, 0::numeric(10,2), format('Minimum job value of $%s required', v_promotion.min_job_value)::text;
      RETURN;
    END IF;

    IF v_promotion.max_job_value IS NOT NULL AND p_job_value > v_promotion.max_job_value THEN
      RETURN QUERY SELECT false, NULL::uuid, 0::numeric(10,2), format('Maximum job value of $%s exceeded', v_promotion.max_job_value)::text;
      RETURN;
    END IF;
  END IF;

  -- Calculate discount
  IF v_promotion.promotion_type = 'percentage_off' THEN
    v_discount := COALESCE(p_job_value, 0) * (v_promotion.discount_percentage / 100);
  ELSIF v_promotion.promotion_type = 'dollar_off' THEN
    v_discount := v_promotion.discount_value;
  ELSE
    v_discount := 0;
  END IF;

  RETURN QUERY SELECT true, v_promotion.id, v_discount, 'Promo code valid'::text;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to redeem promotion
CREATE OR REPLACE FUNCTION redeem_promotion(
  p_promotion_id uuid,
  p_customer_id uuid,
  p_job_id uuid,
  p_discount_amount numeric(10,2)
)
RETURNS uuid AS $$
DECLARE
  v_delivery_id uuid;
BEGIN
  -- Check if delivery exists, create if not
  SELECT id INTO v_delivery_id
  FROM promotion_deliveries
  WHERE promotion_id = p_promotion_id
  AND customer_id = p_customer_id;

  IF NOT FOUND THEN
    INSERT INTO promotion_deliveries (
      promotion_id,
      customer_id,
      delivered_via,
      claimed_at
    ) VALUES (
      p_promotion_id,
      p_customer_id,
      '["manual"]'::jsonb,
      now()
    )
    RETURNING id INTO v_delivery_id;
  END IF;

  -- Mark as redeemed
  UPDATE promotion_deliveries
  SET
    redeemed_at = now(),
    applied_to_job_id = p_job_id,
    discount_amount = p_discount_amount
  WHERE id = v_delivery_id;

  RETURN v_delivery_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get promotion statistics
CREATE OR REPLACE FUNCTION get_promotion_statistics(
  p_promotion_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  promotion_id uuid,
  promotion_title varchar(255),
  total_delivered bigint,
  total_viewed bigint,
  total_claimed bigint,
  total_redeemed bigint,
  total_discount_amount numeric(10,2),
  view_rate numeric(5,2),
  claim_rate numeric(5,2),
  redemption_rate numeric(5,2),
  avg_discount numeric(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as promotion_id,
    p.title as promotion_title,
    COUNT(pd.id)::bigint as total_delivered,
    COUNT(pd.viewed_at)::bigint as total_viewed,
    COUNT(pd.claimed_at)::bigint as total_claimed,
    COUNT(pd.redeemed_at)::bigint as total_redeemed,
    COALESCE(SUM(pd.discount_amount), 0)::numeric(10,2) as total_discount_amount,
    ROUND((COUNT(pd.viewed_at)::numeric / NULLIF(COUNT(pd.id), 0) * 100)::numeric, 2) as view_rate,
    ROUND((COUNT(pd.claimed_at)::numeric / NULLIF(COUNT(pd.id), 0) * 100)::numeric, 2) as claim_rate,
    ROUND((COUNT(pd.redeemed_at)::numeric / NULLIF(COUNT(pd.id), 0) * 100)::numeric, 2) as redemption_rate,
    ROUND(AVG(pd.discount_amount)::numeric, 2) as avg_discount
  FROM promotions p
  LEFT JOIN promotion_deliveries pd ON pd.promotion_id = p.id
  WHERE
    (p_promotion_id IS NULL OR p.id = p_promotion_id)
    AND (p_start_date IS NULL OR p.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR p.created_at::date <= p_end_date)
  GROUP BY p.id, p.title
  ORDER BY total_redeemed DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to expire old promotion deliveries
CREATE OR REPLACE FUNCTION expire_old_promotion_deliveries()
RETURNS integer AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE promotion_deliveries pd
  SET
    expired = true,
    expired_at = now()
  FROM promotions p
  WHERE pd.promotion_id = p.id
    AND pd.expired = false
    AND pd.redeemed_at IS NULL
    AND p.end_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION get_eligible_promotions(uuid, numeric, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_promo_code(varchar, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_promotion(uuid, uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION get_promotion_statistics(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_old_promotion_deliveries() TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE promotions IS 'Stores promotional campaigns and special offers';
COMMENT ON TABLE promotion_deliveries IS 'Tracks promotion delivery and redemption per customer';

COMMENT ON FUNCTION get_eligible_promotions(uuid, numeric, varchar) IS 'Get list of promotions eligible for a customer';
COMMENT ON FUNCTION validate_promo_code(varchar, uuid, numeric) IS 'Validate a promo code and calculate discount';
COMMENT ON FUNCTION redeem_promotion(uuid, uuid, uuid, numeric) IS 'Redeem a promotion for a customer';
COMMENT ON FUNCTION get_promotion_statistics(uuid, date, date) IS 'Get statistics for promotions';
COMMENT ON FUNCTION expire_old_promotion_deliveries() IS 'Expire promotion deliveries for ended promotions';
