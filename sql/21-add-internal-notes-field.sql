-- Migration 21: Add internal_notes field to jobs table
-- Created: 2025-10-31
-- Purpose: Support internal notes that are not visible to customers

-- Add internal_notes column to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN jobs.internal_notes IS 'Internal notes not visible to customers. Used for access codes, special instructions, equipment needs, etc.';

-- Verify the column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'jobs'
    AND column_name = 'internal_notes'
  ) THEN
    RAISE NOTICE 'Success: internal_notes column added to jobs table';
  ELSE
    RAISE EXCEPTION 'Failed: internal_notes column was not added';
  END IF;
END $$;
