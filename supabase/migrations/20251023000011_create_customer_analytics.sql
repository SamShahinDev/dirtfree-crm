-- Create customer analytics views and functions

-- 1. Customer Segments View
CREATE OR REPLACE VIEW customer_segments AS
SELECT
  c.id,
  c.name,
  c.email,
  c.phone,
  c.created_at as customer_since,
  COUNT(DISTINCT j.id) as total_bookings,
  SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as lifetime_value,
  MAX(j.scheduled_date) as last_booking_date,
  MIN(j.scheduled_date) as first_booking_date,
  CASE
    WHEN SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) >= 1000 THEN 'VIP'
    WHEN COUNT(DISTINCT j.id) >= 3 THEN 'Regular'
    WHEN COUNT(DISTINCT j.id) = 1 THEN 'One-time'
    WHEN MAX(j.scheduled_date) < NOW() - INTERVAL '180 days' THEN 'At-risk'
    WHEN COUNT(DISTINCT j.id) > 0 THEN 'Active'
    ELSE 'Inactive'
  END as segment,
  CASE
    WHEN MAX(j.scheduled_date) IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (NOW() - MAX(j.scheduled_date)))/86400
  END as days_since_last_booking,
  c.service_zone_id,
  c.acquisition_source,
  COALESCE(lt.tier_name, 'No Tier') as loyalty_tier
FROM customers c
LEFT JOIN jobs j ON j.customer_id = c.id AND j.status = 'completed'
LEFT JOIN invoices i ON i.customer_id = c.id
LEFT JOIN customer_loyalty cl ON cl.customer_id = c.id
LEFT JOIN loyalty_tiers lt ON lt.id = cl.current_tier_id
GROUP BY c.id, c.name, c.email, c.phone, c.created_at, c.service_zone_id, c.acquisition_source, lt.tier_name;

-- 2. Customer Overview Metrics
CREATE OR REPLACE VIEW customer_overview_metrics AS
SELECT
  COUNT(DISTINCT c.id) as total_customers,
  COUNT(DISTINCT CASE WHEN c.created_at >= DATE_TRUNC('month', NOW()) THEN c.id END) as new_customers_this_month,
  COUNT(DISTINCT CASE WHEN latest_booking.last_booking >= NOW() - INTERVAL '90 days' THEN c.id END) as active_customers_90d,
  COUNT(DISTINCT CASE WHEN latest_booking.last_booking < NOW() - INTERVAL '365 days' OR latest_booking.last_booking IS NULL THEN c.id END) as churned_customers,
  ROUND(
    COUNT(DISTINCT CASE WHEN latest_booking.last_booking < NOW() - INTERVAL '365 days' OR latest_booking.last_booking IS NULL THEN c.id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT c.id)::NUMERIC, 0) * 100,
    2
  ) as churn_rate_pct,
  AVG(customer_stats.booking_count) as avg_bookings_per_customer,
  AVG(customer_stats.lifetime_value) as avg_customer_ltv
FROM customers c
LEFT JOIN LATERAL (
  SELECT MAX(j.scheduled_date) as last_booking
  FROM jobs j
  WHERE j.customer_id = c.id AND j.status = 'completed'
) latest_booking ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(j.id) as booking_count,
    SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as lifetime_value
  FROM jobs j
  LEFT JOIN invoices i ON i.job_id = j.id
  WHERE j.customer_id = c.id
) customer_stats ON true;

-- 3. Segment Distribution
CREATE OR REPLACE VIEW customer_segment_distribution AS
SELECT
  segment,
  COUNT(*) as customer_count,
  AVG(lifetime_value) as avg_lifetime_value,
  AVG(total_bookings) as avg_bookings,
  ROUND(COUNT(*)::NUMERIC / NULLIF(total_customers.total, 0) * 100, 2) as percentage
FROM customer_segments
CROSS JOIN (
  SELECT COUNT(*) as total FROM customer_segments
) total_customers
GROUP BY segment, total_customers.total
ORDER BY
  CASE segment
    WHEN 'VIP' THEN 1
    WHEN 'Regular' THEN 2
    WHEN 'Active' THEN 3
    WHEN 'One-time' THEN 4
    WHEN 'At-risk' THEN 5
    ELSE 6
  END;

-- 4. Acquisition Source Analytics
CREATE OR REPLACE VIEW customer_acquisition_sources AS
SELECT
  COALESCE(c.acquisition_source, 'Unknown') as source,
  COUNT(DISTINCT c.id) as customer_count,
  AVG(customer_stats.booking_count) as avg_bookings_per_customer,
  AVG(customer_stats.lifetime_value) as avg_lifetime_value,
  SUM(customer_stats.lifetime_value) as total_revenue,
  ROUND(COUNT(DISTINCT c.id)::NUMERIC / NULLIF(total_customers.total, 0) * 100, 2) as percentage
FROM customers c
CROSS JOIN (
  SELECT COUNT(*) as total FROM customers
) total_customers
LEFT JOIN LATERAL (
  SELECT
    COUNT(j.id) as booking_count,
    SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as lifetime_value
  FROM jobs j
  LEFT JOIN invoices i ON i.job_id = j.id
  WHERE j.customer_id = c.id
) customer_stats ON true
GROUP BY COALESCE(c.acquisition_source, 'Unknown'), total_customers.total
ORDER BY customer_count DESC;

-- 5. Geographic Distribution
CREATE OR REPLACE VIEW customer_geographic_distribution AS
SELECT
  sz.id as zone_id,
  sz.zone_name,
  COUNT(DISTINCT c.id) as customer_count,
  COUNT(DISTINCT j.id) as total_jobs,
  SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as total_revenue,
  AVG(CASE WHEN i.status = 'paid' THEN i.total_amount END) as avg_job_value,
  ROUND(COUNT(DISTINCT c.id)::NUMERIC / NULLIF(total_customers.total, 0) * 100, 2) as percentage_of_customers
FROM service_zones sz
LEFT JOIN customers c ON c.service_zone_id = sz.id
LEFT JOIN jobs j ON j.customer_id = c.id
LEFT JOIN invoices i ON i.job_id = j.id
CROSS JOIN (
  SELECT COUNT(*) as total FROM customers WHERE service_zone_id IS NOT NULL
) total_customers
GROUP BY sz.id, sz.zone_name, total_customers.total
ORDER BY customer_count DESC;

-- 6. Customer Behavior Patterns
CREATE OR REPLACE VIEW customer_behavior_patterns AS
SELECT
  EXTRACT(DOW FROM j.scheduled_date) as day_of_week,
  CASE EXTRACT(DOW FROM j.scheduled_date)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name,
  COUNT(DISTINCT j.id) as booking_count,
  COUNT(DISTINCT j.customer_id) as unique_customers,
  AVG(i.total_amount) as avg_booking_value
FROM jobs j
LEFT JOIN invoices i ON i.job_id = j.id AND i.status = 'paid'
WHERE j.status = 'completed'
GROUP BY EXTRACT(DOW FROM j.scheduled_date)
ORDER BY day_of_week;

-- 7. Favorite Services by Segment
CREATE OR REPLACE VIEW favorite_services_by_segment AS
SELECT
  cs.segment,
  js.service_type,
  COUNT(DISTINCT j.id) as booking_count,
  COUNT(DISTINCT j.customer_id) as customer_count,
  ROW_NUMBER() OVER (PARTITION BY cs.segment ORDER BY COUNT(DISTINCT j.id) DESC) as rank
FROM customer_segments cs
INNER JOIN jobs j ON j.customer_id = cs.id
INNER JOIN job_services js ON js.job_id = j.id
WHERE j.status = 'completed'
GROUP BY cs.segment, js.service_type;

-- Function to get customer retention cohorts
CREATE OR REPLACE FUNCTION get_customer_retention_cohorts(
  months_back INTEGER DEFAULT 12
)
RETURNS TABLE(
  cohort_month DATE,
  customers_acquired INTEGER,
  month_0 INTEGER,
  month_1 INTEGER,
  month_2 INTEGER,
  month_3 INTEGER,
  month_6 INTEGER,
  month_12 INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH cohorts AS (
    SELECT
      DATE_TRUNC('month', c.created_at)::DATE as cohort_month,
      c.id as customer_id,
      c.created_at
    FROM customers c
    WHERE c.created_at >= NOW() - (months_back || ' months')::INTERVAL
  ),
  bookings AS (
    SELECT
      j.customer_id,
      DATE_TRUNC('month', j.scheduled_date)::DATE as booking_month
    FROM jobs j
    WHERE j.status = 'completed'
  )
  SELECT
    cohorts.cohort_month,
    COUNT(DISTINCT cohorts.customer_id)::INTEGER as customers_acquired,
    COUNT(DISTINCT CASE WHEN bookings.booking_month = cohorts.cohort_month THEN cohorts.customer_id END)::INTEGER as month_0,
    COUNT(DISTINCT CASE WHEN bookings.booking_month = cohorts.cohort_month + INTERVAL '1 month' THEN cohorts.customer_id END)::INTEGER as month_1,
    COUNT(DISTINCT CASE WHEN bookings.booking_month = cohorts.cohort_month + INTERVAL '2 months' THEN cohorts.customer_id END)::INTEGER as month_2,
    COUNT(DISTINCT CASE WHEN bookings.booking_month = cohorts.cohort_month + INTERVAL '3 months' THEN cohorts.customer_id END)::INTEGER as month_3,
    COUNT(DISTINCT CASE WHEN bookings.booking_month = cohorts.cohort_month + INTERVAL '6 months' THEN cohorts.customer_id END)::INTEGER as month_6,
    COUNT(DISTINCT CASE WHEN bookings.booking_month = cohorts.cohort_month + INTERVAL '12 months' THEN cohorts.customer_id END)::INTEGER as month_12
  FROM cohorts
  LEFT JOIN bookings ON bookings.customer_id = cohorts.customer_id
  GROUP BY cohorts.cohort_month
  ORDER BY cohorts.cohort_month DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get average time between bookings
CREATE OR REPLACE FUNCTION get_avg_time_between_bookings()
RETURNS TABLE(
  segment VARCHAR,
  avg_days_between_bookings NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH booking_intervals AS (
    SELECT
      cs.segment,
      cs.id as customer_id,
      j.scheduled_date,
      LAG(j.scheduled_date) OVER (PARTITION BY cs.id ORDER BY j.scheduled_date) as previous_booking
    FROM customer_segments cs
    INNER JOIN jobs j ON j.customer_id = cs.id
    WHERE j.status = 'completed'
  )
  SELECT
    booking_intervals.segment,
    AVG(EXTRACT(EPOCH FROM (booking_intervals.scheduled_date - booking_intervals.previous_booking)) / 86400) as avg_days_between_bookings
  FROM booking_intervals
  WHERE booking_intervals.previous_booking IS NOT NULL
  GROUP BY booking_intervals.segment
  ORDER BY
    CASE booking_intervals.segment
      WHEN 'VIP' THEN 1
      WHEN 'Regular' THEN 2
      WHEN 'Active' THEN 3
      WHEN 'One-time' THEN 4
      WHEN 'At-risk' THEN 5
      ELSE 6
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer list by segment
CREATE OR REPLACE FUNCTION get_customers_by_segment(
  target_segment VARCHAR,
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE(
  customer_id UUID,
  customer_name VARCHAR,
  customer_email VARCHAR,
  customer_phone VARCHAR,
  total_bookings BIGINT,
  lifetime_value NUMERIC,
  last_booking_date TIMESTAMP WITH TIME ZONE,
  days_since_last_booking NUMERIC,
  loyalty_tier VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id as customer_id,
    cs.name as customer_name,
    cs.email as customer_email,
    cs.phone as customer_phone,
    cs.total_bookings,
    cs.lifetime_value,
    cs.last_booking_date,
    cs.days_since_last_booking,
    cs.loyalty_tier
  FROM customer_segments cs
  WHERE cs.segment = target_segment
  ORDER BY cs.lifetime_value DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer growth trends
CREATE OR REPLACE FUNCTION get_customer_growth_trend(
  months_back INTEGER DEFAULT 12
)
RETURNS TABLE(
  month DATE,
  new_customers INTEGER,
  churned_customers INTEGER,
  net_growth INTEGER,
  total_customers INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT
      DATE_TRUNC('month', month_series)::DATE as month
    FROM generate_series(
      DATE_TRUNC('month', NOW() - (months_back || ' months')::INTERVAL),
      DATE_TRUNC('month', NOW()),
      '1 month'::interval
    ) month_series
  ),
  new_customers AS (
    SELECT
      DATE_TRUNC('month', created_at)::DATE as month,
      COUNT(*)::INTEGER as count
    FROM customers
    GROUP BY DATE_TRUNC('month', created_at)::DATE
  ),
  churned AS (
    SELECT
      DATE_TRUNC('month', last_active + INTERVAL '365 days')::DATE as churn_month,
      COUNT(*)::INTEGER as count
    FROM (
      SELECT
        customer_id,
        MAX(scheduled_date) as last_active
      FROM jobs
      WHERE status = 'completed'
      GROUP BY customer_id
      HAVING MAX(scheduled_date) < NOW() - INTERVAL '365 days'
    ) churned_customers
    GROUP BY DATE_TRUNC('month', last_active + INTERVAL '365 days')::DATE
  )
  SELECT
    md.month,
    COALESCE(nc.count, 0) as new_customers,
    COALESCE(ch.count, 0) as churned_customers,
    COALESCE(nc.count, 0) - COALESCE(ch.count, 0) as net_growth,
    (
      SELECT COUNT(*)::INTEGER
      FROM customers
      WHERE created_at <= md.month + INTERVAL '1 month' - INTERVAL '1 day'
    ) as total_customers
  FROM monthly_data md
  LEFT JOIN new_customers nc ON nc.month = md.month
  LEFT JOIN churned ch ON ch.churn_month = md.month
  ORDER BY md.month;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON VIEW customer_segments IS 'Customer segmentation based on booking behavior and lifetime value';
COMMENT ON VIEW customer_overview_metrics IS 'High-level customer metrics including churn rate';
COMMENT ON VIEW customer_segment_distribution IS 'Distribution of customers across segments';
COMMENT ON VIEW customer_acquisition_sources IS 'Customer acquisition channel performance';
COMMENT ON VIEW customer_geographic_distribution IS 'Customer and revenue distribution by service zone';
COMMENT ON VIEW customer_behavior_patterns IS 'Booking patterns by day of week';
COMMENT ON VIEW favorite_services_by_segment IS 'Most popular services for each customer segment';
COMMENT ON FUNCTION get_customer_retention_cohorts IS 'Cohort analysis for customer retention';
COMMENT ON FUNCTION get_avg_time_between_bookings IS 'Average rebooking interval by segment';
COMMENT ON FUNCTION get_customers_by_segment IS 'Retrieve customer list filtered by segment';
COMMENT ON FUNCTION get_customer_growth_trend IS 'Monthly customer acquisition and churn trends';
