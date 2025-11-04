-- Background Jobs Table
-- Stores job queue entries for monitoring and persistence

CREATE TABLE IF NOT EXISTS background_jobs (
  id TEXT PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled 
  ON background_jobs(status, scheduled_for)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_jobs_type_status 
  ON background_jobs(job_type, status);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at 
  ON background_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_priority 
  ON background_jobs(priority DESC, scheduled_for ASC)
  WHERE status = 'pending';

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS
'
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
' LANGUAGE plpgsql;

CREATE TRIGGER update_background_jobs_updated_at 
  BEFORE UPDATE ON background_jobs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to background_jobs"
  ON background_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin users can view jobs
CREATE POLICY "Admins can view all jobs"
  ON background_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Comments
COMMENT ON TABLE background_jobs IS 'Queue for background job processing with priority and retry support';
COMMENT ON COLUMN background_jobs.job_type IS 'Type of job to be processed';
COMMENT ON COLUMN background_jobs.payload IS 'Job-specific data as JSON';
COMMENT ON COLUMN background_jobs.status IS 'Current status: pending, processing, completed, failed';
COMMENT ON COLUMN background_jobs.priority IS 'Job priority (1-10, higher = more important)';
COMMENT ON COLUMN background_jobs.retry_count IS 'Number of times this job has been retried';
COMMENT ON COLUMN background_jobs.max_retries IS 'Maximum number of retry attempts';
COMMENT ON COLUMN background_jobs.scheduled_for IS 'When this job should be processed';
COMMENT ON COLUMN background_jobs.started_at IS 'When processing began';
COMMENT ON COLUMN background_jobs.completed_at IS 'When processing finished (success or failure)';
COMMENT ON COLUMN background_jobs.error_message IS 'Error message if job failed';
