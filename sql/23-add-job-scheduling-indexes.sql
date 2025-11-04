-- Migration 23: Add performance indexes for job scheduling features
-- Created: 2025-10-31
-- Purpose: Optimize queries for conflict detection, customer search, and invoice lookups

-- Index for last_service_date lookups (used in customer picker)
CREATE INDEX IF NOT EXISTS idx_customers_last_service_date
ON customers(last_service_date DESC NULLS LAST);

COMMENT ON INDEX idx_customers_last_service_date IS 'Optimizes customer search queries that filter/sort by last service date';

-- Composite index for technician scheduling conflict detection
-- Used by checkSchedulingConflict action
CREATE INDEX IF NOT EXISTS idx_jobs_technician_date_time
ON jobs(technician_id, scheduled_date, scheduled_time_start, scheduled_time_end)
WHERE status NOT IN ('cancelled', 'completed');

COMMENT ON INDEX idx_jobs_technician_date_time IS 'Optimizes scheduling conflict detection for active jobs';

-- Composite index for customer invoice lookups
-- Used by searchCustomers to find unpaid invoices
-- Invoice status enum values: 'draft', 'sent', 'paid', 'void'
-- Unpaid invoices are those with status 'draft' or 'sent'
CREATE INDEX IF NOT EXISTS idx_invoices_customer_status
ON invoices(customer_id, status)
WHERE status IN ('draft', 'sent');

COMMENT ON INDEX idx_invoices_customer_status IS 'Optimizes customer search queries that check for unpaid invoices (draft or sent)';

-- Index for job status filtering (used in zone board and other views)
CREATE INDEX IF NOT EXISTS idx_jobs_status_date
ON jobs(status, scheduled_date DESC)
WHERE scheduled_date IS NOT NULL;

COMMENT ON INDEX idx_jobs_status_date IS 'Optimizes job list queries filtered by status and sorted by date';

-- Analyze tables to update query planner statistics
ANALYZE customers;
ANALYZE jobs;
ANALYZE invoices;

-- Verify indexes were created
DO $$
DECLARE
  index_count INTEGER;
  expected_indexes TEXT[] := ARRAY[
    'idx_customers_last_service_date',
    'idx_jobs_technician_date_time',
    'idx_invoices_customer_status',
    'idx_jobs_status_date'
  ];
  missing_indexes TEXT[];
BEGIN
  -- Check which indexes exist
  SELECT ARRAY_AGG(index_name)
  FROM (
    SELECT unnest(expected_indexes) AS index_name
    EXCEPT
    SELECT indexname
    FROM pg_indexes
    WHERE indexname = ANY(expected_indexes)
  ) AS missing
  INTO missing_indexes;

  IF missing_indexes IS NULL THEN
    RAISE NOTICE 'Success: All % performance indexes created', array_length(expected_indexes, 1);
    RAISE NOTICE 'Indexes: %', array_to_string(expected_indexes, ', ');
  ELSE
    RAISE EXCEPTION 'Failed: Missing indexes: %', array_to_string(missing_indexes, ', ');
  END IF;

  -- Report index sizes
  FOR index_count IN
    SELECT 1
    FROM pg_indexes
    WHERE indexname = ANY(expected_indexes)
  LOOP
    NULL; -- Just count
  END LOOP;
END $$;

-- Display index usage statistics (helpful for monitoring)
SELECT
  schemaname,
  relname AS tablename,
  indexrelname AS indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexrelname IN (
  'idx_customers_last_service_date',
  'idx_jobs_technician_date_time',
  'idx_invoices_customer_status',
  'idx_jobs_status_date'
)
ORDER BY relname, indexrelname;
