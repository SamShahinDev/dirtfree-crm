-- Opportunities Database Schema
-- Tracks missed opportunities, upsells, and follow-up automation

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Missed Opportunities Table
-- Tracks all opportunities for service additions, upsells, and recovery
CREATE TABLE missed_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  opportunity_type VARCHAR(30) NOT NULL,
    -- 'declined_service', 'partial_booking', 'price_objection',
    -- 'postponed_booking', 'competitor_mention', 'service_upsell'

  -- Context
  original_job_id UUID REFERENCES jobs(id),
  declined_services VARCHAR(100)[],
  estimated_value DECIMAL(10,2),
  reason TEXT,

  -- Follow-up
  follow_up_scheduled_date DATE,
  follow_up_method VARCHAR(20), -- 'call', 'email', 'sms', 'portal_offer'
  follow_up_assigned_to UUID REFERENCES users(id),

  -- Offer/promotion
  auto_offer_enabled BOOLEAN DEFAULT false,
  offer_discount_percentage DECIMAL(5,2),
  offer_sent_at TIMESTAMP,
  offer_viewed_at TIMESTAMP,
  offer_claimed_at TIMESTAMP,

  -- Conversion
  status VARCHAR(20) DEFAULT 'pending',
    -- pending, offer_scheduled, offer_sent, follow_up_scheduled,
    -- contacted, converted, declined, expired
  converted BOOLEAN DEFAULT false,
  conversion_date TIMESTAMP,
  conversion_job_id UUID REFERENCES jobs(id),
  conversion_value DECIMAL(10,2),

  notes TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_opportunities_customer ON missed_opportunities(customer_id);
CREATE INDEX idx_opportunities_status ON missed_opportunities(status);
CREATE INDEX idx_opportunities_type ON missed_opportunities(opportunity_type);
CREATE INDEX idx_opportunities_followup ON missed_opportunities(follow_up_scheduled_date)
  WHERE status IN ('pending', 'offer_scheduled', 'follow_up_scheduled');
CREATE INDEX idx_opportunities_converted ON missed_opportunities(converted, conversion_date);

-- Opportunity Interactions Table
-- Tracks all interactions with opportunities (audit trail)
CREATE TABLE opportunity_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES missed_opportunities(id) ON DELETE CASCADE,
  interaction_type VARCHAR(30) NOT NULL,
    -- 'offer_sent', 'offer_viewed', 'offer_claimed', 'reminder_sent',
    -- 'customer_declined', 'manual_follow_up', 'converted'
  interaction_method VARCHAR(20), -- 'portal', 'email', 'sms', 'phone'
  performed_by_user_id UUID REFERENCES users(id),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for tracking opportunity history
CREATE INDEX idx_opportunity_interactions ON opportunity_interactions(opportunity_id, created_at);
CREATE INDEX idx_opportunity_interactions_type ON opportunity_interactions(interaction_type);

-- Updated_at trigger for missed_opportunities
CREATE OR REPLACE FUNCTION update_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_opportunities_updated_at
  BEFORE UPDATE ON missed_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

-- Helper function to get opportunity statistics
CREATE OR REPLACE FUNCTION get_opportunity_stats(days_back INT DEFAULT 30)
RETURNS TABLE (
  total_opportunities BIGINT,
  total_value NUMERIC,
  converted_count BIGINT,
  converted_value NUMERIC,
  conversion_rate NUMERIC,
  pending_count BIGINT,
  pending_value NUMERIC,
  by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total_opps,
      COALESCE(SUM(estimated_value), 0) as total_val,
      COUNT(*) FILTER (WHERE converted = true) as conv_count,
      COALESCE(SUM(conversion_value), 0) as conv_val,
      COUNT(*) FILTER (WHERE status IN ('pending', 'offer_scheduled', 'follow_up_scheduled')) as pend_count,
      COALESCE(SUM(estimated_value) FILTER (WHERE status IN ('pending', 'offer_scheduled', 'follow_up_scheduled')), 0) as pend_val
    FROM missed_opportunities
    WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
  ),
  type_breakdown AS (
    SELECT jsonb_object_agg(
      opportunity_type,
      jsonb_build_object(
        'count', COUNT(*),
        'value', COALESCE(SUM(estimated_value), 0),
        'converted', COUNT(*) FILTER (WHERE converted = true)
      )
    ) as type_stats
    FROM missed_opportunities
    WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
    GROUP BY opportunity_type
  )
  SELECT
    s.total_opps,
    s.total_val,
    s.conv_count,
    s.conv_val,
    CASE
      WHEN s.total_opps > 0 THEN ROUND((s.conv_count::NUMERIC / s.total_opps::NUMERIC) * 100, 2)
      ELSE 0
    END as conv_rate,
    s.pend_count,
    s.pend_val,
    COALESCE(t.type_stats, '{}'::JSONB)
  FROM stats s
  CROSS JOIN type_breakdown t;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get pending follow-ups
CREATE OR REPLACE FUNCTION get_pending_followups(days_ahead INT DEFAULT 7)
RETURNS TABLE (
  opportunity_id UUID,
  customer_id UUID,
  customer_name TEXT,
  opportunity_type VARCHAR(30),
  estimated_value NUMERIC,
  follow_up_date DATE,
  follow_up_method VARCHAR(20),
  assigned_to UUID,
  assigned_to_name TEXT,
  days_until_followup INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mo.id,
    mo.customer_id,
    c.full_name,
    mo.opportunity_type,
    mo.estimated_value,
    mo.follow_up_scheduled_date,
    mo.follow_up_method,
    mo.follow_up_assigned_to,
    u.full_name as assigned_name,
    (mo.follow_up_scheduled_date - CURRENT_DATE)::INT as days_until
  FROM missed_opportunities mo
  JOIN customers c ON c.id = mo.customer_id
  LEFT JOIN users u ON u.id = mo.follow_up_assigned_to
  WHERE mo.status IN ('pending', 'offer_scheduled', 'follow_up_scheduled')
    AND mo.follow_up_scheduled_date <= CURRENT_DATE + days_ahead
    AND mo.follow_up_scheduled_date >= CURRENT_DATE
  ORDER BY mo.follow_up_scheduled_date ASC, mo.estimated_value DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE missed_opportunities IS 'Tracks missed sales opportunities, upsells, and service additions for follow-up and conversion';
COMMENT ON TABLE opportunity_interactions IS 'Audit trail of all interactions with opportunities';
COMMENT ON FUNCTION get_opportunity_stats IS 'Returns aggregated statistics for opportunities over a specified time period';
COMMENT ON FUNCTION get_pending_followups IS 'Returns upcoming follow-ups that need attention';
