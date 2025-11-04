-- Review Analytics View Migration
-- Created: 2025-10-22
-- Purpose: Create database view for review analytics and reporting

-- Drop existing view if exists
DROP VIEW IF EXISTS review_analytics_monthly;
DROP VIEW IF EXISTS review_analytics_weekly;
DROP VIEW IF EXISTS review_analytics_daily;

-- Monthly Analytics View
CREATE VIEW review_analytics_monthly AS
SELECT
  DATE_TRUNC('month', requested_at) as month,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN portal_review_completed THEN 1 END) as portal_completions,
  COUNT(CASE WHEN google_review_completed THEN 1 END) as google_completions,
  COUNT(CASE WHEN request_method = 'email' THEN 1 END) as email_requests,
  COUNT(CASE WHEN request_method = 'sms' THEN 1 END) as sms_requests,
  COUNT(CASE WHEN request_method = 'portal' THEN 1 END) as portal_requests,
  AVG(CASE WHEN portal_review_rating IS NOT NULL THEN portal_review_rating END) as avg_rating,
  COUNT(CASE WHEN portal_review_rating = 5 THEN 1 END) as rating_5_count,
  COUNT(CASE WHEN portal_review_rating = 4 THEN 1 END) as rating_4_count,
  COUNT(CASE WHEN portal_review_rating = 3 THEN 1 END) as rating_3_count,
  COUNT(CASE WHEN portal_review_rating = 2 THEN 1 END) as rating_2_count,
  COUNT(CASE WHEN portal_review_rating = 1 THEN 1 END) as rating_1_count,
  ROUND(
    COUNT(CASE WHEN portal_review_completed THEN 1 END)::DECIMAL /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as portal_response_rate,
  ROUND(
    COUNT(CASE WHEN google_review_link_clicked THEN 1 END)::DECIMAL /
    NULLIF(COUNT(CASE WHEN google_review_requested THEN 1 END), 0) * 100,
    2
  ) as google_conversion_rate
FROM review_requests
GROUP BY DATE_TRUNC('month', requested_at)
ORDER BY month DESC;

-- Weekly Analytics View
CREATE VIEW review_analytics_weekly AS
SELECT
  DATE_TRUNC('week', requested_at) as week,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN portal_review_completed THEN 1 END) as portal_completions,
  COUNT(CASE WHEN google_review_completed THEN 1 END) as google_completions,
  COUNT(CASE WHEN request_method = 'email' THEN 1 END) as email_requests,
  COUNT(CASE WHEN request_method = 'sms' THEN 1 END) as sms_requests,
  COUNT(CASE WHEN request_method = 'portal' THEN 1 END) as portal_requests,
  AVG(CASE WHEN portal_review_rating IS NOT NULL THEN portal_review_rating END) as avg_rating,
  COUNT(CASE WHEN portal_review_rating = 5 THEN 1 END) as rating_5_count,
  COUNT(CASE WHEN portal_review_rating = 4 THEN 1 END) as rating_4_count,
  COUNT(CASE WHEN portal_review_rating = 3 THEN 1 END) as rating_3_count,
  COUNT(CASE WHEN portal_review_rating = 2 THEN 1 END) as rating_2_count,
  COUNT(CASE WHEN portal_review_rating = 1 THEN 1 END) as rating_1_count,
  ROUND(
    COUNT(CASE WHEN portal_review_completed THEN 1 END)::DECIMAL /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as portal_response_rate,
  ROUND(
    COUNT(CASE WHEN google_review_link_clicked THEN 1 END)::DECIMAL /
    NULLIF(COUNT(CASE WHEN google_review_requested THEN 1 END), 0) * 100,
    2
  ) as google_conversion_rate
FROM review_requests
GROUP BY DATE_TRUNC('week', requested_at)
ORDER BY week DESC;

-- Daily Analytics View
CREATE VIEW review_analytics_daily AS
SELECT
  DATE_TRUNC('day', requested_at) as day,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN portal_review_completed THEN 1 END) as portal_completions,
  COUNT(CASE WHEN google_review_completed THEN 1 END) as google_completions,
  COUNT(CASE WHEN request_method = 'email' THEN 1 END) as email_requests,
  COUNT(CASE WHEN request_method = 'sms' THEN 1 END) as sms_requests,
  COUNT(CASE WHEN request_method = 'portal' THEN 1 END) as portal_requests,
  AVG(CASE WHEN portal_review_rating IS NOT NULL THEN portal_review_rating END) as avg_rating,
  COUNT(CASE WHEN portal_review_rating = 5 THEN 1 END) as rating_5_count,
  COUNT(CASE WHEN portal_review_rating = 4 THEN 1 END) as rating_4_count,
  COUNT(CASE WHEN portal_review_rating = 3 THEN 1 END) as rating_3_count,
  COUNT(CASE WHEN portal_review_rating = 2 THEN 1 END) as rating_2_count,
  COUNT(CASE WHEN portal_review_rating = 1 THEN 1 END) as rating_1_count,
  ROUND(
    COUNT(CASE WHEN portal_review_completed THEN 1 END)::DECIMAL /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as portal_response_rate,
  ROUND(
    COUNT(CASE WHEN google_review_link_clicked THEN 1 END)::DECIMAL /
    NULLIF(COUNT(CASE WHEN google_review_requested THEN 1 END), 0) * 100,
    2
  ) as google_conversion_rate
FROM review_requests
GROUP BY DATE_TRUNC('day', requested_at)
ORDER BY day DESC;

-- Grant access to authenticated users
GRANT SELECT ON review_analytics_monthly TO authenticated;
GRANT SELECT ON review_analytics_weekly TO authenticated;
GRANT SELECT ON review_analytics_daily TO authenticated;

-- Comment on views
COMMENT ON VIEW review_analytics_monthly IS 'Monthly aggregated review request analytics';
COMMENT ON VIEW review_analytics_weekly IS 'Weekly aggregated review request analytics';
COMMENT ON VIEW review_analytics_daily IS 'Daily aggregated review request analytics';
