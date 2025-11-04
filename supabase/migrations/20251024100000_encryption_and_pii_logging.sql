-- Encryption and PII Protection
-- Adds encrypted data storage and PII access logging

-- ============================================================================
-- 1. Customer Sensitive Data Table
-- ============================================================================

create table if not exists customer_sensitive_data (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade not null unique,

  -- Encrypted sensitive fields
  ssn_encrypted text,
  notes_encrypted text,

  -- Payment information (tokens only, never store actual card numbers)
  credit_card_last4 varchar(4),
  payment_method_token text, -- Stripe/payment provider token
  payment_method_type varchar(50), -- 'card', 'ach', etc.

  -- Metadata
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger customer_sensitive_data_updated_at
  before update on customer_sensitive_data
  for each row execute function set_updated_at();

-- Indexes
create index if not exists customer_sensitive_data_customer_id_idx
  on customer_sensitive_data(customer_id);

-- Comments
comment on table customer_sensitive_data is 'Encrypted sensitive customer data (PII)';
comment on column customer_sensitive_data.ssn_encrypted is 'Encrypted SSN (format: iv:authTag:encryptedData)';
comment on column customer_sensitive_data.notes_encrypted is 'Encrypted sensitive notes';
comment on column customer_sensitive_data.credit_card_last4 is 'Last 4 digits of card (for display only)';
comment on column customer_sensitive_data.payment_method_token is 'Payment provider token (never store actual card numbers)';

-- ============================================================================
-- 2. PII Access Log Table
-- ============================================================================

create table if not exists pii_access_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  field_accessed varchar(255) not null,
  action varchar(20) check (action in ('view', 'edit', 'export', 'delete', 'create')) not null,
  ip_address inet,
  user_agent text,
  metadata jsonb default '{}'::jsonb,
  access_reason text,
  accessed_at timestamptz default now() not null
);

-- Indexes for efficient querying
create index if not exists pii_access_log_customer_id_idx
  on pii_access_log(customer_id, accessed_at desc);

create index if not exists pii_access_log_user_id_idx
  on pii_access_log(user_id, accessed_at desc);

create index if not exists pii_access_log_accessed_at_idx
  on pii_access_log(accessed_at desc);

create index if not exists pii_access_log_action_idx
  on pii_access_log(action);

-- Comments
comment on table pii_access_log is 'Audit log of all PII access for compliance';
comment on column pii_access_log.field_accessed is 'Comma-separated list of fields accessed';
comment on column pii_access_log.action is 'Type of access: view, edit, export, delete, create';
comment on column pii_access_log.access_reason is 'Optional reason for accessing sensitive data';

-- ============================================================================
-- 3. RLS Policies for Sensitive Data
-- ============================================================================

-- Enable RLS
alter table customer_sensitive_data enable row level security;
alter table pii_access_log enable row level security;

-- Only admins and authorized users can view sensitive data
create policy "Admins can view all sensitive data"
  on customer_sensitive_data for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.user_id = auth.uid()
      and user_profiles.role = 'admin'
    )
  );

-- Users can view sensitive data with proper permission
create policy "Authorized users can view sensitive data"
  on customer_sensitive_data for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.user_id = auth.uid()
      and user_profiles.role in ('admin', 'dispatcher', 'accountant')
    )
  );

-- Only admins can insert/update sensitive data
create policy "Admins can manage sensitive data"
  on customer_sensitive_data for all
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.user_id = auth.uid()
      and user_profiles.role = 'admin'
    )
  );

-- PII access log policies
create policy "Admins can view all PII access logs"
  on pii_access_log for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.user_id = auth.uid()
      and user_profiles.role = 'admin'
    )
  );

-- Users can view their own access logs
create policy "Users can view their own PII access logs"
  on pii_access_log for select
  using (user_id = auth.uid());

-- Service role can insert access logs
create policy "Service role can insert PII access logs"
  on pii_access_log for insert
  with check (true);

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- Function to get suspicious PII access patterns
create or replace function get_suspicious_pii_access(
  since_date timestamptz,
  min_access_count integer default 50
)
returns table (
  user_id uuid,
  access_count bigint,
  unique_customers bigint,
  actions_breakdown jsonb
)
language plpgsql
security definer
as $$
begin
  return query
  select
    pal.user_id,
    count(*) as access_count,
    count(distinct pal.customer_id) as unique_customers,
    jsonb_object_agg(
      pal.action,
      count(*)
    ) as actions_breakdown
  from pii_access_log pal
  where pal.accessed_at >= since_date
  group by pal.user_id
  having count(*) >= min_access_count
  order by access_count desc;
end;
$$;

comment on function get_suspicious_pii_access is 'Detect suspicious PII access patterns';

-- Function to log PII access (callable from application)
create or replace function log_pii_access(
  p_user_id uuid,
  p_customer_id uuid,
  p_field_accessed text,
  p_action text,
  p_ip_address inet default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_access_reason text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  log_id uuid;
begin
  insert into pii_access_log (
    user_id,
    customer_id,
    field_accessed,
    action,
    ip_address,
    user_agent,
    metadata,
    access_reason,
    accessed_at
  ) values (
    p_user_id,
    p_customer_id,
    p_field_accessed,
    p_action,
    p_ip_address,
    p_user_agent,
    p_metadata,
    p_access_reason,
    now()
  )
  returning id into log_id;

  return log_id;
end;
$$;

comment on function log_pii_access is 'Log PII access for audit trail';

-- ============================================================================
-- 5. Encrypted Data Backup Table
-- ============================================================================

create table if not exists encrypted_data_backup (
  id uuid primary key default uuid_generate_v4(),
  table_name varchar(100) not null,
  record_id uuid not null,
  encrypted_data jsonb not null,
  encryption_version integer default 1,
  backed_up_at timestamptz default now() not null,
  backed_up_by uuid references auth.users(id)
);

create index if not exists encrypted_data_backup_table_record_idx
  on encrypted_data_backup(table_name, record_id, backed_up_at desc);

comment on table encrypted_data_backup is 'Backup of encrypted sensitive data for key rotation';

-- ============================================================================
-- 6. Grants
-- ============================================================================

-- Grant access to authenticated users (with RLS)
grant select on customer_sensitive_data to authenticated;
grant insert, update on customer_sensitive_data to authenticated;

grant select on pii_access_log to authenticated;
grant insert on pii_access_log to authenticated;

grant execute on function get_suspicious_pii_access to authenticated;
grant execute on function log_pii_access to authenticated;

-- ============================================================================
-- 7. Views for Compliance Reporting
-- ============================================================================

create or replace view pii_access_summary as
select
  date_trunc('day', accessed_at) as access_date,
  action,
  count(*) as access_count,
  count(distinct user_id) as unique_users,
  count(distinct customer_id) as unique_customers
from pii_access_log
group by date_trunc('day', accessed_at), action
order by access_date desc, action;

comment on view pii_access_summary is 'Daily summary of PII access for compliance reporting';

grant select on pii_access_summary to authenticated;

-- ============================================================================
-- 8. Partitioning for PII Access Log (Optional, for high volume)
-- ============================================================================

-- Create partitions for PII access log by month
-- Uncomment and adjust if you need partitioning

-- create table pii_access_log_2025_01 partition of pii_access_log
--   for values from ('2025-01-01') to ('2025-02-01');

-- create table pii_access_log_2025_02 partition of pii_access_log
--   for values from ('2025-02-01') to ('2025-03-01');

-- ============================================================================
-- 9. Audit Trigger for Sensitive Data Changes
-- ============================================================================

create or replace function audit_sensitive_data_changes()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'UPDATE') then
    -- Log which fields were updated
    insert into audit_log (
      actor_id,
      action,
      entity,
      entity_id,
      meta
    ) values (
      auth.uid(),
      'UPDATE_SENSITIVE_DATA',
      'customer_sensitive_data',
      NEW.customer_id,
      jsonb_build_object(
        'updated_fields', (
          select jsonb_object_agg(key, true)
          from jsonb_each_text(to_jsonb(NEW))
          where to_jsonb(NEW) ->> key is distinct from to_jsonb(OLD) ->> key
        )
      )
    );
  elsif (TG_OP = 'DELETE') then
    insert into audit_log (
      actor_id,
      action,
      entity,
      entity_id,
      meta
    ) values (
      auth.uid(),
      'DELETE_SENSITIVE_DATA',
      'customer_sensitive_data',
      OLD.customer_id,
      '{}'::jsonb
    );
  end if;

  return NEW;
end;
$$;

create trigger audit_sensitive_data_changes_trigger
  after update or delete on customer_sensitive_data
  for each row execute function audit_sensitive_data_changes();

comment on function audit_sensitive_data_changes is 'Audit all changes to sensitive data';
