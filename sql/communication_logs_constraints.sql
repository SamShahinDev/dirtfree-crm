-- Ensure provider_message_id is unique when present (for idempotency)
-- This migration is idempotent

-- Add unique constraint on provider_message_id for webhook idempotency
-- Only applies when provider_message_id is not null
alter table communication_logs
  add constraint if not exists communication_logs_provider_message_id_uniq
  unique (provider_message_id);

-- Add comment for documentation
comment on constraint communication_logs_provider_message_id_uniq on communication_logs
  is 'Ensures provider_message_id (like Twilio MessageSid) is unique for webhook idempotency';

-- Create index for faster provider_message_id lookups (if not already covered by unique constraint)
create index if not exists idx_communication_logs_provider_message_id
  on communication_logs (provider_message_id)
  where provider_message_id is not null;

-- Add comment for the column if not already present
comment on column communication_logs.provider_message_id
  is 'Unique identifier from SMS provider (e.g., Twilio MessageSid) for webhook idempotency';