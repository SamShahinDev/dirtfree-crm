-- Phase 8: Reminders Inbox enhancements
-- Add missing columns and constraints for reminders inbox functionality

-- First, check if we need to add any missing columns
DO $$
BEGIN
  -- Add completed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reminders' AND column_name='completed_at'
  ) THEN
    ALTER TABLE reminders ADD COLUMN completed_at timestamptz;
  END IF;

  -- Add assigned_to column if it doesn't exist (maps to assigned_user_id but with consistent naming)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reminders' AND column_name='assigned_to'
  ) THEN
    ALTER TABLE reminders ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

    -- Migrate existing data from assigned_user_id if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='reminders' AND column_name='assigned_user_id'
    ) THEN
      UPDATE reminders SET assigned_to = assigned_user_id WHERE assigned_user_id IS NOT NULL;
    END IF;
  END IF;
END
$$;

-- Create unique index to prevent duplicate follow-up reminders per job
-- This ensures job completion follow-ups are idempotent
CREATE UNIQUE INDEX IF NOT EXISTS uniq_followup_per_job
ON reminders (job_id)
WHERE origin='tech_post_complete' AND type='follow_up' AND status != 'cancelled';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_reminders_status_scheduled ON reminders (status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_reminders_assigned_to ON reminders (assigned_to);
CREATE INDEX IF NOT EXISTS idx_reminders_snoozed_until ON reminders (snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_type_origin ON reminders (type, origin);
CREATE INDEX IF NOT EXISTS idx_reminders_customer_job ON reminders (customer_id, job_id);

-- Create index for reminder comments
CREATE INDEX IF NOT EXISTS idx_reminder_comments_reminder_id ON reminder_comments (reminder_id);
CREATE INDEX IF NOT EXISTS idx_reminder_comments_created_at ON reminder_comments (created_at DESC);

-- Add constraint to ensure snoozed_until is in the future when set
ALTER TABLE reminders DROP CONSTRAINT IF EXISTS check_snoozed_until_future;
ALTER TABLE reminders ADD CONSTRAINT check_snoozed_until_future
CHECK (snoozed_until IS NULL OR snoozed_until > created_at);

-- Update the status check constraint to include the correct values
ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_status_check;
ALTER TABLE reminders ADD CONSTRAINT reminders_status_check
CHECK (status IN ('pending', 'snoozed', 'complete', 'canceled'));

-- Function to check if a reminder should be visible (not snoozed)
CREATE OR REPLACE FUNCTION is_reminder_visible(reminder_record reminders)
RETURNS boolean AS $$
BEGIN
  -- Show if not snoozed or if snooze has expired
  RETURN (
    reminder_record.snoozed_until IS NULL
    OR reminder_record.snoozed_until <= NOW()
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to automatically update status from snoozed to pending when snooze expires
-- This can be called by a cron job or trigger
CREATE OR REPLACE FUNCTION unsnoose_expired_reminders()
RETURNS int AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE reminders
  SET
    status = 'pending',
    snoozed_until = NULL,
    updated_at = NOW()
  WHERE
    status = 'snoozed'
    AND snoozed_until IS NOT NULL
    AND snoozed_until <= NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for new functionality
COMMENT ON COLUMN reminders.completed_at IS 'Timestamp when reminder was marked complete';
COMMENT ON COLUMN reminders.assigned_to IS 'User assigned to handle this reminder';
COMMENT ON INDEX uniq_followup_per_job IS 'Prevents duplicate follow-up reminders per job completion';
COMMENT ON FUNCTION is_reminder_visible IS 'Returns true if reminder should be visible (not snoozed or snooze expired)';
COMMENT ON FUNCTION unsnoose_expired_reminders IS 'Updates expired snoozed reminders back to pending status';