-- Performance Optimization Indexes for Dirt Free CRM
-- Run this script to add performance indexes to your database

-- ============================================================================
-- Customer queries optimization
-- ============================================================================

-- Index for zone-based filtering
CREATE INDEX IF NOT EXISTS idx_customers_zone
ON customers(zone)
WHERE zone IS NOT NULL;

-- Index for date-based sorting and filtering
CREATE INDEX IF NOT EXISTS idx_customers_created_at
ON customers(created_at DESC);

-- Index for email lookups (unique already creates an index)
CREATE INDEX IF NOT EXISTS idx_customers_email_lower
ON customers(LOWER(email))
WHERE email IS NOT NULL;

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone
ON customers(phone_e164)
WHERE phone_e164 IS NOT NULL;

-- Full text search index for customer name
CREATE INDEX IF NOT EXISTS idx_customers_name_gin
ON customers USING gin(to_tsvector('english', name));

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_customers_status_zone
ON customers(deleted_at, zone)
WHERE deleted_at IS NULL;

-- ============================================================================
-- Jobs/Services queries optimization
-- ============================================================================

-- Index for customer relationship queries
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id
ON jobs(customer_id, scheduled_date DESC)
WHERE deleted_at IS NULL;

-- Index for technician assignment queries
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to
ON jobs(assigned_to, scheduled_date, status)
WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;

-- Index for scheduling queries
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date
ON jobs(scheduled_date, status)
WHERE scheduled_date IS NOT NULL AND deleted_at IS NULL;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_jobs_status
ON jobs(status, scheduled_date DESC)
WHERE deleted_at IS NULL;

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_jobs_dashboard
ON jobs(status, scheduled_date, assigned_to, customer_id)
WHERE deleted_at IS NULL;

-- Index for today's jobs
CREATE INDEX IF NOT EXISTS idx_jobs_today
ON jobs(scheduled_date)
WHERE scheduled_date >= CURRENT_DATE
  AND scheduled_date < CURRENT_DATE + INTERVAL '1 day'
  AND deleted_at IS NULL;

-- ============================================================================
-- Invoice queries optimization
-- ============================================================================

-- Index for customer invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id
ON invoices(customer_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for job-related invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_job_id
ON invoices(job_id)
WHERE job_id IS NOT NULL AND deleted_at IS NULL;

-- Index for payment status queries
CREATE INDEX IF NOT EXISTS idx_invoices_status
ON invoices(status, due_date)
WHERE deleted_at IS NULL;

-- Index for overdue invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_overdue
ON invoices(due_date, status)
WHERE status != 'paid'
  AND due_date < CURRENT_DATE
  AND deleted_at IS NULL;

-- Index for invoice number lookups
CREATE INDEX IF NOT EXISTS idx_invoices_number
ON invoices(invoice_number)
WHERE deleted_at IS NULL;

-- ============================================================================
-- Vehicle Board (Truck threads) optimization
-- ============================================================================

-- Index for truck thread listings
CREATE INDEX IF NOT EXISTS idx_truck_threads_truck_id
ON truck_threads(truck_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for thread status filtering
CREATE INDEX IF NOT EXISTS idx_truck_threads_status
ON truck_threads(truck_id, status, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for thread posts
CREATE INDEX IF NOT EXISTS idx_truck_posts_thread_id
ON truck_posts(thread_id, created_at)
WHERE deleted_at IS NULL;

-- Index for urgent posts
CREATE INDEX IF NOT EXISTS idx_truck_posts_urgent
ON truck_posts(thread_id, urgent, created_at)
WHERE urgent = true AND deleted_at IS NULL;

-- ============================================================================
-- Communication and Activity logs optimization
-- ============================================================================

-- Index for customer communication history
CREATE INDEX IF NOT EXISTS idx_communication_logs_customer
ON communication_logs(customer_id, created_at DESC);

-- Index for communication type filtering
CREATE INDEX IF NOT EXISTS idx_communication_logs_type
ON communication_logs(type, created_at DESC);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
ON audit_log(entity, entity_id, created_at DESC);

-- Index for user activity tracking
CREATE INDEX IF NOT EXISTS idx_audit_log_actor
ON audit_log(actor_id, created_at DESC);

-- ============================================================================
-- Service history optimization
-- ============================================================================

-- Index for customer service history
CREATE INDEX IF NOT EXISTS idx_service_history_customer
ON service_history(customer_id, completed_at DESC)
WHERE deleted_at IS NULL;

-- Index for recent services
CREATE INDEX IF NOT EXISTS idx_service_history_recent
ON service_history(completed_at DESC)
WHERE completed_at IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- Technician/User queries optimization
-- ============================================================================

-- Index for active technicians
CREATE INDEX IF NOT EXISTS idx_technicians_active
ON technicians(is_active, user_id)
WHERE is_active = true;

-- Index for user email lookups
CREATE INDEX IF NOT EXISTS idx_users_email
ON users(LOWER(email))
WHERE deleted_at IS NULL;

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role, is_active)
WHERE deleted_at IS NULL;

-- ============================================================================
-- Analyze tables for query planner optimization
-- ============================================================================

ANALYZE customers;
ANALYZE jobs;
ANALYZE invoices;
ANALYZE truck_threads;
ANALYZE truck_posts;
ANALYZE communication_logs;
ANALYZE audit_log;
ANALYZE service_history;
ANALYZE technicians;
ANALYZE users;

-- ============================================================================
-- Performance monitoring views
-- ============================================================================

-- Create a view for monitoring slow queries
CREATE OR REPLACE VIEW performance_slow_queries AS
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking more than 100ms on average
ORDER BY mean_time DESC
LIMIT 50;

-- Create a view for monitoring index usage
CREATE OR REPLACE VIEW performance_index_usage AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Create a view for monitoring table sizes
CREATE OR REPLACE VIEW performance_table_sizes AS
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;