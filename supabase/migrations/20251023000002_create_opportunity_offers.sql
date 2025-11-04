-- Opportunity Offers Table
-- Tracks automated re-engagement offers sent to customers

CREATE TABLE opportunity_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES missed_opportunities(id) ON DELETE CASCADE,

  -- Offer details
  offer_percentage DECIMAL(5,2) NOT NULL,
  offer_code VARCHAR(50) UNIQUE NOT NULL,
  offer_expires_at TIMESTAMP NOT NULL,

  -- Services covered by offer
  applicable_services VARCHAR(100)[],

  -- Delivery tracking
  delivered_at TIMESTAMP,
  delivery_method VARCHAR(20), -- 'email', 'sms', 'portal', 'all'

  -- Engagement tracking
  viewed_at TIMESTAMP,
  claimed_at TIMESTAMP,
  redeemed_at TIMESTAMP,
  redeemed_job_id UUID REFERENCES jobs(id),

  -- Escalation tracking
  escalation_level INTEGER DEFAULT 1, -- 1 = first offer, 2 = second offer (higher discount)
  previous_offer_id UUID REFERENCES opportunity_offers(id),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Indexes
CREATE INDEX idx_opportunity_offers_opportunity ON opportunity_offers(opportunity_id);
CREATE INDEX idx_opportunity_offers_code ON opportunity_offers(offer_code);
CREATE INDEX idx_opportunity_offers_delivered ON opportunity_offers(delivered_at);
CREATE INDEX idx_opportunity_offers_expires ON opportunity_offers(offer_expires_at);
CREATE INDEX idx_opportunity_offers_claimed ON opportunity_offers(claimed_at) WHERE claimed_at IS NOT NULL;
CREATE INDEX idx_opportunity_offers_redeemed ON opportunity_offers(redeemed_at) WHERE redeemed_at IS NOT NULL;

-- Add foreign key to missed_opportunities for easy reference
ALTER TABLE missed_opportunities ADD COLUMN IF NOT EXISTS latest_offer_id UUID REFERENCES opportunity_offers(id);

-- Function to get opportunities ready for offers
CREATE OR REPLACE FUNCTION get_opportunities_ready_for_offers()
RETURNS TABLE (
  opportunity_id UUID,
  customer_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  opportunity_type VARCHAR(30),
  declined_services VARCHAR(100)[],
  estimated_value NUMERIC,
  reason TEXT,
  created_at TIMESTAMP,
  days_since_created INT,
  has_pending_offer BOOLEAN,
  escalation_level INT
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_offers AS (
    SELECT
      oo.opportunity_id,
      MAX(oo.escalation_level) as max_escalation,
      MAX(oo.delivered_at) as last_delivered,
      BOOL_OR(oo.claimed_at IS NOT NULL) as has_claim,
      BOOL_OR(oo.redeemed_at IS NOT NULL) as has_redemption
    FROM opportunity_offers oo
    GROUP BY oo.opportunity_id
  )
  SELECT
    mo.id as opportunity_id,
    mo.customer_id,
    c.full_name as customer_name,
    c.email as customer_email,
    c.phone as customer_phone,
    mo.opportunity_type,
    mo.declined_services,
    mo.estimated_value,
    mo.reason,
    mo.created_at,
    EXTRACT(DAY FROM NOW() - mo.created_at)::INT as days_since_created,
    (lo.opportunity_id IS NOT NULL AND lo.last_delivered > NOW() - INTERVAL '30 days') as has_pending_offer,
    COALESCE(lo.max_escalation, 0) as escalation_level
  FROM missed_opportunities mo
  JOIN customers c ON c.id = mo.customer_id
  LEFT JOIN latest_offers lo ON lo.opportunity_id = mo.id
  WHERE mo.status IN ('pending', 'offer_scheduled', 'follow_up_scheduled')
    AND mo.converted = false
    AND mo.created_at > NOW() - INTERVAL '90 days' -- Don't process very old opportunities
    AND (
      -- No offer sent yet, OR
      lo.opportunity_id IS NULL OR
      -- Last offer was delivered >14 days ago and not claimed/redeemed
      (lo.last_delivered < NOW() - INTERVAL '14 days' AND NOT lo.has_claim AND NOT lo.has_redemption)
    );
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE opportunity_offers IS 'Tracks automated re-engagement offers for missed opportunities';
COMMENT ON FUNCTION get_opportunities_ready_for_offers IS 'Returns opportunities that are ready to receive automated offers based on timing rules';
