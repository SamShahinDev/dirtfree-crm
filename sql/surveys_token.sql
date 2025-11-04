-- Idempotent migration to add survey token and status columns
-- Adds support for tokenized public survey links

-- Add token column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'satisfaction_surveys'
        AND column_name = 'token'
    ) THEN
        ALTER TABLE satisfaction_surveys
        ADD COLUMN token TEXT UNIQUE;

        -- Create index for efficient token lookups
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_satisfaction_surveys_token
        ON satisfaction_surveys(token)
        WHERE token IS NOT NULL;

        COMMENT ON COLUMN satisfaction_surveys.token IS 'Unique token for public survey access';
    END IF;
END
$$;

-- Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'satisfaction_surveys'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE satisfaction_surveys
        ADD COLUMN status TEXT CHECK (status IN ('pending', 'sent', 'responded')) DEFAULT 'sent';

        -- Create index for status filtering
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_satisfaction_surveys_status
        ON satisfaction_surveys(status);

        COMMENT ON COLUMN satisfaction_surveys.status IS 'Survey lifecycle status: pending, sent, or responded';
    END IF;
END
$$;

-- Add review_requested column if it doesn't exist (boolean flag for tracking review requests)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'satisfaction_surveys'
        AND column_name = 'review_requested'
    ) THEN
        ALTER TABLE satisfaction_surveys
        ADD COLUMN review_requested BOOLEAN DEFAULT FALSE;

        COMMENT ON COLUMN satisfaction_surveys.review_requested IS 'Whether customer was asked to leave a review';
    END IF;
END
$$;

-- Add sent_at column if it doesn't exist (timestamp when survey was sent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'satisfaction_surveys'
        AND column_name = 'sent_at'
    ) THEN
        ALTER TABLE satisfaction_surveys
        ADD COLUMN sent_at TIMESTAMPTZ;

        COMMENT ON COLUMN satisfaction_surveys.sent_at IS 'When the survey was sent to the customer';
    END IF;
END
$$;

-- Add responded_at column if it doesn't exist (timestamp when customer responded)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'satisfaction_surveys'
        AND column_name = 'responded_at'
    ) THEN
        ALTER TABLE satisfaction_surveys
        ADD COLUMN responded_at TIMESTAMPTZ;

        COMMENT ON COLUMN satisfaction_surveys.responded_at IS 'When the customer submitted the survey';
    END IF;
END
$$;

-- Update existing rows to have 'sent' status if they have a score (indicating they were completed)
UPDATE satisfaction_surveys
SET status = 'responded', responded_at = updated_at
WHERE status = 'sent' AND score IS NOT NULL AND responded_at IS NULL;

-- Add RLS policy for public survey token access
-- This allows public access to surveys via token but only for reading survey info and updating responses
DO $$
BEGIN
    -- Create policy for token-based public access (read)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'satisfaction_surveys'
        AND policyname = 'survey_token_read_access'
    ) THEN
        CREATE POLICY survey_token_read_access ON satisfaction_surveys
        FOR SELECT
        TO public
        USING (token IS NOT NULL);
    END IF;

    -- Create policy for token-based public access (update responses)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'satisfaction_surveys'
        AND policyname = 'survey_token_update_access'
    ) THEN
        CREATE POLICY survey_token_update_access ON satisfaction_surveys
        FOR UPDATE
        TO public
        USING (token IS NOT NULL AND status IN ('sent', 'pending'))
        WITH CHECK (status = 'responded');
    END IF;
END
$$;

-- Create a function to generate secure tokens
CREATE OR REPLACE FUNCTION generate_survey_token()
RETURNS TEXT AS $$
BEGIN
    -- Generate a cryptographically secure random token
    -- Using a combination of timestamp and random bytes for uniqueness
    RETURN encode(
        digest(
            extract(epoch from now())::text ||
            gen_random_bytes(32)::text,
            'sha256'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql;