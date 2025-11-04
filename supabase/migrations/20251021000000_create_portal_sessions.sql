-- Portal Sessions Table
-- Tracks customer portal authentication sessions
-- Created: 2025-10-21

-- Create portal_sessions table
CREATE TABLE IF NOT EXISTS portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  last_accessed_at timestamptz DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT portal_sessions_token_hash_unique UNIQUE (token_hash)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portal_sessions_customer
  ON portal_sessions(customer_id);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token_hash
  ON portal_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires
  ON portal_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_customer_active
  ON portal_sessions(customer_id, expires_at)
  WHERE expires_at > now();

-- Enable Row Level Security
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Customers can view only their own sessions
CREATE POLICY "Customers can view own sessions"
  ON portal_sessions
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.email()
    )
  );

-- Customers can delete their own sessions (logout)
CREATE POLICY "Customers can delete own sessions"
  ON portal_sessions
  FOR DELETE
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE email = auth.email()
    )
  );

-- Only authenticated users can insert sessions (via service role)
-- This prevents anonymous session creation
CREATE POLICY "Service role can insert sessions"
  ON portal_sessions
  FOR INSERT
  WITH CHECK (
    auth.jwt() IS NOT NULL
  );

-- Only service role can update sessions (for last_accessed_at)
CREATE POLICY "Service role can update sessions"
  ON portal_sessions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_portal_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM portal_sessions
  WHERE expires_at < now();
END;
$$;

-- Create function to update last_accessed_at
CREATE OR REPLACE FUNCTION update_portal_session_access(session_token_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE portal_sessions
  SET last_accessed_at = now()
  WHERE token_hash = session_token_hash
    AND expires_at > now();
END;
$$;

-- Add comment for documentation
COMMENT ON TABLE portal_sessions IS 'Stores customer portal authentication sessions for tracking and security';
COMMENT ON COLUMN portal_sessions.token_hash IS 'SHA-256 hash of the session token for secure lookup';
COMMENT ON COLUMN portal_sessions.ip_address IS 'IP address of the client when session was created';
COMMENT ON COLUMN portal_sessions.user_agent IS 'User agent string of the client browser';
COMMENT ON COLUMN portal_sessions.expires_at IS 'Session expiration timestamp';
COMMENT ON COLUMN portal_sessions.last_accessed_at IS 'Last time this session was used for authentication';
