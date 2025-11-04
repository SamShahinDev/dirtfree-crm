# Database Migrations Log

This directory contains SQL migration files for the Dirt Free CRM database schema.

## Migration Naming Convention

Migrations are numbered sequentially: `NN-description.sql`

## How to Run Migrations

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste and execute in the SQL Editor
5. Verify success messages in the output
6. Mark the migration as complete in this log

## Migrations

### Migration 21: Add internal_notes field
**File:** `21-add-internal-notes-field.sql`
**Date:** 2025-10-31
**Status:** ⏳ Pending
**Purpose:** Add internal_notes column to jobs table for dispatcher notes not visible to customers

**Changes:**
- Add `internal_notes TEXT` column to `jobs` table
- Add column comment for documentation
- Verification script included

**Dependencies:** None

**Rollback:**
```sql
ALTER TABLE jobs DROP COLUMN IF EXISTS internal_notes;
```

---

### Migration 22: Add last_service_date with automatic updates
**File:** `22-add-last-service-date-with-triggers.sql`
**Date:** 2025-10-31
**Status:** ⏳ Pending
**Purpose:** Track customer's most recent service date with automatic updates via trigger

**Changes:**
- Add `last_service_date DATE` column to `customers` table
- Create `update_customer_last_service_date()` function
- Create trigger `trigger_update_last_service_date` on jobs table
- Backfill existing data from completed jobs
- Verification script included

**Dependencies:** None

**Rollback:**
```sql
DROP TRIGGER IF EXISTS trigger_update_last_service_date ON jobs;
DROP FUNCTION IF EXISTS update_customer_last_service_date();
ALTER TABLE customers DROP COLUMN IF EXISTS last_service_date;
```

---

### Migration 23: Add job scheduling performance indexes
**File:** `23-add-job-scheduling-indexes.sql`
**Date:** 2025-10-31
**Status:** ⏳ Pending
**Purpose:** Optimize queries for scheduling conflict detection, customer search, and invoice lookups

**Changes:**
- Add `idx_customers_last_service_date` - for customer search by last service
- Add `idx_jobs_technician_date_time` - for scheduling conflict detection
- Add `idx_invoices_customer_status` - for unpaid invoice lookups
- Add `idx_jobs_status_date` - for job list filtering
- Include ANALYZE statements for query planner
- Verification and size reporting scripts included

**Dependencies:** Migration 22 (for last_service_date column)

**Rollback:**
```sql
DROP INDEX IF EXISTS idx_customers_last_service_date;
DROP INDEX IF EXISTS idx_jobs_technician_date_time;
DROP INDEX IF EXISTS idx_invoices_customer_status;
DROP INDEX IF EXISTS idx_jobs_status_date;
```

---

## Running Instructions

### Option 1: Run All Three Migrations Together

If you haven't run any of these migrations yet, you can run them all in sequence:

1. Open Supabase SQL Editor
2. Run Migration 21
3. Wait for success message
4. Run Migration 22
5. Wait for success message and note backfill count
6. Run Migration 23
7. Wait for success message and note index sizes
8. Update this log with ✅ status and timestamp

### Option 2: Run Individually

Run each migration file separately and verify after each one.

## Verification Queries

After running all migrations, verify the changes:

```sql
-- Check internal_notes column exists
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'internal_notes';

-- Check last_service_date column and trigger
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'customers' AND column_name = 'last_service_date';

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_last_service_date';

-- Check indexes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexname IN (
  'idx_customers_last_service_date',
  'idx_jobs_technician_date_time',
  'idx_invoices_customer_status',
  'idx_jobs_status_date'
)
ORDER BY tablename, indexname;

-- Count customers with last_service_date
SELECT
  COUNT(*) AS total_customers,
  COUNT(last_service_date) AS customers_with_service_date,
  ROUND(COUNT(last_service_date)::NUMERIC / COUNT(*) * 100, 2) AS percentage
FROM customers;
```

## Notes

- All migrations include verification scripts that will raise notices or errors
- Migration 22 includes a backfill script for existing data
- Migration 23 depends on Migration 22 being run first
- Indexes are created with `IF NOT EXISTS` to allow safe re-runs
- All migrations are idempotent (safe to run multiple times)

## Related Code Changes

These migrations support the following features:

- **Internal Notes Field**: JobDialog component now has separate customer-facing and internal notes
- **Customer History Context**: Customer picker shows job count and last service date
- **Scheduling Conflict Detection**: Real-time validation prevents double-booking
- **Validation Warnings**: Alerts for weekend, after-hours, or far-future scheduling

**Application Commit:** ce52c28 - "feat(job-dialog): add internal notes field and scheduling validation warnings"
