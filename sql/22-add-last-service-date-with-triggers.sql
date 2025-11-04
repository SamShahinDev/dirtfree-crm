-- Migration 22: Add last_service_date to customers with automatic updates
-- Created: 2025-10-31
-- Purpose: Track customer's last service date for better context in job creation

-- Add last_service_date column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS last_service_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN customers.last_service_date IS 'Date of customer''s most recent completed service. Updated automatically via trigger.';

-- Create function to update last_service_date automatically
CREATE OR REPLACE FUNCTION update_customer_last_service_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update when a job is marked as completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE customers
    SET last_service_date = COALESCE(NEW.scheduled_date, CURRENT_DATE)
    WHERE id = NEW.customer_id;

    RAISE NOTICE 'Updated last_service_date for customer % to %', NEW.customer_id, COALESCE(NEW.scheduled_date, CURRENT_DATE);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment to function
COMMENT ON FUNCTION update_customer_last_service_date() IS 'Automatically updates customer.last_service_date when a job is marked as completed';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_last_service_date ON jobs;

-- Create trigger to automatically update last_service_date
CREATE TRIGGER trigger_update_last_service_date
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_last_service_date();

-- Backfill existing data: Update last_service_date for all customers based on completed jobs
UPDATE customers c
SET last_service_date = (
  SELECT MAX(j.scheduled_date)
  FROM jobs j
  WHERE j.customer_id = c.id
  AND j.status = 'completed'
  AND j.scheduled_date IS NOT NULL
)
WHERE EXISTS (
  SELECT 1
  FROM jobs j
  WHERE j.customer_id = c.id
  AND j.status = 'completed'
  AND j.scheduled_date IS NOT NULL
);

-- Verify the column and trigger were created
DO $$
DECLARE
  column_exists BOOLEAN;
  trigger_exists BOOLEAN;
  backfill_count INTEGER;
BEGIN
  -- Check column
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customers'
    AND column_name = 'last_service_date'
  ) INTO column_exists;

  -- Check trigger
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE trigger_name = 'trigger_update_last_service_date'
  ) INTO trigger_exists;

  -- Count backfilled records
  SELECT COUNT(*)
  FROM customers
  WHERE last_service_date IS NOT NULL
  INTO backfill_count;

  IF column_exists AND trigger_exists THEN
    RAISE NOTICE 'Success: last_service_date column, trigger, and function created';
    RAISE NOTICE 'Backfilled % customer records with last_service_date', backfill_count;
  ELSE
    IF NOT column_exists THEN
      RAISE EXCEPTION 'Failed: last_service_date column was not added';
    END IF;
    IF NOT trigger_exists THEN
      RAISE EXCEPTION 'Failed: trigger_update_last_service_date was not created';
    END IF;
  END IF;
END $$;
