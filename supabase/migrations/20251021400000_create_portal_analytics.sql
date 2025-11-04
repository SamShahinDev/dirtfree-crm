-- ================================================================
-- Portal Analytics System
-- ================================================================
-- Tracks customer portal usage for engagement and ROI metrics
-- Includes raw event tracking and daily aggregations
-- ================================================================

-- Create portal_analytics table for raw events
CREATE TABLE IF NOT EXISTS portal_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  session_id uuid REFERENCES portal_sessions(id) ON DELETE SET NULL,

  -- Event details
  event_type text NOT NULL CHECK (event_type IN (
    'login',
    'logout',
    'page_view',
    'feature_usage',
    'booking_initiated',
    'booking_completed',
    'booking_cancelled',
    'payment_initiated',
    'payment_completed',
    'payment_failed',
    'invoice_viewed',
    'invoice_downloaded',
    'message_sent',
    'message_viewed',
    'notification_clicked',
    'profile_updated',
    'preferences_updated',
    'search',
    'error'
  )),

  -- Page/feature info
  page text,
  feature text,

  -- Additional context
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Session context
  ip_address inet,
  user_agent text,
  referrer text,

  -- Value tracking
  value_amount numeric(10,2), -- For booking/payment amounts

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portal_analytics_customer
  ON portal_analytics(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_analytics_event_type
  ON portal_analytics(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_analytics_session
  ON portal_analytics(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_analytics_created_at
  ON portal_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_analytics_date
  ON portal_analytics(DATE(created_at));

CREATE INDEX IF NOT EXISTS idx_portal_analytics_page
  ON portal_analytics(page)
  WHERE page IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portal_analytics_feature
  ON portal_analytics(feature)
  WHERE feature IS NOT NULL;

-- Create portal_analytics_daily aggregation table
CREATE TABLE IF NOT EXISTS portal_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,

  -- User metrics
  new_registrations integer DEFAULT 0 NOT NULL,
  total_active_users integer DEFAULT 0 NOT NULL,
  unique_visitors integer DEFAULT 0 NOT NULL,
  total_sessions integer DEFAULT 0 NOT NULL,

  -- Engagement metrics
  total_page_views integer DEFAULT 0 NOT NULL,
  avg_pages_per_session numeric(10,2) DEFAULT 0 NOT NULL,
  avg_session_duration_minutes numeric(10,2) DEFAULT 0 NOT NULL,

  -- Feature usage
  bookings_initiated integer DEFAULT 0 NOT NULL,
  bookings_completed integer DEFAULT 0 NOT NULL,
  bookings_cancelled integer DEFAULT 0 NOT NULL,
  booking_conversion_rate numeric(5,2) DEFAULT 0 NOT NULL,

  -- Payment metrics
  payments_initiated integer DEFAULT 0 NOT NULL,
  payments_completed integer DEFAULT 0 NOT NULL,
  payments_failed integer DEFAULT 0 NOT NULL,
  payment_conversion_rate numeric(5,2) DEFAULT 0 NOT NULL,
  total_payment_amount numeric(12,2) DEFAULT 0 NOT NULL,

  -- Communication
  messages_sent integer DEFAULT 0 NOT NULL,
  messages_viewed integer DEFAULT 0 NOT NULL,

  -- Content
  invoices_viewed integer DEFAULT 0 NOT NULL,
  invoices_downloaded integer DEFAULT 0 NOT NULL,

  -- Notifications
  notifications_clicked integer DEFAULT 0 NOT NULL,

  -- Errors
  total_errors integer DEFAULT 0 NOT NULL,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for daily aggregations
CREATE INDEX IF NOT EXISTS idx_portal_analytics_daily_date
  ON portal_analytics_daily(date DESC);

-- Enable RLS
ALTER TABLE portal_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_analytics_daily ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for API and cron jobs)
CREATE POLICY "Service role full access to analytics"
  ON portal_analytics
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to daily analytics"
  ON portal_analytics_daily
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Admin users can view analytics
CREATE POLICY "Admins can view analytics"
  ON portal_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view daily analytics"
  ON portal_analytics_daily
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Function to calculate session duration
CREATE OR REPLACE FUNCTION calculate_session_duration(p_session_id uuid)
RETURNS numeric AS $$
DECLARE
  first_event timestamptz;
  last_event timestamptz;
  duration_minutes numeric;
BEGIN
  SELECT MIN(created_at), MAX(created_at)
  INTO first_event, last_event
  FROM portal_analytics
  WHERE session_id = p_session_id;

  IF first_event IS NULL OR last_event IS NULL THEN
    RETURN 0;
  END IF;

  duration_minutes := EXTRACT(EPOCH FROM (last_event - first_event)) / 60;

  RETURN duration_minutes;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily analytics
CREATE OR REPLACE FUNCTION aggregate_portal_analytics(p_date date)
RETURNS void AS $$
DECLARE
  v_new_registrations integer;
  v_total_active_users integer;
  v_unique_visitors integer;
  v_total_sessions integer;
  v_total_page_views integer;
  v_avg_pages_per_session numeric;
  v_avg_session_duration numeric;
  v_bookings_initiated integer;
  v_bookings_completed integer;
  v_bookings_cancelled integer;
  v_booking_conversion_rate numeric;
  v_payments_initiated integer;
  v_payments_completed integer;
  v_payments_failed integer;
  v_payment_conversion_rate numeric;
  v_total_payment_amount numeric;
  v_messages_sent integer;
  v_messages_viewed integer;
  v_invoices_viewed integer;
  v_invoices_downloaded integer;
  v_notifications_clicked integer;
  v_total_errors integer;
BEGIN
  -- Count new registrations (from portal_sessions created on this date)
  SELECT COUNT(DISTINCT customer_id)
  INTO v_new_registrations
  FROM portal_sessions
  WHERE DATE(created_at) = p_date;

  -- Count unique active users (distinct customers with events on this date)
  SELECT COUNT(DISTINCT customer_id)
  INTO v_total_active_users
  FROM portal_analytics
  WHERE DATE(created_at) = p_date
    AND customer_id IS NOT NULL;

  -- Count unique visitors (distinct customers OR sessions)
  SELECT COUNT(DISTINCT COALESCE(customer_id::text, session_id::text))
  INTO v_unique_visitors
  FROM portal_analytics
  WHERE DATE(created_at) = p_date;

  -- Count total sessions
  SELECT COUNT(DISTINCT session_id)
  INTO v_total_sessions
  FROM portal_analytics
  WHERE DATE(created_at) = p_date
    AND session_id IS NOT NULL;

  -- Count page views
  SELECT COUNT(*)
  INTO v_total_page_views
  FROM portal_analytics
  WHERE DATE(created_at) = p_date
    AND event_type = 'page_view';

  -- Calculate average pages per session
  v_avg_pages_per_session := CASE
    WHEN v_total_sessions > 0
    THEN v_total_page_views::numeric / v_total_sessions
    ELSE 0
  END;

  -- Calculate average session duration
  SELECT COALESCE(AVG(calculate_session_duration(session_id)), 0)
  INTO v_avg_session_duration
  FROM (
    SELECT DISTINCT session_id
    FROM portal_analytics
    WHERE DATE(created_at) = p_date
      AND session_id IS NOT NULL
  ) sessions;

  -- Booking metrics
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'booking_initiated'),
    COUNT(*) FILTER (WHERE event_type = 'booking_completed'),
    COUNT(*) FILTER (WHERE event_type = 'booking_cancelled')
  INTO v_bookings_initiated, v_bookings_completed, v_bookings_cancelled
  FROM portal_analytics
  WHERE DATE(created_at) = p_date;

  -- Booking conversion rate
  v_booking_conversion_rate := CASE
    WHEN v_bookings_initiated > 0
    THEN (v_bookings_completed::numeric / v_bookings_initiated * 100)
    ELSE 0
  END;

  -- Payment metrics
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'payment_initiated'),
    COUNT(*) FILTER (WHERE event_type = 'payment_completed'),
    COUNT(*) FILTER (WHERE event_type = 'payment_failed'),
    COALESCE(SUM(value_amount) FILTER (WHERE event_type = 'payment_completed'), 0)
  INTO v_payments_initiated, v_payments_completed, v_payments_failed, v_total_payment_amount
  FROM portal_analytics
  WHERE DATE(created_at) = p_date;

  -- Payment conversion rate
  v_payment_conversion_rate := CASE
    WHEN v_payments_initiated > 0
    THEN (v_payments_completed::numeric / v_payments_initiated * 100)
    ELSE 0
  END;

  -- Communication metrics
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'message_sent'),
    COUNT(*) FILTER (WHERE event_type = 'message_viewed')
  INTO v_messages_sent, v_messages_viewed
  FROM portal_analytics
  WHERE DATE(created_at) = p_date;

  -- Invoice metrics
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'invoice_viewed'),
    COUNT(*) FILTER (WHERE event_type = 'invoice_downloaded')
  INTO v_invoices_viewed, v_invoices_downloaded
  FROM portal_analytics
  WHERE DATE(created_at) = p_date;

  -- Notification metrics
  SELECT COUNT(*)
  INTO v_notifications_clicked
  FROM portal_analytics
  WHERE DATE(created_at) = p_date
    AND event_type = 'notification_clicked';

  -- Error count
  SELECT COUNT(*)
  INTO v_total_errors
  FROM portal_analytics
  WHERE DATE(created_at) = p_date
    AND event_type = 'error';

  -- Insert or update daily aggregation
  INSERT INTO portal_analytics_daily (
    date,
    new_registrations,
    total_active_users,
    unique_visitors,
    total_sessions,
    total_page_views,
    avg_pages_per_session,
    avg_session_duration_minutes,
    bookings_initiated,
    bookings_completed,
    bookings_cancelled,
    booking_conversion_rate,
    payments_initiated,
    payments_completed,
    payments_failed,
    payment_conversion_rate,
    total_payment_amount,
    messages_sent,
    messages_viewed,
    invoices_viewed,
    invoices_downloaded,
    notifications_clicked,
    total_errors
  ) VALUES (
    p_date,
    v_new_registrations,
    v_total_active_users,
    v_unique_visitors,
    v_total_sessions,
    v_total_page_views,
    v_avg_pages_per_session,
    v_avg_session_duration,
    v_bookings_initiated,
    v_bookings_completed,
    v_bookings_cancelled,
    v_booking_conversion_rate,
    v_payments_initiated,
    v_payments_completed,
    v_payments_failed,
    v_payment_conversion_rate,
    v_total_payment_amount,
    v_messages_sent,
    v_messages_viewed,
    v_invoices_viewed,
    v_invoices_downloaded,
    v_notifications_clicked,
    v_total_errors
  )
  ON CONFLICT (date) DO UPDATE SET
    new_registrations = EXCLUDED.new_registrations,
    total_active_users = EXCLUDED.total_active_users,
    unique_visitors = EXCLUDED.unique_visitors,
    total_sessions = EXCLUDED.total_sessions,
    total_page_views = EXCLUDED.total_page_views,
    avg_pages_per_session = EXCLUDED.avg_pages_per_session,
    avg_session_duration_minutes = EXCLUDED.avg_session_duration_minutes,
    bookings_initiated = EXCLUDED.bookings_initiated,
    bookings_completed = EXCLUDED.bookings_completed,
    bookings_cancelled = EXCLUDED.bookings_cancelled,
    booking_conversion_rate = EXCLUDED.booking_conversion_rate,
    payments_initiated = EXCLUDED.payments_initiated,
    payments_completed = EXCLUDED.payments_completed,
    payments_failed = EXCLUDED.payments_failed,
    payment_conversion_rate = EXCLUDED.payment_conversion_rate,
    total_payment_amount = EXCLUDED.total_payment_amount,
    messages_sent = EXCLUDED.messages_sent,
    messages_viewed = EXCLUDED.messages_viewed,
    invoices_viewed = EXCLUDED.invoices_viewed,
    invoices_downloaded = EXCLUDED.invoices_downloaded,
    notifications_clicked = EXCLUDED.notifications_clicked,
    total_errors = EXCLUDED.total_errors,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to get portal adoption rate
CREATE OR REPLACE FUNCTION get_portal_adoption_rate()
RETURNS TABLE (
  total_customers bigint,
  registered_portal_users bigint,
  adoption_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM portal_sessions ps WHERE ps.customer_id = c.id
    )) as registered_portal_users,
    ROUND(
      (COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM portal_sessions ps WHERE ps.customer_id = c.id
      ))::numeric / NULLIF(COUNT(*), 0) * 100),
      2
    ) as adoption_rate
  FROM customers c
  WHERE c.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE portal_analytics IS 'Raw event tracking for customer portal usage';
COMMENT ON TABLE portal_analytics_daily IS 'Daily aggregated portal analytics metrics';
COMMENT ON COLUMN portal_analytics.event_type IS 'Type of event being tracked';
COMMENT ON COLUMN portal_analytics.metadata IS 'Additional event-specific data (JSON)';
COMMENT ON COLUMN portal_analytics.value_amount IS 'Monetary value associated with event (bookings, payments)';
COMMENT ON FUNCTION aggregate_portal_analytics IS 'Aggregates portal analytics for a specific date';
COMMENT ON FUNCTION get_portal_adoption_rate IS 'Calculates percentage of customers using portal';
