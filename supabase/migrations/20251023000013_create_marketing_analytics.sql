-- Create marketing analytics views and functions

-- Note: This migration assumes the existence of marketing campaign tracking tables
-- If these don't exist, they should be created first

-- 1. Marketing Campaign Performance View
CREATE OR REPLACE VIEW marketing_campaign_performance AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  c.type as campaign_type,
  c.channel,
  c.created_at as campaign_start,
  COUNT(DISTINCT cl.id) as total_sent,
  COUNT(DISTINCT CASE WHEN cl.opened_at IS NOT NULL THEN cl.id END) as total_opened,
  COUNT(DISTINCT CASE WHEN cl.clicked_at IS NOT NULL THEN cl.id END) as total_clicked,
  COUNT(DISTINCT CASE WHEN cl.converted_at IS NOT NULL THEN cl.id END) as total_converted,
  ROUND(
    COUNT(DISTINCT CASE WHEN cl.opened_at IS NOT NULL THEN cl.id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT cl.id)::NUMERIC, 0) * 100,
    2
  ) as open_rate_pct,
  ROUND(
    COUNT(DISTINCT CASE WHEN cl.clicked_at IS NOT NULL THEN cl.id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT CASE WHEN cl.opened_at IS NOT NULL THEN cl.id END)::NUMERIC, 0) * 100,
    2
  ) as click_through_rate_pct,
  ROUND(
    COUNT(DISTINCT CASE WHEN cl.converted_at IS NOT NULL THEN cl.id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT cl.id)::NUMERIC, 0) * 100,
    2
  ) as conversion_rate_pct,
  SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as revenue_generated,
  c.cost as campaign_cost,
  CASE
    WHEN c.cost > 0 THEN
      ROUND(
        (SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) - c.cost) / c.cost * 100,
        2
      )
    ELSE 0
  END as roi_pct,
  CASE
    WHEN COUNT(DISTINCT CASE WHEN cl.converted_at IS NOT NULL THEN cl.id END) > 0 THEN
      ROUND(c.cost / COUNT(DISTINCT CASE WHEN cl.converted_at IS NOT NULL THEN cl.id END), 2)
    ELSE 0
  END as cost_per_acquisition
FROM marketing_campaigns c
LEFT JOIN campaign_leads cl ON cl.campaign_id = c.id
LEFT JOIN jobs j ON j.id = cl.converted_job_id
LEFT JOIN invoices i ON i.job_id = j.id
GROUP BY c.id, c.name, c.type, c.channel, c.created_at, c.cost
ORDER BY c.created_at DESC;

-- 2. Channel Performance View
CREATE OR REPLACE VIEW marketing_channel_performance AS
SELECT
  channel,
  COUNT(DISTINCT id) as total_campaigns,
  SUM(total_sent) as total_sent,
  SUM(total_opened) as total_opened,
  SUM(total_clicked) as total_clicked,
  SUM(total_converted) as total_converted,
  ROUND(AVG(open_rate_pct), 2) as avg_open_rate_pct,
  ROUND(AVG(click_through_rate_pct), 2) as avg_click_through_rate_pct,
  ROUND(AVG(conversion_rate_pct), 2) as avg_conversion_rate_pct,
  SUM(revenue_generated) as total_revenue,
  SUM(campaign_cost) as total_cost,
  ROUND(
    (SUM(revenue_generated) - SUM(campaign_cost)) / NULLIF(SUM(campaign_cost), 0) * 100,
    2
  ) as avg_roi_pct
FROM marketing_campaign_performance
GROUP BY channel
ORDER BY total_revenue DESC;

-- 3. Promotion Effectiveness View (using existing promotions if available)
CREATE OR REPLACE VIEW promotion_effectiveness AS
SELECT
  p.id as promotion_id,
  p.title as promotion_name,
  p.discount_type,
  p.discount_value,
  p.start_date,
  p.end_date,
  p.active,
  COUNT(DISTINCT CASE WHEN j.promo_code = p.code THEN j.id END) as times_claimed,
  COUNT(DISTINCT CASE WHEN j.promo_code = p.code AND j.status = 'completed' THEN j.id END) as times_redeemed,
  ROUND(
    COUNT(DISTINCT CASE WHEN j.promo_code = p.code AND j.status = 'completed' THEN j.id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT CASE WHEN j.promo_code = p.code THEN j.id END)::NUMERIC, 0) * 100,
    2
  ) as redemption_rate_pct,
  SUM(CASE WHEN j.promo_code = p.code AND i.status = 'paid' THEN i.total_amount ELSE 0 END) as revenue_generated,
  SUM(CASE WHEN j.promo_code = p.code AND i.status = 'paid' THEN i.discount_amount ELSE 0 END) as total_discount_given,
  SUM(CASE WHEN j.promo_code = p.code AND i.status = 'paid' THEN i.total_amount ELSE 0 END) -
  SUM(CASE WHEN j.promo_code = p.code AND i.status = 'paid' THEN i.discount_amount ELSE 0 END) as net_revenue
FROM promotions p
LEFT JOIN jobs j ON j.promo_code = p.code
LEFT JOIN invoices i ON i.job_id = j.id
GROUP BY p.id, p.title, p.discount_type, p.discount_value, p.start_date, p.end_date, p.active
ORDER BY revenue_generated DESC;

-- 4. Customer Acquisition Attribution View
CREATE OR REPLACE VIEW customer_acquisition_attribution AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.acquisition_source as first_touch_source,
  c.created_at as customer_since,
  first_job.job_id as first_job_id,
  first_job.booking_source as first_job_source,
  first_job.promo_code as first_promo_used,
  latest_job.job_id as latest_job_id,
  latest_job.booking_source as last_touch_source,
  latest_job.promo_code as last_promo_used,
  customer_value.total_jobs,
  customer_value.total_revenue,
  customer_value.avg_job_value
FROM customers c
LEFT JOIN LATERAL (
  SELECT
    j.id as job_id,
    j.booking_source,
    j.promo_code,
    j.scheduled_date
  FROM jobs j
  WHERE j.customer_id = c.id
  ORDER BY j.scheduled_date ASC
  LIMIT 1
) first_job ON true
LEFT JOIN LATERAL (
  SELECT
    j.id as job_id,
    j.booking_source,
    j.promo_code,
    j.scheduled_date
  FROM jobs j
  WHERE j.customer_id = c.id
  ORDER BY j.scheduled_date DESC
  LIMIT 1
) latest_job ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(j.id) as total_jobs,
    SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as total_revenue,
    AVG(CASE WHEN i.status = 'paid' THEN i.total_amount END) as avg_job_value
  FROM jobs j
  LEFT JOIN invoices i ON i.job_id = j.id
  WHERE j.customer_id = c.id
) customer_value ON true;

-- 5. Email/SMS Performance Tracking View
CREATE OR REPLACE VIEW communication_performance AS
SELECT
  cm.type as communication_type,
  cm.template_name,
  COUNT(cm.id) as total_sent,
  COUNT(CASE WHEN cm.opened_at IS NOT NULL THEN 1 END) as total_opened,
  COUNT(CASE WHEN cm.clicked_at IS NOT NULL THEN 1 END) as total_clicked,
  COUNT(CASE WHEN cm.responded_at IS NOT NULL THEN 1 END) as total_responded,
  ROUND(
    COUNT(CASE WHEN cm.opened_at IS NOT NULL THEN 1 END)::NUMERIC /
    NULLIF(COUNT(cm.id)::NUMERIC, 0) * 100,
    2
  ) as open_rate_pct,
  ROUND(
    COUNT(CASE WHEN cm.clicked_at IS NOT NULL THEN 1 END)::NUMERIC /
    NULLIF(COUNT(CASE WHEN cm.opened_at IS NOT NULL THEN 1 END)::NUMERIC, 0) * 100,
    2
  ) as click_rate_pct,
  ROUND(
    COUNT(CASE WHEN cm.responded_at IS NOT NULL THEN 1 END)::NUMERIC /
    NULLIF(COUNT(cm.id)::NUMERIC, 0) * 100,
    2
  ) as response_rate_pct,
  AVG(EXTRACT(EPOCH FROM (cm.opened_at - cm.sent_at)) / 3600) as avg_hours_to_open,
  MAX(cm.sent_at) as last_sent_date
FROM communications cm
WHERE cm.sent_at IS NOT NULL
GROUP BY cm.type, cm.template_name
ORDER BY total_sent DESC;

-- 6. Portal Engagement Metrics View
CREATE OR REPLACE VIEW portal_engagement_metrics AS
SELECT
  DATE_TRUNC('week', activity_date)::DATE as week,
  COUNT(DISTINCT customer_id) as unique_visitors,
  COUNT(*) as total_pageviews,
  COUNT(DISTINCT CASE WHEN activity_type = 'booking' THEN customer_id END) as customers_who_booked,
  COUNT(DISTINCT CASE WHEN activity_type = 'promotion_view' THEN customer_id END) as promotion_views,
  COUNT(DISTINCT CASE WHEN activity_type = 'promotion_claim' THEN customer_id END) as promotion_claims,
  ROUND(
    COUNT(DISTINCT CASE WHEN activity_type = 'booking' THEN customer_id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT customer_id)::NUMERIC, 0) * 100,
    2
  ) as booking_conversion_rate_pct,
  ROUND(AVG(session_duration_seconds) / 60, 2) as avg_session_duration_mins
FROM portal_activities
GROUP BY DATE_TRUNC('week', activity_date)::DATE
ORDER BY week DESC;

-- Function to calculate attribution revenue
CREATE OR REPLACE FUNCTION get_attribution_revenue(
  attribution_model VARCHAR DEFAULT 'last_touch' -- 'first_touch', 'last_touch', 'linear'
)
RETURNS TABLE(
  source VARCHAR,
  customer_count BIGINT,
  total_revenue NUMERIC,
  avg_revenue_per_customer NUMERIC
) AS $$
BEGIN
  IF attribution_model = 'first_touch' THEN
    RETURN QUERY
    SELECT
      COALESCE(caa.first_touch_source, 'Unknown')::VARCHAR as source,
      COUNT(DISTINCT caa.customer_id) as customer_count,
      SUM(caa.total_revenue) as total_revenue,
      AVG(caa.total_revenue) as avg_revenue_per_customer
    FROM customer_acquisition_attribution caa
    GROUP BY COALESCE(caa.first_touch_source, 'Unknown')
    ORDER BY total_revenue DESC;

  ELSIF attribution_model = 'last_touch' THEN
    RETURN QUERY
    SELECT
      COALESCE(caa.last_touch_source, 'Unknown')::VARCHAR as source,
      COUNT(DISTINCT caa.customer_id) as customer_count,
      SUM(caa.total_revenue) as total_revenue,
      AVG(caa.total_revenue) as avg_revenue_per_customer
    FROM customer_acquisition_attribution caa
    GROUP BY COALESCE(caa.last_touch_source, 'Unknown')
    ORDER BY total_revenue DESC;

  ELSE -- linear attribution (split credit)
    RETURN QUERY
    SELECT
      source::VARCHAR,
      SUM(customer_count)::BIGINT as customer_count,
      SUM(attributed_revenue) as total_revenue,
      AVG(attributed_revenue) as avg_revenue_per_customer
    FROM (
      SELECT
        COALESCE(caa.first_touch_source, 'Unknown') as source,
        COUNT(DISTINCT caa.customer_id) as customer_count,
        SUM(caa.total_revenue * 0.5) as attributed_revenue
      FROM customer_acquisition_attribution caa
      GROUP BY COALESCE(caa.first_touch_source, 'Unknown')

      UNION ALL

      SELECT
        COALESCE(caa.last_touch_source, 'Unknown') as source,
        COUNT(DISTINCT caa.customer_id) as customer_count,
        SUM(caa.total_revenue * 0.5) as attributed_revenue
      FROM customer_acquisition_attribution caa
      GROUP BY COALESCE(caa.last_touch_source, 'Unknown')
    ) split_attribution
    GROUP BY source
    ORDER BY total_revenue DESC;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get campaign performance over time
CREATE OR REPLACE FUNCTION get_campaign_performance_trend(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(
  campaign_id UUID,
  campaign_name VARCHAR,
  channel VARCHAR,
  total_sent BIGINT,
  total_converted BIGINT,
  conversion_rate NUMERIC,
  revenue NUMERIC,
  roi NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mcp.campaign_id,
    mcp.campaign_name,
    mcp.channel,
    mcp.total_sent,
    mcp.total_converted,
    mcp.conversion_rate_pct,
    mcp.revenue_generated,
    mcp.roi_pct
  FROM marketing_campaign_performance mcp
  WHERE mcp.campaign_start >= start_date
    AND mcp.campaign_start <= end_date
  ORDER BY mcp.revenue_generated DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to identify top performing content
CREATE OR REPLACE FUNCTION get_top_performing_content(
  content_type VARCHAR DEFAULT NULL,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
  type VARCHAR,
  template_name VARCHAR,
  total_sent BIGINT,
  open_rate NUMERIC,
  click_rate NUMERIC,
  response_rate NUMERIC,
  performance_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.communication_type,
    cp.template_name,
    cp.total_sent,
    cp.open_rate_pct,
    cp.click_rate_pct,
    cp.response_rate_pct,
    -- Performance score: weighted average of engagement metrics
    ROUND(
      (COALESCE(cp.open_rate_pct, 0) * 0.3) +
      (COALESCE(cp.click_rate_pct, 0) * 0.4) +
      (COALESCE(cp.response_rate_pct, 0) * 0.3),
      2
    ) as performance_score
  FROM communication_performance cp
  WHERE (content_type IS NULL OR cp.communication_type = content_type)
    AND cp.total_sent >= 10
  ORDER BY performance_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate customer channel preferences
CREATE OR REPLACE FUNCTION get_customer_channel_preferences()
RETURNS TABLE(
  channel VARCHAR,
  customers_reached BIGINT,
  total_interactions BIGINT,
  avg_engagement_rate NUMERIC,
  preferred_by_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.type as channel,
    COUNT(DISTINCT cm.customer_id) as customers_reached,
    COUNT(cm.id) as total_interactions,
    ROUND(
      COUNT(CASE WHEN cm.opened_at IS NOT NULL OR cm.responded_at IS NOT NULL THEN 1 END)::NUMERIC /
      NULLIF(COUNT(cm.id)::NUMERIC, 0) * 100,
      2
    ) as avg_engagement_rate,
    COUNT(DISTINCT CASE
      WHEN customer_prefs.preferred_channel = cm.type THEN cm.customer_id
    END) as preferred_by_count
  FROM communications cm
  LEFT JOIN LATERAL (
    SELECT
      c.id,
      c.preferred_contact_method as preferred_channel
    FROM customers c
    WHERE c.id = cm.customer_id
  ) customer_prefs ON true
  GROUP BY cm.type
  ORDER BY avg_engagement_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Create helper tables if they don't exist (for tracking campaigns and communications)
-- Note: These tables should be created if not already present in the system

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- 'promotion', 'email_blast', 'sms_campaign', etc.
  channel VARCHAR(50), -- 'email', 'sms', 'portal', 'phone'
  cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES marketing_campaigns(id),
  customer_id UUID REFERENCES customers(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE,
  converted_job_id UUID REFERENCES jobs(id)
);

CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  type VARCHAR(50), -- 'email', 'sms', 'portal_notification', 'phone'
  template_name VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS portal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  activity_type VARCHAR(50), -- 'booking', 'promotion_view', 'promotion_claim', 'pageview'
  activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_duration_seconds INTEGER
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_customer ON campaign_leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_converted ON campaign_leads(converted_at);
CREATE INDEX IF NOT EXISTS idx_communications_customer ON communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_communications_type ON communications(type);
CREATE INDEX IF NOT EXISTS idx_communications_sent ON communications(sent_at);
CREATE INDEX IF NOT EXISTS idx_portal_activities_customer ON portal_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_activities_date ON portal_activities(activity_date);

-- Add comments
COMMENT ON VIEW marketing_campaign_performance IS 'Campaign performance metrics with ROI and conversion tracking';
COMMENT ON VIEW marketing_channel_performance IS 'Channel-level marketing effectiveness comparison';
COMMENT ON VIEW promotion_effectiveness IS 'Promotion claim and redemption rates with revenue impact';
COMMENT ON VIEW customer_acquisition_attribution IS 'First-touch and last-touch attribution for customers';
COMMENT ON VIEW communication_performance IS 'Email/SMS/notification engagement metrics by template';
COMMENT ON VIEW portal_engagement_metrics IS 'Portal activity and conversion metrics';
COMMENT ON FUNCTION get_attribution_revenue IS 'Calculate revenue attribution using different models';
COMMENT ON FUNCTION get_campaign_performance_trend IS 'Campaign performance metrics for date range';
COMMENT ON FUNCTION get_top_performing_content IS 'Identify best performing message templates';
COMMENT ON FUNCTION get_customer_channel_preferences IS 'Customer engagement and channel preference analysis';
