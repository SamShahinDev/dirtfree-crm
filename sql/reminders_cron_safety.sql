-- Add safety fields for cron job processing and concurrent-safe locking
-- This migration is idempotent

-- Add locked_at for concurrent processing safety
alter table reminders add column if not exists locked_at timestamptz;

-- Add last_attempt_at to track when we last tried to send
alter table reminders add column if not exists last_attempt_at timestamptz;

-- Add attempt_count to track retry attempts
alter table reminders add column if not exists attempt_count int not null default 0;

-- Create index for efficient due reminder queries
create index if not exists idx_reminders_due on reminders (scheduled_date, status);

-- Create index for locked reminders (cleanup queries)
create index if not exists idx_reminders_locked on reminders (locked_at) where locked_at is not null;

-- Add comment for documentation
comment on column reminders.locked_at is 'Timestamp when this reminder was locked for processing';
comment on column reminders.last_attempt_at is 'Timestamp of the last send attempt';
comment on column reminders.attempt_count is 'Number of times we have attempted to send this reminder';