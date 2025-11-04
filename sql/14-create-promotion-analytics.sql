-- =====================================================
-- Promotion Analytics Migration
-- =====================================================
-- Creates tables and functions for promotion analytics tracking
-- Provides comprehensive metrics and performance insights

-- Drop existing objects if they exist
DROP TABLE IF EXISTS promotion_analytics CASCADE;
DROP INDEX IF EXISTS idx_analytics_promotion;
DROP INDEX IF EXISTS idx_analytics_calculated;
DROP FUNCTION IF EXISTS calculate_promotion_analytics(uuid);
DROP FUNCTION IF EXISTS get_promotion_funnel_metrics(uuid);
DROP FUNCTION IF EXISTS get_promotion_time_metrics(uuid);
DROP FUNCTION IF EXISTS get_promotion_channel_performance(uuid);

-- =====================================================
-- Promotion Analytics Table
-- =====================================================
CREATE TABLE IF NOT EXISTS promotion_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE UNIQUE,

  -- Volume Metrics
  total_sent integer NOT NULL DEFAULT 0,
  total_delivered integer NOT NULL DEFAULT 0,
  total_viewed integer NOT NULL DEFAULT 0,
  total_claimed integer NOT NULL DEFAULT 0,
  total_redeemed integer NOT NULL DEFAULT 0,

  -- Financial Metrics
  total_revenue numeric(10,2) NOT NULL DEFAULT 0,
  total_discount_given numeric(10,2) NOT NULL DEFAULT 0,
  total_cost numeric(10,2) NOT NULL DEFAULT 0,

  -- Rate Metrics (percentages)
  delivery_rate numeric(5,2) NOT NULL DEFAULT 0,
  view_rate numeric(5,2) NOT NULL DEFAULT 0,
  claim_rate numeric(5,2) NOT NULL DEFAULT 0,
  redemption_rate numeric(5,2) NOT NULL DEFAULT 0,
  conversion_rate numeric(5,2) NOT NULL DEFAULT 0, -- sent to redeemed

  -- Time Metrics (in hours)
  avg_time_to_view numeric(8,2),
  avg_time_to_claim numeric(8,2),
  avg_time_to_redeem numeric(8,2),

  -- ROI Metrics
  roi_percentage numeric(8,2),
  cost_per_redemption numeric(8,2),
  revenue_per_redemption numeric(8,2),

  -- Channel Breakdown (JSONB)
  channel_metrics jsonb DEFAULT '{}'::jsonb,

  -- Temporal Data
  calculated_at timestamp NOT NULL DEFAULT NOW(),
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX idx_analytics_promotion ON promotion_analytics(promotion_id);
CREATE INDEX idx_analytics_calculated ON promotion_analytics(calculated_at DESC);

-- =====================================================
-- Updated At Trigger
-- =====================================================
CREATE TRIGGER set_updated_at_analytics
  BEFORE UPDATE ON promotion_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Calculate Promotion Analytics Function
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_promotion_analytics(p_promotion_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_stats record;
  v_time_metrics record;
  v_channel_metrics jsonb;
  v_result jsonb;
BEGIN
  -- Get basic statistics
  SELECT
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE delivered_at IS NOT NULL) as total_delivered,
    COUNT(*) FILTER (WHERE viewed_at IS NOT NULL) as total_viewed,
    COUNT(*) FILTER (WHERE claimed_at IS NOT NULL) as total_claimed,
    COUNT(*) FILTER (WHERE redeemed_at IS NOT NULL) as total_redeemed,
    COALESCE(SUM(discount_amount), 0) as total_discount,
    COALESCE(SUM(CASE WHEN redeemed_at IS NOT NULL THEN discount_amount * 3 ELSE 0 END), 0) as estimated_revenue
  INTO v_stats
  FROM promotion_deliveries
  WHERE promotion_id = p_promotion_id;

  -- Get time metrics (in hours)
  SELECT
    COALESCE(AVG(EXTRACT(EPOCH FROM (viewed_at - delivered_at)) / 3600), 0) as avg_time_to_view,
    COALESCE(AVG(EXTRACT(EPOCH FROM (claimed_at - delivered_at)) / 3600), 0) as avg_time_to_claim,
    COALESCE(AVG(EXTRACT(EPOCH FROM (redeemed_at - delivered_at)) / 3600), 0) as avg_time_to_redeem
  INTO v_time_metrics
  FROM promotion_deliveries
  WHERE promotion_id = p_promotion_id
    AND delivered_at IS NOT NULL;

  -- Get channel metrics
  SELECT jsonb_object_agg(
    delivery_channel,
    jsonb_build_object(
      'sent', COUNT(*),
      'delivered', COUNT(*) FILTER (WHERE delivered_at IS NOT NULL),
      'viewed', COUNT(*) FILTER (WHERE viewed_at IS NOT NULL),
      'claimed', COUNT(*) FILTER (WHERE claimed_at IS NOT NULL),
      'redeemed', COUNT(*) FILTER (WHERE redeemed_at IS NOT NULL),
      'discount', COALESCE(SUM(discount_amount), 0)
    )
  )
  INTO v_channel_metrics
  FROM promotion_deliveries
  WHERE promotion_id = p_promotion_id
  GROUP BY delivery_channel;

  -- Calculate rates
  v_result := jsonb_build_object(
    'total_sent', v_stats.total_sent,
    'total_delivered', v_stats.total_delivered,
    'total_viewed', v_stats.total_viewed,
    'total_claimed', v_stats.total_claimed,
    'total_redeemed', v_stats.total_redeemed,
    'total_discount_given', v_stats.total_discount,
    'total_revenue', v_stats.estimated_revenue,
    'total_cost', v_stats.total_sent * 0.05, -- Estimated cost per delivery
    'delivery_rate', CASE WHEN v_stats.total_sent > 0 THEN (v_stats.total_delivered::numeric / v_stats.total_sent * 100) ELSE 0 END,
    'view_rate', CASE WHEN v_stats.total_sent > 0 THEN (v_stats.total_viewed::numeric / v_stats.total_sent * 100) ELSE 0 END,
    'claim_rate', CASE WHEN v_stats.total_sent > 0 THEN (v_stats.total_claimed::numeric / v_stats.total_sent * 100) ELSE 0 END,
    'redemption_rate', CASE WHEN v_stats.total_claimed > 0 THEN (v_stats.total_redeemed::numeric / v_stats.total_claimed * 100) ELSE 0 END,
    'conversion_rate', CASE WHEN v_stats.total_sent > 0 THEN (v_stats.total_redeemed::numeric / v_stats.total_sent * 100) ELSE 0 END,
    'avg_time_to_view', v_time_metrics.avg_time_to_view,
    'avg_time_to_claim', v_time_metrics.avg_time_to_claim,
    'avg_time_to_redeem', v_time_metrics.avg_time_to_redeem,
    'roi_percentage', CASE WHEN v_stats.total_sent * 0.05 > 0 THEN ((v_stats.estimated_revenue - v_stats.total_discount - v_stats.total_sent * 0.05) / (v_stats.total_sent * 0.05) * 100) ELSE 0 END,
    'cost_per_redemption', CASE WHEN v_stats.total_redeemed > 0 THEN (v_stats.total_sent * 0.05 / v_stats.total_redeemed) ELSE 0 END,
    'revenue_per_redemption', CASE WHEN v_stats.total_redeemed > 0 THEN (v_stats.estimated_revenue / v_stats.total_redeemed) ELSE 0 END,
    'channel_metrics', COALESCE(v_channel_metrics, '{}'::jsonb)
  );

  -- Update or insert analytics record
  INSERT INTO promotion_analytics (
    promotion_id,
    total_sent,
    total_delivered,
    total_viewed,
    total_claimed,
    total_redeemed,
    total_revenue,
    total_discount_given,
    total_cost,
    delivery_rate,
    view_rate,
    claim_rate,
    redemption_rate,
    conversion_rate,
    avg_time_to_view,
    avg_time_to_claim,
    avg_time_to_redeem,
    roi_percentage,
    cost_per_redemption,
    revenue_per_redemption,
    channel_metrics,
    calculated_at
  )
  VALUES (
    p_promotion_id,
    (v_result->>'total_sent')::integer,
    (v_result->>'total_delivered')::integer,
    (v_result->>'total_viewed')::integer,
    (v_result->>'total_claimed')::integer,
    (v_result->>'total_redeemed')::integer,
    (v_result->>'total_revenue')::numeric,
    (v_result->>'total_discount_given')::numeric,
    (v_result->>'total_cost')::numeric,
    (v_result->>'delivery_rate')::numeric,
    (v_result->>'view_rate')::numeric,
    (v_result->>'claim_rate')::numeric,
    (v_result->>'redemption_rate')::numeric,
    (v_result->>'conversion_rate')::numeric,
    (v_result->>'avg_time_to_view')::numeric,
    (v_result->>'avg_time_to_claim')::numeric,
    (v_result->>'avg_time_to_redeem')::numeric,
    (v_result->>'roi_percentage')::numeric,
    (v_result->>'cost_per_redemption')::numeric,
    (v_result->>'revenue_per_redemption')::numeric,
    v_result->'channel_metrics',
    NOW()
  )
  ON CONFLICT (promotion_id) DO UPDATE SET
    total_sent = EXCLUDED.total_sent,
    total_delivered = EXCLUDED.total_delivered,
    total_viewed = EXCLUDED.total_viewed,
    total_claimed = EXCLUDED.total_claimed,
    total_redeemed = EXCLUDED.total_redeemed,
    total_revenue = EXCLUDED.total_revenue,
    total_discount_given = EXCLUDED.total_discount_given,
    total_cost = EXCLUDED.total_cost,
    delivery_rate = EXCLUDED.delivery_rate,
    view_rate = EXCLUDED.view_rate,
    claim_rate = EXCLUDED.claim_rate,
    redemption_rate = EXCLUDED.redemption_rate,
    conversion_rate = EXCLUDED.conversion_rate,
    avg_time_to_view = EXCLUDED.avg_time_to_view,
    avg_time_to_claim = EXCLUDED.avg_time_to_claim,
    avg_time_to_redeem = EXCLUDED.avg_time_to_redeem,
    roi_percentage = EXCLUDED.roi_percentage,
    cost_per_redemption = EXCLUDED.cost_per_redemption,
    revenue_per_redemption = EXCLUDED.revenue_per_redemption,
    channel_metrics = EXCLUDED.channel_metrics,
    calculated_at = NOW(),
    updated_at = NOW();

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Get Promotion Funnel Metrics
-- =====================================================
CREATE OR REPLACE FUNCTION get_promotion_funnel_metrics(p_promotion_id uuid)
RETURNS TABLE (
  stage text,
  count bigint,
  percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total_sent,
      COUNT(*) FILTER (WHERE viewed_at IS NOT NULL) as total_viewed,
      COUNT(*) FILTER (WHERE claimed_at IS NOT NULL) as total_claimed,
      COUNT(*) FILTER (WHERE redeemed_at IS NOT NULL) as total_redeemed
    FROM promotion_deliveries
    WHERE promotion_id = p_promotion_id
  )
  SELECT
    'Sent'::text as stage,
    stats.total_sent as count,
    100.0 as percentage
  FROM stats
  UNION ALL
  SELECT
    'Viewed'::text,
    stats.total_viewed,
    CASE WHEN stats.total_sent > 0 THEN (stats.total_viewed::numeric / stats.total_sent * 100) ELSE 0 END
  FROM stats
  UNION ALL
  SELECT
    'Claimed'::text,
    stats.total_claimed,
    CASE WHEN stats.total_sent > 0 THEN (stats.total_claimed::numeric / stats.total_sent * 100) ELSE 0 END
  FROM stats
  UNION ALL
  SELECT
    'Redeemed'::text,
    stats.total_redeemed,
    CASE WHEN stats.total_sent > 0 THEN (stats.total_redeemed::numeric / stats.total_sent * 100) ELSE 0 END
  FROM stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Get Time-to-Conversion Distribution
-- =====================================================
CREATE OR REPLACE FUNCTION get_promotion_time_distribution(p_promotion_id uuid)
RETURNS TABLE (
  time_bucket text,
  redemptions bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN hours_to_redeem < 1 THEN '< 1 hour'
      WHEN hours_to_redeem < 24 THEN '1-24 hours'
      WHEN hours_to_redeem < 72 THEN '1-3 days'
      WHEN hours_to_redeem < 168 THEN '3-7 days'
      WHEN hours_to_redeem < 336 THEN '1-2 weeks'
      ELSE '> 2 weeks'
    END as time_bucket,
    COUNT(*) as redemptions
  FROM (
    SELECT
      EXTRACT(EPOCH FROM (redeemed_at - delivered_at)) / 3600 as hours_to_redeem
    FROM promotion_deliveries
    WHERE promotion_id = p_promotion_id
      AND redeemed_at IS NOT NULL
      AND delivered_at IS NOT NULL
  ) sub
  GROUP BY time_bucket
  ORDER BY
    CASE time_bucket
      WHEN '< 1 hour' THEN 1
      WHEN '1-24 hours' THEN 2
      WHEN '1-3 days' THEN 3
      WHEN '3-7 days' THEN 4
      WHEN '1-2 weeks' THEN 5
      ELSE 6
    END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Get Delivery Timeline
-- =====================================================
CREATE OR REPLACE FUNCTION get_promotion_delivery_timeline(p_promotion_id uuid)
RETURNS TABLE (
  date date,
  sent bigint,
  viewed bigint,
  claimed bigint,
  redeemed bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    delivered_at::date as date,
    COUNT(*) as sent,
    COUNT(*) FILTER (WHERE viewed_at IS NOT NULL) as viewed,
    COUNT(*) FILTER (WHERE claimed_at IS NOT NULL) as claimed,
    COUNT(*) FILTER (WHERE redeemed_at IS NOT NULL) as redeemed
  FROM promotion_deliveries
  WHERE promotion_id = p_promotion_id
    AND delivered_at IS NOT NULL
  GROUP BY delivered_at::date
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE promotion_analytics ENABLE ROW LEVEL SECURITY;

-- Staff can view all analytics
CREATE POLICY "Staff can view analytics"
  ON promotion_analytics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Only system/service role can modify analytics
CREATE POLICY "Service role can manage analytics"
  ON promotion_analytics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE promotion_analytics IS 'Calculated analytics and performance metrics for promotions';
COMMENT ON FUNCTION calculate_promotion_analytics IS 'Calculates comprehensive analytics for a promotion';
COMMENT ON FUNCTION get_promotion_funnel_metrics IS 'Returns conversion funnel data for visualization';
COMMENT ON FUNCTION get_promotion_time_distribution IS 'Returns time-to-conversion distribution for histogram';
COMMENT ON FUNCTION get_promotion_delivery_timeline IS 'Returns daily timeline of delivery metrics';
