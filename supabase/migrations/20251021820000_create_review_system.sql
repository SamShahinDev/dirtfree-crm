-- =====================================================
-- Review Management System Migration
-- =====================================================
-- Creates tables and functions for managing customer reviews
-- Supports portal reviews (internal feedback) and Google reviews

-- Drop existing objects if they exist
DROP TABLE IF EXISTS review_responses CASCADE;
DROP TABLE IF EXISTS review_requests CASCADE;
DROP INDEX IF EXISTS idx_review_requests_customer;
DROP INDEX IF EXISTS idx_review_requests_status;
DROP INDEX IF EXISTS idx_review_requests_job;
DROP INDEX IF EXISTS idx_review_responses_request;
DROP FUNCTION IF EXISTS get_review_statistics();
DROP FUNCTION IF EXISTS get_pending_review_requests();

-- =====================================================
-- Review Requests Table
-- =====================================================
CREATE TABLE IF NOT EXISTS review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  -- Request tracking
  requested_at timestamp NOT NULL DEFAULT NOW(),
  request_method varchar(20) CHECK (request_method IN ('portal', 'email', 'sms')),

  -- Portal review (internal feedback)
  portal_review_completed boolean NOT NULL DEFAULT false,
  portal_review_rating integer CHECK (portal_review_rating BETWEEN 1 AND 5),
  portal_review_text text,
  portal_review_submitted_at timestamp,

  -- Google review
  google_review_requested boolean NOT NULL DEFAULT false,
  google_review_link_clicked boolean NOT NULL DEFAULT false,
  google_review_clicked_at timestamp,
  google_review_completed boolean NOT NULL DEFAULT false,
  google_review_completed_at timestamp,

  -- Follow-up
  reminder_sent boolean NOT NULL DEFAULT false,
  reminder_sent_at timestamp,

  -- Status tracking
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'portal_completed', 'google_completed', 'expired', 'opted_out')),

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),

  UNIQUE(customer_id, job_id)
);

-- =====================================================
-- Review Responses Table
-- =====================================================
CREATE TABLE IF NOT EXISTS review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id uuid NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,

  -- Response details
  response_type varchar(20) NOT NULL CHECK (response_type IN ('thank_you', 'issue_follow_up', 'general')),
  response_text text NOT NULL,

  -- Response tracking
  responded_by_user_id uuid REFERENCES users(id),
  sent_at timestamp NOT NULL DEFAULT NOW(),

  -- Delivery tracking
  delivery_method varchar(20) CHECK (delivery_method IN ('email', 'sms', 'phone', 'portal')),
  delivery_status varchar(20),

  created_at timestamp NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX idx_review_requests_customer ON review_requests(customer_id);
CREATE INDEX idx_review_requests_status ON review_requests(status);
CREATE INDEX idx_review_requests_job ON review_requests(job_id);
CREATE INDEX idx_review_requests_requested ON review_requests(requested_at DESC);
CREATE INDEX idx_review_requests_portal_rating ON review_requests(portal_review_rating) WHERE portal_review_rating IS NOT NULL;

CREATE INDEX idx_review_responses_request ON review_responses(review_request_id);
CREATE INDEX idx_review_responses_sent ON review_responses(sent_at DESC);

-- =====================================================
-- Updated At Trigger
-- =====================================================
CREATE TRIGGER set_updated_at_review_requests
  BEFORE UPDATE ON review_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Auto-update Status Trigger Function
-- =====================================================
CREATE OR REPLACE FUNCTION update_review_request_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update status based on completion
  IF NEW.google_review_completed = true THEN
    NEW.status := 'google_completed';
  ELSIF NEW.portal_review_completed = true AND NEW.google_review_requested = false THEN
    NEW.status := 'portal_completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_review_status
  BEFORE UPDATE ON review_requests
  FOR EACH ROW
  WHEN (OLD.status = 'pending')
  EXECUTE FUNCTION update_review_request_status();

-- =====================================================
-- Get Review Statistics Function
-- =====================================================
CREATE OR REPLACE FUNCTION get_review_statistics()
RETURNS TABLE (
  total_requests bigint,
  pending_requests bigint,
  portal_completed bigint,
  google_completed bigint,
  average_portal_rating numeric,
  completion_rate numeric,
  google_click_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_requests,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_requests,
    COUNT(*) FILTER (WHERE portal_review_completed = true)::bigint as portal_completed,
    COUNT(*) FILTER (WHERE google_review_completed = true)::bigint as google_completed,
    ROUND(AVG(portal_review_rating), 2) as average_portal_rating,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE portal_review_completed = true OR google_review_completed = true)::numeric / COUNT(*) * 100), 2)
      ELSE 0
    END as completion_rate,
    CASE
      WHEN COUNT(*) FILTER (WHERE google_review_requested = true) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE google_review_link_clicked = true)::numeric / COUNT(*) FILTER (WHERE google_review_requested = true) * 100), 2)
      ELSE 0
    END as google_click_rate
  FROM review_requests;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Get Pending Review Requests Function
-- =====================================================
CREATE OR REPLACE FUNCTION get_pending_review_requests(days_old integer DEFAULT 3)
RETURNS TABLE (
  request_id uuid,
  customer_id uuid,
  customer_name varchar,
  customer_email varchar,
  job_id uuid,
  requested_at timestamp,
  days_pending integer,
  reminder_sent boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rr.id as request_id,
    rr.customer_id,
    c.full_name as customer_name,
    c.email as customer_email,
    rr.job_id,
    rr.requested_at,
    DATE_PART('day', NOW() - rr.requested_at)::integer as days_pending,
    rr.reminder_sent
  FROM review_requests rr
  JOIN customers c ON rr.customer_id = c.id
  WHERE rr.status = 'pending'
    AND rr.requested_at < NOW() - INTERVAL '1 day' * days_old
    AND (rr.reminder_sent = false OR rr.reminder_sent_at < NOW() - INTERVAL '7 days')
  ORDER BY rr.requested_at ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Get Customer Review History Function
-- =====================================================
CREATE OR REPLACE FUNCTION get_customer_review_history(p_customer_id uuid)
RETURNS TABLE (
  request_id uuid,
  job_id uuid,
  requested_at timestamp,
  portal_completed boolean,
  portal_rating integer,
  google_completed boolean,
  status varchar
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rr.id as request_id,
    rr.job_id,
    rr.requested_at,
    rr.portal_review_completed as portal_completed,
    rr.portal_review_rating as portal_rating,
    rr.google_review_completed as google_completed,
    rr.status
  FROM review_requests rr
  WHERE rr.customer_id = p_customer_id
  ORDER BY rr.requested_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

-- Customers can view their own review requests
CREATE POLICY "Customers can view own review requests"
  ON review_requests
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  );

-- Customers can update their own review requests (submit reviews)
CREATE POLICY "Customers can update own review requests"
  ON review_requests
  FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  );

-- Staff can view all review requests
CREATE POLICY "Staff can view all review requests"
  ON review_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Staff can manage all review requests
CREATE POLICY "Staff can manage review requests"
  ON review_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Staff can view all review responses
CREATE POLICY "Staff can view review responses"
  ON review_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Staff can create review responses
CREATE POLICY "Staff can create review responses"
  ON review_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Service role can manage all
CREATE POLICY "Service role can manage review requests"
  ON review_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage review responses"
  ON review_responses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE review_requests IS 'Tracks customer review requests for both portal (internal) and Google reviews';
COMMENT ON TABLE review_responses IS 'Staff responses to customer reviews (thank you messages, issue follow-ups)';
COMMENT ON FUNCTION get_review_statistics IS 'Returns overall review system statistics';
COMMENT ON FUNCTION get_pending_review_requests IS 'Returns review requests needing follow-up';
COMMENT ON FUNCTION get_customer_review_history IS 'Returns review history for a specific customer';
