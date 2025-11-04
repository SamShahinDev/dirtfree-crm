-- Performance indexes for satisfaction surveys reporting
-- These indexes optimize common query patterns for the reports dashboard

-- Index for sorting by response date (latest responses)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surveys_responded_at
ON satisfaction_surveys (responded_at DESC NULLS LAST);

-- Index for job lookups (joining to jobs for technician/zone info)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surveys_job_id
ON satisfaction_surveys (job_id);

-- Index for customer lookups (joining to customers for reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surveys_customer_id
ON satisfaction_surveys (customer_id);

-- Composite index for status-based queries (filtering by response status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surveys_status_responded_at
ON satisfaction_surveys (status, responded_at DESC NULLS LAST);

-- Index for score-based filtering (finding negative scores)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surveys_score_status
ON satisfaction_surveys (score, status)
WHERE score IS NOT NULL;

-- Index for KPI calculations by date ranges
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surveys_dates_status
ON satisfaction_surveys (sent_at, responded_at, status);

-- Composite index for follow-up reminder lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reminders_job_customer_type_status
ON reminders (job_id, customer_id, type, status);

-- Add comments for documentation
COMMENT ON INDEX idx_surveys_responded_at IS 'Optimizes sorting by response date for latest responses table';
COMMENT ON INDEX idx_surveys_job_id IS 'Optimizes joins with jobs table for technician/zone filtering';
COMMENT ON INDEX idx_surveys_customer_id IS 'Optimizes joins with customers table for reporting';
COMMENT ON INDEX idx_surveys_status_responded_at IS 'Optimizes filtering by status with date sorting';
COMMENT ON INDEX idx_surveys_score_status IS 'Optimizes filtering negative scores for unresolved queue';
COMMENT ON INDEX idx_surveys_dates_status IS 'Optimizes KPI calculations across date ranges';
COMMENT ON INDEX idx_reminders_job_customer_type_status IS 'Optimizes follow-up reminder lookups for unresolved negatives';