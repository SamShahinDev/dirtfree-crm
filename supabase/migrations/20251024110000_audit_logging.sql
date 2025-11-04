-- Security Audit Logging
-- Comprehensive audit trail system for compliance and security

-- ============================================================================
-- 1. Update Audit Log Table (if exists) or Create New
-- ============================================================================

-- Drop existing table if present (adjust based on your needs)
-- drop table if exists audit_log cascade;

-- Create comprehensive audit_logs table
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),

  -- Action details
  action varchar(100) not null,
  status varchar(20) check (status in ('success', 'failure', 'warning')) not null,
  severity varchar(20) check (severity in ('low', 'medium', 'high', 'critical')) not null,

  -- User and resource context
  user_id uuid references auth.users(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  resource_type varchar(100),
  resource_id uuid,

  -- Request metadata
  ip_address inet,
  user_agent text,

  -- Additional context
  details jsonb default '{}'::jsonb,
  error_message text,
  duration_ms integer,

  -- Timestamp
  created_at timestamptz default now() not null
);

-- ============================================================================
-- 2. Indexes for Performance
-- ============================================================================

-- Primary query patterns
create index if not exists audit_logs_created_at_idx
  on audit_logs(created_at desc);

create index if not exists audit_logs_user_id_idx
  on audit_logs(user_id, created_at desc);

create index if not exists audit_logs_customer_id_idx
  on audit_logs(customer_id, created_at desc);

create index if not exists audit_logs_action_idx
  on audit_logs(action);

create index if not exists audit_logs_status_idx
  on audit_logs(status);

create index if not exists audit_logs_severity_idx
  on audit_logs(severity);

-- Composite indexes for common filters
create index if not exists audit_logs_action_created_at_idx
  on audit_logs(action, created_at desc);

create index if not exists audit_logs_severity_created_at_idx
  on audit_logs(severity, created_at desc);

create index if not exists audit_logs_status_created_at_idx
  on audit_logs(status, created_at desc);

-- GIN index for JSONB details
create index if not exists audit_logs_details_idx
  on audit_logs using gin(details);

-- ============================================================================
-- 3. Security Alerts View
-- ============================================================================

create or replace view security_alerts as
select
  action,
  user_id,
  count(*) as occurrence_count,
  max(created_at) as last_occurrence,
  array_agg(distinct ip_address) filter (where ip_address is not null) as ip_addresses,
  array_agg(distinct error_message) filter (where error_message is not null) as error_messages
from audit_logs
where
  severity in ('high', 'critical')
  and created_at > now() - interval '24 hours'
group by action, user_id
having count(*) > 3
order by occurrence_count desc;

comment on view security_alerts is 'Detects suspicious patterns in audit logs';

-- ============================================================================
-- 4. Failed Login Attempts View
-- ============================================================================

create or replace view failed_login_attempts as
select
  user_id,
  ip_address,
  count(*) as attempt_count,
  max(created_at) as last_attempt,
  array_agg(created_at order by created_at desc) as attempt_timestamps
from audit_logs
where
  action = 'login_failed'
  and created_at > now() - interval '1 hour'
group by user_id, ip_address
having count(*) >= 3
order by attempt_count desc, last_attempt desc;

comment on view failed_login_attempts is 'Tracks repeated failed login attempts';

-- ============================================================================
-- 5. User Activity Summary View
-- ============================================================================

create or replace view user_activity_summary as
select
  user_id,
  count(*) as total_actions,
  count(*) filter (where status = 'success') as successful_actions,
  count(*) filter (where status = 'failure') as failed_actions,
  count(*) filter (where severity = 'critical') as critical_actions,
  max(created_at) as last_activity,
  min(created_at) as first_activity
from audit_logs
where created_at > now() - interval '30 days'
group by user_id;

comment on view user_activity_summary is 'Summarizes user activity over the last 30 days';

-- ============================================================================
-- 6. Helper Functions
-- ============================================================================

-- Function to get recent audit logs for a user
create or replace function get_user_audit_logs(
  p_user_id uuid,
  p_limit integer default 100
)
returns setof audit_logs
language sql
stable
as $$
  select *
  from audit_logs
  where user_id = p_user_id
  order by created_at desc
  limit p_limit;
$$;

comment on function get_user_audit_logs is 'Get recent audit logs for a specific user';

-- Function to get suspicious activity count
create or replace function get_suspicious_activity_count(
  p_user_id uuid,
  p_hours integer default 24
)
returns bigint
language sql
stable
as $$
  select count(*)
  from audit_logs
  where user_id = p_user_id
    and severity in ('high', 'critical')
    and created_at > now() - (p_hours || ' hours')::interval;
$$;

comment on function get_suspicious_activity_count is 'Count suspicious activities for a user';

-- Function to get action frequency
create or replace function get_action_frequency(
  p_action varchar,
  p_hours integer default 24
)
returns table (
  user_id uuid,
  action_count bigint,
  last_occurrence timestamptz
)
language sql
stable
as $$
  select
    user_id,
    count(*) as action_count,
    max(created_at) as last_occurrence
  from audit_logs
  where action = p_action
    and created_at > now() - (p_hours || ' hours')::interval
  group by user_id
  order by action_count desc;
$$;

comment on function get_action_frequency is 'Get frequency of specific action by user';

-- ============================================================================
-- 7. RLS Policies
-- ============================================================================

-- Enable RLS
alter table audit_logs enable row level security;

-- Admins can view all audit logs
create policy "Admins can view all audit logs"
  on audit_logs for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.user_id = auth.uid()
      and user_profiles.role = 'admin'
    )
  );

-- Users can view their own audit logs
create policy "Users can view their own audit logs"
  on audit_logs for select
  using (user_id = auth.uid());

-- Service role can insert audit logs
create policy "Service role can insert audit logs"
  on audit_logs for insert
  with check (true);

-- Prevent updates and deletes (audit logs are immutable)
create policy "Audit logs are immutable"
  on audit_logs for update
  using (false);

create policy "Audit logs cannot be deleted"
  on audit_logs for delete
  using (false);

-- ============================================================================
-- 8. Grants
-- ============================================================================

grant select on audit_logs to authenticated;
grant insert on audit_logs to authenticated;

grant select on security_alerts to authenticated;
grant select on failed_login_attempts to authenticated;
grant select on user_activity_summary to authenticated;

grant execute on function get_user_audit_logs to authenticated;
grant execute on function get_suspicious_activity_count to authenticated;
grant execute on function get_action_frequency to authenticated;

-- ============================================================================
-- 9. Partitioning (Optional - for high volume)
-- ============================================================================

-- Create partitioned table for high-volume scenarios
-- Uncomment if you need partitioning

-- create table audit_logs_partitioned (
--   like audit_logs including all
-- ) partition by range (created_at);

-- create table audit_logs_2025_01 partition of audit_logs_partitioned
--   for values from ('2025-01-01') to ('2025-02-01');

-- create table audit_logs_2025_02 partition of audit_logs_partitioned
--   for values from ('2025-02-01') to ('2025-03-01');

-- ============================================================================
-- 10. Retention Policy (Optional)
-- ============================================================================

-- Function to archive old audit logs
create or replace function archive_old_audit_logs(
  p_days_to_keep integer default 365
)
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  -- Move to archive table or delete
  with deleted as (
    delete from audit_logs
    where created_at < now() - (p_days_to_keep || ' days')::interval
    returning *
  )
  select count(*) into deleted_count from deleted;

  return deleted_count;
end;
$$;

comment on function archive_old_audit_logs is 'Archive or delete audit logs older than specified days';

-- ============================================================================
-- 11. Notification Triggers (Optional)
-- ============================================================================

-- Create function to notify on critical events
create or replace function notify_critical_audit_event()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.severity = 'critical' then
    -- Notify listening applications
    perform pg_notify(
      'critical_audit_event',
      json_build_object(
        'id', NEW.id,
        'action', NEW.action,
        'user_id', NEW.user_id,
        'created_at', NEW.created_at
      )::text
    );
  end if;

  return NEW;
end;
$$;

-- Create trigger
drop trigger if exists notify_critical_audit_event_trigger on audit_logs;
create trigger notify_critical_audit_event_trigger
  after insert on audit_logs
  for each row
  execute function notify_critical_audit_event();

comment on function notify_critical_audit_event is 'Sends PostgreSQL notification for critical events';

-- ============================================================================
-- 12. Comments for Documentation
-- ============================================================================

comment on table audit_logs is 'Comprehensive security audit log for all system actions';
comment on column audit_logs.action is 'Type of action performed (e.g., login, customer_created)';
comment on column audit_logs.status is 'Outcome: success, failure, or warning';
comment on column audit_logs.severity is 'Severity level: low, medium, high, critical';
comment on column audit_logs.user_id is 'User who performed the action';
comment on column audit_logs.customer_id is 'Customer affected by the action (if applicable)';
comment on column audit_logs.resource_type is 'Type of resource affected';
comment on column audit_logs.resource_id is 'ID of specific resource affected';
comment on column audit_logs.details is 'Additional context as JSON';
comment on column audit_logs.duration_ms is 'Duration of the operation in milliseconds';
