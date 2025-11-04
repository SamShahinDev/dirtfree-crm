-- Create revenue analytics views and functions

-- 1. Daily Revenue Analytics View
CREATE OR REPLACE VIEW revenue_analytics_daily AS
SELECT
  DATE_TRUNC('day', i.paid_date) as date,
  SUM(i.total_amount) as total_revenue,
  COUNT(DISTINCT i.customer_id) as unique_customers,
  COUNT(i.id) as total_invoices,
  AVG(i.total_amount) as avg_invoice_value,
  SUM(CASE WHEN j.booking_source = 'portal' THEN i.total_amount ELSE 0 END) as portal_revenue,
  SUM(CASE WHEN j.booking_source != 'portal' OR j.booking_source IS NULL THEN i.total_amount ELSE 0 END) as phone_revenue,
  SUM(CASE WHEN customer_jobs.job_count > 1 THEN i.total_amount ELSE 0 END) as repeat_customer_revenue,
  SUM(CASE WHEN customer_jobs.job_count = 1 THEN i.total_amount ELSE 0 END) as new_customer_revenue,
  SUM(CASE WHEN j.referred_by_customer_id IS NOT NULL THEN i.total_amount ELSE 0 END) as referral_revenue
FROM invoices i
LEFT JOIN jobs j ON j.id = i.job_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) as job_count
  FROM jobs j2
  WHERE j2.customer_id = i.customer_id
    AND j2.status = 'completed'
    AND j2.completed_at <= i.paid_date
) customer_jobs ON true
WHERE i.status = 'paid' AND i.paid_date IS NOT NULL
GROUP BY DATE_TRUNC('day', i.paid_date)
ORDER BY date DESC;

-- 2. Revenue by Service Type
CREATE OR REPLACE VIEW revenue_by_service AS
SELECT
  js.service_type,
  COUNT(DISTINCT j.id) as job_count,
  COUNT(DISTINCT j.customer_id) as unique_customers,
  SUM(i.total_amount) as total_revenue,
  AVG(i.total_amount) as avg_revenue_per_job,
  SUM(i.total_amount - COALESCE(j.total_cost, 0)) as total_profit,
  CASE
    WHEN SUM(i.total_amount) > 0
    THEN ROUND((SUM(i.total_amount - COALESCE(j.total_cost, 0)) / SUM(i.total_amount)) * 100, 2)
    ELSE 0
  END as profit_margin_pct,
  MIN(i.paid_date) as first_sale,
  MAX(i.paid_date) as last_sale
FROM job_services js
INNER JOIN jobs j ON j.id = js.job_id
INNER JOIN invoices i ON i.job_id = j.id
WHERE i.status = 'paid' AND i.paid_date IS NOT NULL
GROUP BY js.service_type
ORDER BY total_revenue DESC;

-- 3. Revenue by Zone
CREATE OR REPLACE VIEW revenue_by_zone AS
SELECT
  j.service_zone_id,
  sz.zone_name,
  COUNT(DISTINCT j.id) as job_count,
  COUNT(DISTINCT j.customer_id) as unique_customers,
  SUM(i.total_amount) as total_revenue,
  AVG(i.total_amount) as avg_revenue_per_job,
  MIN(i.paid_date) as first_sale,
  MAX(i.paid_date) as last_sale
FROM jobs j
INNER JOIN invoices i ON i.job_id = j.id
LEFT JOIN service_zones sz ON sz.id = j.service_zone_id
WHERE i.status = 'paid' AND i.paid_date IS NOT NULL
GROUP BY j.service_zone_id, sz.zone_name
ORDER BY total_revenue DESC;

-- 4. Payment Method Analytics
CREATE OR REPLACE VIEW payment_method_analytics AS
SELECT
  i.payment_method,
  COUNT(i.id) as transaction_count,
  SUM(i.total_amount) as total_revenue,
  AVG(i.total_amount) as avg_transaction_value,
  ROUND(
    COUNT(i.id)::NUMERIC / NULLIF(total_payments.total, 0) * 100,
    2
  ) as percentage_of_transactions,
  ROUND(
    SUM(i.total_amount)::NUMERIC / NULLIF(total_payments.total_revenue, 0) * 100,
    2
  ) as percentage_of_revenue,
  AVG(EXTRACT(EPOCH FROM (i.paid_date - i.created_at)) / 86400) as avg_days_to_payment
FROM invoices i
CROSS JOIN (
  SELECT
    COUNT(*) as total,
    SUM(total_amount) as total_revenue
  FROM invoices
  WHERE status = 'paid' AND paid_date IS NOT NULL
) total_payments
WHERE i.status = 'paid' AND i.paid_date IS NOT NULL
GROUP BY i.payment_method, total_payments.total, total_payments.total_revenue
ORDER BY total_revenue DESC;

-- 5. Customer Lifetime Value by Tier
CREATE OR REPLACE VIEW customer_ltv_by_tier AS
SELECT
  COALESCE(lt.tier_name, 'No Tier') as tier_name,
  COALESCE(lt.tier_level, 0) as tier_level,
  COUNT(DISTINCT c.id) as customer_count,
  AVG(customer_revenue.total_revenue) as avg_lifetime_value,
  AVG(customer_revenue.job_count) as avg_jobs_per_customer,
  AVG(customer_revenue.avg_order_value) as avg_order_value,
  ROUND(
    COUNT(DISTINCT CASE WHEN customer_revenue.job_count > 1 THEN c.id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT c.id)::NUMERIC, 0) * 100,
    2
  ) as repeat_purchase_rate_pct
FROM customers c
LEFT JOIN customer_loyalty cl ON cl.customer_id = c.id
LEFT JOIN loyalty_tiers lt ON lt.id = cl.current_tier_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(j.id) as job_count,
    SUM(i.total_amount) as total_revenue,
    AVG(i.total_amount) as avg_order_value
  FROM jobs j
  INNER JOIN invoices i ON i.job_id = j.id
  WHERE j.customer_id = c.id
    AND i.status = 'paid'
    AND i.paid_date IS NOT NULL
) customer_revenue ON true
WHERE customer_revenue.total_revenue IS NOT NULL
GROUP BY COALESCE(lt.tier_name, 'No Tier'), COALESCE(lt.tier_level, 0)
ORDER BY tier_level;

-- 6. Outstanding and Overdue Invoices Summary
CREATE OR REPLACE VIEW outstanding_invoices_summary AS
SELECT
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as outstanding_count,
  SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END) as outstanding_total,
  COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
  SUM(CASE WHEN status = 'overdue' THEN total_amount ELSE 0 END) as overdue_total,
  AVG(CASE WHEN status IN ('sent', 'overdue') THEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 END) as avg_days_outstanding
FROM invoices;

-- Function to get revenue analytics for a date range
CREATE OR REPLACE FUNCTION get_revenue_analytics(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  group_by TEXT DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS TABLE(
  period TIMESTAMP WITH TIME ZONE,
  total_revenue NUMERIC,
  unique_customers BIGINT,
  total_invoices BIGINT,
  avg_invoice_value NUMERIC,
  portal_revenue NUMERIC,
  phone_revenue NUMERIC,
  repeat_customer_revenue NUMERIC,
  new_customer_revenue NUMERIC,
  referral_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(group_by, i.paid_date) as period,
    SUM(i.total_amount) as total_revenue,
    COUNT(DISTINCT i.customer_id) as unique_customers,
    COUNT(i.id) as total_invoices,
    AVG(i.total_amount) as avg_invoice_value,
    SUM(CASE WHEN j.booking_source = 'portal' THEN i.total_amount ELSE 0 END) as portal_revenue,
    SUM(CASE WHEN j.booking_source != 'portal' OR j.booking_source IS NULL THEN i.total_amount ELSE 0 END) as phone_revenue,
    SUM(CASE WHEN customer_jobs.job_count > 1 THEN i.total_amount ELSE 0 END) as repeat_customer_revenue,
    SUM(CASE WHEN customer_jobs.job_count = 1 THEN i.total_amount ELSE 0 END) as new_customer_revenue,
    SUM(CASE WHEN j.referred_by_customer_id IS NOT NULL THEN i.total_amount ELSE 0 END) as referral_revenue
  FROM invoices i
  LEFT JOIN jobs j ON j.id = i.job_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as job_count
    FROM jobs j2
    WHERE j2.customer_id = i.customer_id
      AND j2.status = 'completed'
      AND j2.completed_at <= i.paid_date
  ) customer_jobs ON true
  WHERE i.status = 'paid'
    AND i.paid_date IS NOT NULL
    AND i.paid_date >= start_date
    AND i.paid_date <= end_date
  GROUP BY DATE_TRUNC(group_by, i.paid_date)
  ORDER BY period;
END;
$$ LANGUAGE plpgsql;

-- Function to get YoY revenue comparison
CREATE OR REPLACE FUNCTION get_yoy_revenue_comparison(
  current_start_date TIMESTAMP WITH TIME ZONE,
  current_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(
  current_period_revenue NUMERIC,
  previous_period_revenue NUMERIC,
  revenue_change NUMERIC,
  revenue_change_pct NUMERIC
) AS $$
DECLARE
  period_days INTEGER;
  prev_start_date TIMESTAMP WITH TIME ZONE;
  prev_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate period length
  period_days := EXTRACT(EPOCH FROM (current_end_date - current_start_date)) / 86400;

  -- Calculate previous period dates (one year ago)
  prev_start_date := current_start_date - INTERVAL '1 year';
  prev_end_date := current_end_date - INTERVAL '1 year';

  RETURN QUERY
  SELECT
    COALESCE(current_revenue.total, 0) as current_period_revenue,
    COALESCE(previous_revenue.total, 0) as previous_period_revenue,
    COALESCE(current_revenue.total, 0) - COALESCE(previous_revenue.total, 0) as revenue_change,
    CASE
      WHEN COALESCE(previous_revenue.total, 0) > 0
      THEN ROUND(((COALESCE(current_revenue.total, 0) - COALESCE(previous_revenue.total, 0)) / previous_revenue.total) * 100, 2)
      ELSE 0
    END as revenue_change_pct
  FROM
    (SELECT SUM(total_amount) as total FROM invoices WHERE status = 'paid' AND paid_date >= current_start_date AND paid_date <= current_end_date) current_revenue,
    (SELECT SUM(total_amount) as total FROM invoices WHERE status = 'paid' AND paid_date >= prev_start_date AND paid_date <= prev_end_date) previous_revenue;
END;
$$ LANGUAGE plpgsql;

-- Function to get service performance over time
CREATE OR REPLACE FUNCTION get_service_performance_trend(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  group_by TEXT DEFAULT 'month'
)
RETURNS TABLE(
  period TIMESTAMP WITH TIME ZONE,
  service_type VARCHAR,
  revenue NUMERIC,
  job_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(group_by, i.paid_date) as period,
    js.service_type,
    SUM(i.total_amount) as revenue,
    COUNT(DISTINCT j.id) as job_count
  FROM job_services js
  INNER JOIN jobs j ON j.id = js.job_id
  INNER JOIN invoices i ON i.job_id = j.id
  WHERE i.status = 'paid'
    AND i.paid_date IS NOT NULL
    AND i.paid_date >= start_date
    AND i.paid_date <= end_date
  GROUP BY DATE_TRUNC(group_by, i.paid_date), js.service_type
  ORDER BY period, revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get top revenue customers
CREATE OR REPLACE FUNCTION get_top_revenue_customers(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE(
  customer_id UUID,
  customer_name VARCHAR,
  customer_email VARCHAR,
  total_revenue NUMERIC,
  job_count BIGINT,
  avg_order_value NUMERIC,
  first_purchase TIMESTAMP WITH TIME ZONE,
  last_purchase TIMESTAMP WITH TIME ZONE,
  tier_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as customer_id,
    c.name as customer_name,
    c.email as customer_email,
    SUM(i.total_amount) as total_revenue,
    COUNT(DISTINCT j.id) as job_count,
    AVG(i.total_amount) as avg_order_value,
    MIN(i.paid_date) as first_purchase,
    MAX(i.paid_date) as last_purchase,
    COALESCE(lt.tier_name, 'No Tier') as tier_name
  FROM customers c
  INNER JOIN jobs j ON j.customer_id = c.id
  INNER JOIN invoices i ON i.job_id = j.id
  LEFT JOIN customer_loyalty cl ON cl.customer_id = c.id
  LEFT JOIN loyalty_tiers lt ON lt.id = cl.current_tier_id
  WHERE i.status = 'paid'
    AND i.paid_date IS NOT NULL
    AND i.paid_date >= start_date
    AND i.paid_date <= end_date
  GROUP BY c.id, c.name, c.email, lt.tier_name
  ORDER BY total_revenue DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON VIEW revenue_analytics_daily IS 'Daily revenue breakdown with booking sources';
COMMENT ON VIEW revenue_by_service IS 'Revenue and profitability by service type';
COMMENT ON VIEW revenue_by_zone IS 'Revenue breakdown by service zone';
COMMENT ON VIEW payment_method_analytics IS 'Payment method distribution and metrics';
COMMENT ON VIEW customer_ltv_by_tier IS 'Customer lifetime value segmented by loyalty tier';
COMMENT ON VIEW outstanding_invoices_summary IS 'Summary of outstanding and overdue invoices';
COMMENT ON FUNCTION get_revenue_analytics IS 'Get revenue analytics for custom date range with grouping';
COMMENT ON FUNCTION get_yoy_revenue_comparison IS 'Compare current period revenue to same period last year';
COMMENT ON FUNCTION get_service_performance_trend IS 'Track service type revenue trends over time';
COMMENT ON FUNCTION get_top_revenue_customers IS 'Get highest revenue generating customers for a period';
