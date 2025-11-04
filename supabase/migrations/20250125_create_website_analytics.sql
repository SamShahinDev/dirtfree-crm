-- Website Analytics Integration
-- Track website performance and conversions directly in the CRM

-- ============================================================================
-- Table: website_analytics
-- Stores individual analytics events (page views, clicks, form submissions, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS website_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  page_path VARCHAR(255),
  referrer VARCHAR(255),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(100),
  utm_term VARCHAR(100),
  session_id VARCHAR(100),
  visitor_id VARCHAR(100),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_website_analytics_event
  ON website_analytics(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_analytics_customer
  ON website_analytics(customer_id);

CREATE INDEX IF NOT EXISTS idx_website_analytics_session
  ON website_analytics(session_id);

CREATE INDEX IF NOT EXISTS idx_website_analytics_utm
  ON website_analytics(utm_source, utm_medium, utm_campaign);

CREATE INDEX IF NOT EXISTS idx_website_analytics_created_at
  ON website_analytics(created_at DESC);

-- ============================================================================
-- Table: website_sessions
-- Tracks complete user sessions with attribution and conversion data
-- ============================================================================

CREATE TABLE IF NOT EXISTS website_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(100) UNIQUE NOT NULL,
  visitor_id VARCHAR(100),
  first_page VARCHAR(255),
  last_page VARCHAR(255),
  pages_visited INTEGER DEFAULT 1,
  duration_seconds INTEGER,
  converted BOOLEAN DEFAULT false,
  conversion_type VARCHAR(50),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  referrer VARCHAR(255),
  device_type VARCHAR(50),
  browser VARCHAR(50),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Indexes for session queries
CREATE INDEX IF NOT EXISTS idx_website_sessions_visitor
  ON website_sessions(visitor_id);

CREATE INDEX IF NOT EXISTS idx_website_sessions_converted
  ON website_sessions(converted, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_sessions_customer
  ON website_sessions(customer_id);

CREATE INDEX IF NOT EXISTS idx_website_sessions_started_at
  ON website_sessions(started_at DESC);

-- ============================================================================
-- Function: get_top_pages
-- Returns top pages by view count for a given number of days
-- ============================================================================

CREATE OR REPLACE FUNCTION get_top_pages(days INTEGER DEFAULT 7)
RETURNS TABLE (
  path VARCHAR(255),
  views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    page_path as path,
    COUNT(*) as views
  FROM website_analytics
  WHERE
    event_type = 'page_view'
    AND created_at >= NOW() - (days || ' days')::INTERVAL
    AND page_path IS NOT NULL
  GROUP BY page_path
  ORDER BY views DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: get_top_sources
-- Returns top traffic sources by session count for a given number of days
-- ============================================================================

CREATE OR REPLACE FUNCTION get_top_sources(days INTEGER DEFAULT 30)
RETURNS TABLE (
  source VARCHAR(100),
  medium VARCHAR(100),
  campaign VARCHAR(100),
  sessions BIGINT,
  conversions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(utm_source, 'Direct') as source,
    utm_medium as medium,
    utm_campaign as campaign,
    COUNT(*) as sessions,
    COUNT(*) FILTER (WHERE converted = true) as conversions
  FROM website_sessions
  WHERE started_at >= NOW() - (days || ' days')::INTERVAL
  GROUP BY utm_source, utm_medium, utm_campaign
  ORDER BY sessions DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: get_conversion_funnel
-- Returns funnel metrics showing drop-off at each stage
-- ============================================================================

CREATE OR REPLACE FUNCTION get_conversion_funnel(days INTEGER DEFAULT 7)
RETURNS TABLE (
  stage VARCHAR(50),
  count BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH funnel_data AS (
    SELECT
      COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'page_view') as page_views,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'booking_started') as booking_started,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'service_selected') as service_selected,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'form_submitted') as form_submitted,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'booking_completed') as booking_completed
    FROM website_analytics
    WHERE created_at >= NOW() - (days || ' days')::INTERVAL
  )
  SELECT 'Page Views'::VARCHAR(50) as stage, page_views, 100.0 as conversion_rate FROM funnel_data
  UNION ALL
  SELECT 'Booking Started'::VARCHAR(50), booking_started,
    CASE WHEN page_views > 0 THEN ROUND((booking_started::NUMERIC / page_views::NUMERIC) * 100, 2) ELSE 0 END
  FROM funnel_data
  UNION ALL
  SELECT 'Service Selected'::VARCHAR(50), service_selected,
    CASE WHEN page_views > 0 THEN ROUND((service_selected::NUMERIC / page_views::NUMERIC) * 100, 2) ELSE 0 END
  FROM funnel_data
  UNION ALL
  SELECT 'Form Submitted'::VARCHAR(50), form_submitted,
    CASE WHEN page_views > 0 THEN ROUND((form_submitted::NUMERIC / page_views::NUMERIC) * 100, 2) ELSE 0 END
  FROM funnel_data
  UNION ALL
  SELECT 'Booking Completed'::VARCHAR(50), booking_completed,
    CASE WHEN page_views > 0 THEN ROUND((booking_completed::NUMERIC / page_views::NUMERIC) * 100, 2) ELSE 0 END
  FROM funnel_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: get_analytics_summary
-- Returns summary statistics for a date range
-- ============================================================================

CREATE OR REPLACE FUNCTION get_analytics_summary(
  start_date TIMESTAMP DEFAULT NOW() - INTERVAL '7 days',
  end_date TIMESTAMP DEFAULT NOW()
)
RETURNS TABLE (
  total_sessions BIGINT,
  total_page_views BIGINT,
  total_conversions BIGINT,
  conversion_rate NUMERIC,
  avg_pages_per_session NUMERIC,
  avg_session_duration INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT ws.session_id) as total_sessions,
    COUNT(*) FILTER (WHERE wa.event_type = 'page_view') as total_page_views,
    COUNT(DISTINCT ws.session_id) FILTER (WHERE ws.converted = true) as total_conversions,
    CASE
      WHEN COUNT(DISTINCT ws.session_id) > 0
      THEN ROUND((COUNT(DISTINCT ws.session_id) FILTER (WHERE ws.converted = true)::NUMERIC / COUNT(DISTINCT ws.session_id)::NUMERIC) * 100, 2)
      ELSE 0
    END as conversion_rate,
    ROUND(AVG(ws.pages_visited), 2) as avg_pages_per_session,
    ROUND(AVG(ws.duration_seconds))::INTEGER as avg_session_duration
  FROM website_sessions ws
  LEFT JOIN website_analytics wa ON ws.session_id = wa.session_id
  WHERE ws.started_at >= start_date AND ws.started_at <= end_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE website_analytics IS 'Stores individual analytics events from the website';
COMMENT ON TABLE website_sessions IS 'Tracks complete user sessions with attribution data';
COMMENT ON COLUMN website_analytics.event_type IS 'Type of event: page_view, booking_started, service_selected, form_submitted, booking_completed, phone_clicked';
COMMENT ON COLUMN website_analytics.metadata IS 'Additional event data stored as JSON';
COMMENT ON COLUMN website_sessions.converted IS 'Whether this session resulted in a conversion (booking)';
COMMENT ON COLUMN website_sessions.duration_seconds IS 'Session duration calculated from started_at to ended_at';
