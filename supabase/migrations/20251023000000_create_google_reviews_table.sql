-- Google Reviews Table Migration
-- Created: 2025-10-23
-- Purpose: Track Google My Business reviews and link them to CRM customers

-- Create google_reviews table
CREATE TABLE IF NOT EXISTS google_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_review_id VARCHAR(255) UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  review_request_id UUID REFERENCES review_requests(id) ON DELETE SET NULL,
  reviewer_name VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_manually BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_google_reviews_google_review_id ON google_reviews(google_review_id);
CREATE INDEX idx_google_reviews_customer_id ON google_reviews(customer_id);
CREATE INDEX idx_google_reviews_review_request_id ON google_reviews(review_request_id);
CREATE INDEX idx_google_reviews_posted_at ON google_reviews(posted_at DESC);
CREATE INDEX idx_google_reviews_rating ON google_reviews(rating);
CREATE INDEX idx_google_reviews_fetched_at ON google_reviews(fetched_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_google_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER google_reviews_updated_at
  BEFORE UPDATE ON google_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_google_reviews_updated_at();

-- Function: Get recent Google reviews with customer matching
CREATE OR REPLACE FUNCTION get_recent_google_reviews(
  days_back INTEGER DEFAULT 30,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  google_review_id VARCHAR(255),
  reviewer_name VARCHAR(255),
  rating INTEGER,
  review_text TEXT,
  posted_at TIMESTAMPTZ,
  customer_id UUID,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  review_request_id UUID,
  matched BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gr.id,
    gr.google_review_id,
    gr.reviewer_name,
    gr.rating,
    gr.review_text,
    gr.posted_at,
    gr.customer_id,
    c.full_name as customer_name,
    c.email as customer_email,
    gr.review_request_id,
    (gr.customer_id IS NOT NULL) as matched
  FROM google_reviews gr
  LEFT JOIN customers c ON gr.customer_id = c.id
  WHERE gr.posted_at >= NOW() - (days_back || ' days')::INTERVAL
  ORDER BY gr.posted_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get Google review statistics
CREATE OR REPLACE FUNCTION get_google_review_statistics(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_reviews INTEGER,
  average_rating NUMERIC,
  rating_5_count INTEGER,
  rating_4_count INTEGER,
  rating_3_count INTEGER,
  rating_2_count INTEGER,
  rating_1_count INTEGER,
  matched_count INTEGER,
  unmatched_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_reviews,
    ROUND(AVG(rating), 2) as average_rating,
    COUNT(CASE WHEN rating = 5 THEN 1 END)::INTEGER as rating_5_count,
    COUNT(CASE WHEN rating = 4 THEN 1 END)::INTEGER as rating_4_count,
    COUNT(CASE WHEN rating = 3 THEN 1 END)::INTEGER as rating_3_count,
    COUNT(CASE WHEN rating = 2 THEN 1 END)::INTEGER as rating_2_count,
    COUNT(CASE WHEN rating = 1 THEN 1 END)::INTEGER as rating_1_count,
    COUNT(CASE WHEN customer_id IS NOT NULL THEN 1 END)::INTEGER as matched_count,
    COUNT(CASE WHEN customer_id IS NULL THEN 1 END)::INTEGER as unmatched_count
  FROM google_reviews
  WHERE posted_at >= NOW() - (days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function: Match Google review to customer by name similarity
CREATE OR REPLACE FUNCTION match_google_review_to_customer(
  review_id UUID,
  customer_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  review_request UUID;
BEGIN
  -- Try to find review request from this customer with Google review requested
  SELECT rr.id INTO review_request
  FROM review_requests rr
  WHERE rr.customer_id = customer_id_param
    AND rr.google_review_requested = TRUE
    AND rr.google_review_completed = FALSE
  ORDER BY rr.requested_at DESC
  LIMIT 1;

  -- Update google_reviews with customer match
  UPDATE google_reviews
  SET
    customer_id = customer_id_param,
    review_request_id = review_request,
    matched_manually = TRUE,
    updated_at = NOW()
  WHERE id = review_id;

  -- If review request found, mark it as completed
  IF review_request IS NOT NULL THEN
    UPDATE review_requests
    SET
      google_review_completed = TRUE,
      google_review_completed_at = NOW()
    WHERE id = review_request;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON google_reviews TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_google_reviews(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_google_review_statistics(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION match_google_review_to_customer(UUID, UUID) TO authenticated;

-- Comments
COMMENT ON TABLE google_reviews IS 'Stores Google My Business reviews fetched via API or entered manually';
COMMENT ON COLUMN google_reviews.google_review_id IS 'Unique identifier from Google My Business API';
COMMENT ON COLUMN google_reviews.matched_manually IS 'TRUE if customer match was done manually by staff';
COMMENT ON FUNCTION get_recent_google_reviews IS 'Returns recent Google reviews with customer matching info';
COMMENT ON FUNCTION get_google_review_statistics IS 'Returns aggregated statistics for Google reviews';
COMMENT ON FUNCTION match_google_review_to_customer IS 'Links a Google review to a CRM customer and updates review request';
