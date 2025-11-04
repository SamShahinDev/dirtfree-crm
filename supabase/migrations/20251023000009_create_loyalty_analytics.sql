-- Create loyalty analytics materialized view for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS loyalty_analytics_summary AS
SELECT
  -- Program Overview
  COUNT(DISTINCT cl.customer_id) as total_loyalty_customers,
  COUNT(DISTINCT CASE
    WHEN cl.updated_at > NOW() - INTERVAL '90 days'
    THEN cl.customer_id
  END) as active_customers_90d,
  COALESCE(AVG(cl.total_points), 0) as avg_points_balance,
  COALESCE(SUM(cl.total_points_earned), 0) as total_points_issued,
  COALESCE(SUM(cl.total_points_spent), 0) as total_points_redeemed,
  COALESCE(COUNT(lr.id), 0) as total_redemptions,

  -- Referral Performance
  COUNT(DISTINCT r.id) as total_referrals_sent,
  COUNT(DISTINCT CASE WHEN r.referee_customer_id IS NOT NULL THEN r.id END) as referrals_converted,
  COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.id END) as referrals_completed,

  -- Calculated Metrics
  CASE
    WHEN SUM(cl.total_points_earned) > 0
    THEN (SUM(cl.total_points_spent)::FLOAT / SUM(cl.total_points_earned)::FLOAT * 100)
    ELSE 0
  END as redemption_rate_pct,

  CURRENT_TIMESTAMP as last_updated

FROM customer_loyalty cl
LEFT JOIN loyalty_redemptions lr ON lr.customer_id = cl.customer_id
LEFT JOIN referrals r ON r.referrer_customer_id = cl.customer_id;

-- Create index for refresh performance
CREATE UNIQUE INDEX idx_loyalty_analytics_summary_singleton ON loyalty_analytics_summary ((1));

-- Function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_loyalty_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY loyalty_analytics_summary;
END;
$$ LANGUAGE plpgsql;

-- Create view for tier distribution
CREATE OR REPLACE VIEW loyalty_tier_distribution AS
SELECT
  lt.tier_name,
  lt.tier_level,
  COUNT(cl.customer_id) as customer_count,
  ROUND(COUNT(cl.customer_id)::NUMERIC / NULLIF(total_customers.total, 0) * 100, 2) as percentage
FROM loyalty_tiers lt
LEFT JOIN customer_loyalty cl ON cl.current_tier_id = lt.id
CROSS JOIN (
  SELECT COUNT(DISTINCT customer_id) as total FROM customer_loyalty
) total_customers
GROUP BY lt.id, lt.tier_name, lt.tier_level, total_customers.total
ORDER BY lt.tier_level;

-- Create view for earning activities breakdown
CREATE OR REPLACE VIEW loyalty_earning_activities AS
SELECT
  transaction_type,
  COUNT(*) as transaction_count,
  SUM(points_change) as total_points,
  AVG(points_change) as avg_points_per_transaction,
  MIN(created_at) as first_transaction,
  MAX(created_at) as last_transaction
FROM loyalty_history
WHERE points_change > 0
GROUP BY transaction_type
ORDER BY total_points DESC;

-- Create view for popular rewards
CREATE OR REPLACE VIEW loyalty_popular_rewards AS
SELECT
  lr.id as reward_id,
  lr.reward_name,
  lr.reward_type,
  lr.points_required,
  COUNT(red.id) as redemption_count,
  COUNT(CASE WHEN red.used THEN 1 END) as used_count,
  COUNT(CASE WHEN NOT red.used AND NOT red.voided THEN 1 END) as pending_count,
  SUM(red.points_spent) as total_points_spent,
  MIN(red.redeemed_at) as first_redemption,
  MAX(red.redeemed_at) as last_redemption
FROM loyalty_rewards lr
LEFT JOIN loyalty_redemptions red ON red.reward_id = lr.id
GROUP BY lr.id, lr.reward_name, lr.reward_type, lr.points_required
ORDER BY redemption_count DESC;

-- Create view for achievement unlock rates
CREATE OR REPLACE VIEW loyalty_achievement_stats AS
SELECT
  a.id as achievement_id,
  a.achievement_name,
  a.achievement_category,
  a.points_reward,
  COUNT(ca.customer_id) as unlock_count,
  ROUND(COUNT(ca.customer_id)::NUMERIC / NULLIF(total_customers.total, 0) * 100, 2) as unlock_rate_pct,
  MIN(ca.unlocked_at) as first_unlock,
  MAX(ca.unlocked_at) as last_unlock
FROM achievements a
LEFT JOIN customer_achievements ca ON ca.achievement_id = a.id
CROSS JOIN (
  SELECT COUNT(DISTINCT customer_id) as total FROM customer_loyalty
) total_customers
GROUP BY a.id, a.achievement_name, a.achievement_category, a.points_reward, total_customers.total
ORDER BY unlock_count DESC;

-- Create view for referral funnel
CREATE OR REPLACE VIEW loyalty_referral_funnel AS
SELECT
  COUNT(*) as total_referrals_sent,
  COUNT(CASE WHEN referee_customer_id IS NOT NULL THEN 1 END) as step_registered,
  COUNT(CASE WHEN status IN ('job_booked', 'job_completed', 'completed') THEN 1 END) as step_booked,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as step_completed,

  -- Conversion rates
  ROUND(
    COUNT(CASE WHEN referee_customer_id IS NOT NULL THEN 1 END)::NUMERIC /
    NULLIF(COUNT(*)::NUMERIC, 0) * 100,
    2
  ) as conversion_sent_to_registered_pct,

  ROUND(
    COUNT(CASE WHEN status IN ('job_booked', 'job_completed', 'completed') THEN 1 END)::NUMERIC /
    NULLIF(COUNT(CASE WHEN referee_customer_id IS NOT NULL THEN 1 END)::NUMERIC, 0) * 100,
    2
  ) as conversion_registered_to_booked_pct,

  ROUND(
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(CASE WHEN status IN ('job_booked', 'job_completed', 'completed') THEN 1 END)::NUMERIC, 0) * 100,
    2
  ) as conversion_booked_to_completed_pct

FROM referrals;

-- Create view for top referrers
CREATE OR REPLACE VIEW loyalty_top_referrers AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.email,
  COUNT(r.id) as total_referrals,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_referrals,
  SUM(CASE WHEN r.status = 'completed' THEN r.reward_points_awarded ELSE 0 END) as points_earned,
  cl.total_points as current_balance,
  lt.tier_name as current_tier
FROM customers c
INNER JOIN referrals r ON r.referrer_customer_id = c.id
LEFT JOIN customer_loyalty cl ON cl.customer_id = c.id
LEFT JOIN loyalty_tiers lt ON lt.id = cl.current_tier_id
GROUP BY c.id, c.name, c.email, cl.total_points, lt.tier_name
ORDER BY completed_referrals DESC, total_referrals DESC
LIMIT 50;

-- Create function to get points timeline data
CREATE OR REPLACE FUNCTION get_loyalty_points_timeline(
  days_back INTEGER DEFAULT 90
)
RETURNS TABLE(
  date DATE,
  points_earned INTEGER,
  points_spent INTEGER,
  net_points INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(lh.created_at) as date,
    SUM(CASE WHEN lh.points_change > 0 THEN lh.points_change ELSE 0 END)::INTEGER as points_earned,
    ABS(SUM(CASE WHEN lh.points_change < 0 THEN lh.points_change ELSE 0 END))::INTEGER as points_spent,
    SUM(lh.points_change)::INTEGER as net_points
  FROM loyalty_history lh
  WHERE lh.created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(lh.created_at)
  ORDER BY DATE(lh.created_at);
END;
$$ LANGUAGE plpgsql;

-- Create function to get revenue impact by tier
CREATE OR REPLACE FUNCTION get_loyalty_revenue_by_tier()
RETURNS TABLE(
  tier_name VARCHAR,
  tier_level INTEGER,
  customer_count BIGINT,
  total_revenue NUMERIC,
  avg_revenue_per_customer NUMERIC,
  total_jobs BIGINT,
  avg_jobs_per_customer NUMERIC,
  repeat_customer_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lt.tier_name,
    lt.tier_level,
    COUNT(DISTINCT cl.customer_id) as customer_count,
    COALESCE(SUM(j.total_amount), 0) as total_revenue,
    COALESCE(AVG(customer_revenue.revenue), 0) as avg_revenue_per_customer,
    COUNT(j.id) as total_jobs,
    ROUND(COUNT(j.id)::NUMERIC / NULLIF(COUNT(DISTINCT cl.customer_id), 0), 2) as avg_jobs_per_customer,
    ROUND(
      COUNT(DISTINCT CASE WHEN customer_jobs.job_count > 1 THEN cl.customer_id END)::NUMERIC /
      NULLIF(COUNT(DISTINCT cl.customer_id)::NUMERIC, 0) * 100,
      2
    ) as repeat_customer_rate
  FROM loyalty_tiers lt
  LEFT JOIN customer_loyalty cl ON cl.current_tier_id = lt.id
  LEFT JOIN jobs j ON j.customer_id = cl.customer_id AND j.status = 'completed'
  LEFT JOIN LATERAL (
    SELECT SUM(j2.total_amount) as revenue
    FROM jobs j2
    WHERE j2.customer_id = cl.customer_id AND j2.status = 'completed'
  ) customer_revenue ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as job_count
    FROM jobs j3
    WHERE j3.customer_id = cl.customer_id AND j3.status = 'completed'
  ) customer_jobs ON true
  GROUP BY lt.id, lt.tier_name, lt.tier_level
  ORDER BY lt.tier_level;
END;
$$ LANGUAGE plpgsql;

-- Create function to get loyalty vs non-loyalty comparison
CREATE OR REPLACE FUNCTION get_loyalty_vs_non_loyalty_comparison()
RETURNS TABLE(
  segment VARCHAR,
  customer_count BIGINT,
  total_revenue NUMERIC,
  avg_revenue_per_customer NUMERIC,
  total_jobs BIGINT,
  avg_jobs_per_customer NUMERIC,
  avg_job_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'Loyalty Members'::VARCHAR as segment,
    COUNT(DISTINCT cl.customer_id) as customer_count,
    COALESCE(SUM(j.total_amount), 0) as total_revenue,
    COALESCE(AVG(customer_revenue.revenue), 0) as avg_revenue_per_customer,
    COUNT(j.id) as total_jobs,
    ROUND(COUNT(j.id)::NUMERIC / NULLIF(COUNT(DISTINCT cl.customer_id), 0), 2) as avg_jobs_per_customer,
    COALESCE(AVG(j.total_amount), 0) as avg_job_value
  FROM customer_loyalty cl
  LEFT JOIN jobs j ON j.customer_id = cl.customer_id AND j.status = 'completed'
  LEFT JOIN LATERAL (
    SELECT SUM(j2.total_amount) as revenue
    FROM jobs j2
    WHERE j2.customer_id = cl.customer_id AND j2.status = 'completed'
  ) customer_revenue ON true

  UNION ALL

  SELECT
    'Non-Loyalty'::VARCHAR as segment,
    COUNT(DISTINCT c.id) as customer_count,
    COALESCE(SUM(j.total_amount), 0) as total_revenue,
    COALESCE(AVG(customer_revenue.revenue), 0) as avg_revenue_per_customer,
    COUNT(j.id) as total_jobs,
    ROUND(COUNT(j.id)::NUMERIC / NULLIF(COUNT(DISTINCT c.id), 0), 2) as avg_jobs_per_customer,
    COALESCE(AVG(j.total_amount), 0) as avg_job_value
  FROM customers c
  LEFT JOIN customer_loyalty cl ON cl.customer_id = c.id
  LEFT JOIN jobs j ON j.customer_id = c.id AND j.status = 'completed'
  LEFT JOIN LATERAL (
    SELECT SUM(j2.total_amount) as revenue
    FROM jobs j2
    WHERE j2.customer_id = c.id AND j2.status = 'completed'
  ) customer_revenue ON true
  WHERE cl.customer_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON MATERIALIZED VIEW loyalty_analytics_summary IS 'Pre-computed loyalty program statistics for dashboard performance';
COMMENT ON VIEW loyalty_tier_distribution IS 'Customer distribution across loyalty tiers';
COMMENT ON VIEW loyalty_earning_activities IS 'Breakdown of how customers earn points';
COMMENT ON VIEW loyalty_popular_rewards IS 'Most redeemed loyalty rewards';
COMMENT ON VIEW loyalty_achievement_stats IS 'Achievement unlock rates and statistics';
COMMENT ON VIEW loyalty_referral_funnel IS 'Referral program conversion funnel metrics';
COMMENT ON VIEW loyalty_top_referrers IS 'Top 50 customers by referral activity';
COMMENT ON FUNCTION get_loyalty_points_timeline IS 'Daily points earned/spent over specified period';
COMMENT ON FUNCTION get_loyalty_revenue_by_tier IS 'Revenue metrics broken down by loyalty tier';
COMMENT ON FUNCTION get_loyalty_vs_non_loyalty_comparison IS 'Comparison of loyalty members vs non-loyalty customers';

-- Initial refresh of materialized view
REFRESH MATERIALIZED VIEW loyalty_analytics_summary;
