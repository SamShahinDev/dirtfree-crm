-- RBAC System: Enhanced Roles and Audit Logging
-- Adds new roles (marketing, accountant, viewer) and audit logging support

-- ============================================================================
-- 1. Update user_profiles table to support new roles
-- ============================================================================

-- Drop the existing constraint
alter table user_profiles drop constraint if exists user_profiles_role_check;

-- Add the updated constraint with all 6 roles
alter table user_profiles add constraint user_profiles_role_check
  check (role in ('admin', 'dispatcher', 'technician', 'marketing', 'accountant', 'viewer'));

-- Update the comment to reflect new roles
comment on column user_profiles.role is 'User role: admin (full access), dispatcher (scheduling), technician (field work), marketing (promotions), accountant (finances), viewer (read-only)';

-- ============================================================================
-- 2. Create audit_logs table for security and compliance
-- ============================================================================

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource text not null,
  timestamp timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now() not null
);

-- Add index for efficient querying
create index if not exists audit_logs_user_id_idx on audit_logs(user_id);
create index if not exists audit_logs_timestamp_idx on audit_logs(timestamp desc);
create index if not exists audit_logs_resource_idx on audit_logs(resource);
create index if not exists audit_logs_action_idx on audit_logs(action);

-- Comments for documentation
comment on table audit_logs is 'Audit trail for authentication and authorization events';
comment on column audit_logs.user_id is 'User who performed the action';
comment on column audit_logs.action is 'HTTP method or action performed (GET, POST, DELETE, etc.)';
comment on column audit_logs.resource is 'API endpoint or resource accessed';
comment on column audit_logs.metadata is 'Additional context (request body, params, etc.)';

-- ============================================================================
-- 3. Helper function to get user role
-- ============================================================================

create or replace function get_user_role(user_uuid uuid)
returns text
language plpgsql
security definer
as $$
declare
  user_role text;
begin
  select role into user_role
  from user_profiles
  where user_id = user_uuid;

  return coalesce(user_role, 'viewer');
end;
$$;

comment on function get_user_role is 'Get the role for a user, defaulting to viewer if not found';

-- ============================================================================
-- 4. Helper function to check if user has permission
-- ============================================================================

create or replace function has_permission(user_uuid uuid, required_permission text)
returns boolean
language plpgsql
security definer
as $$
declare
  user_role text;
  has_perm boolean := false;
begin
  user_role := get_user_role(user_uuid);

  -- Admin has all permissions
  if user_role = 'admin' then
    return true;
  end if;

  -- Check role-specific permissions
  -- This is a simplified version - the full permission logic is in the application layer
  case user_role
    when 'dispatcher' then
      has_perm := required_permission in (
        'customers:read', 'customers:write',
        'opportunities:read', 'opportunities:write',
        'jobs:read', 'jobs:write', 'jobs:assign'
      );
    when 'marketing' then
      has_perm := required_permission in (
        'customers:read',
        'promotions:read', 'promotions:write',
        'opportunities:read'
      );
    when 'accountant' then
      has_perm := required_permission in (
        'customers:read',
        'invoices:read', 'invoices:write', 'invoices:approve',
        'jobs:read'
      );
    when 'technician' then
      has_perm := required_permission in (
        'customers:read',
        'jobs:read', 'jobs:write',
        'opportunities:read'
      );
    when 'viewer' then
      has_perm := required_permission in (
        'customers:read',
        'opportunities:read',
        'promotions:read',
        'jobs:read'
      );
    else
      has_perm := false;
  end case;

  return has_perm;
end;
$$;

comment on function has_permission is 'Check if a user has a specific permission based on their role';

-- ============================================================================
-- 5. RLS Policies for audit_logs
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

-- System can insert audit logs (via service role)
create policy "Service role can insert audit logs"
  on audit_logs for insert
  with check (true);

-- ============================================================================
-- 6. Function to log audit events
-- ============================================================================

create or replace function log_audit_event(
  p_user_id uuid,
  p_action text,
  p_resource text,
  p_metadata jsonb default '{}'::jsonb,
  p_ip_address inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  event_id uuid;
begin
  insert into audit_logs (
    user_id,
    action,
    resource,
    metadata,
    ip_address,
    user_agent,
    timestamp
  ) values (
    p_user_id,
    p_action,
    p_resource,
    p_metadata,
    p_ip_address,
    p_user_agent,
    now()
  )
  returning id into event_id;

  return event_id;
end;
$$;

comment on function log_audit_event is 'Log an audit event for compliance and security monitoring';

-- ============================================================================
-- 7. Migrate existing roles
-- ============================================================================

-- Set default role for users without a role
update user_profiles
set role = 'viewer'
where role is null;

-- ============================================================================
-- 8. Add role metadata to auth.users (optional)
-- ============================================================================

-- This allows storing role in user metadata for faster access
-- The application layer can sync this with user_profiles

-- Create a trigger to sync role to user metadata
create or replace function sync_role_to_metadata()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Update auth.users metadata with the new role
  update auth.users
  set raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', NEW.role)
  where id = NEW.user_id;

  return NEW;
end;
$$;

-- Apply the trigger
drop trigger if exists sync_role_metadata on user_profiles;
create trigger sync_role_metadata
  after insert or update of role on user_profiles
  for each row
  execute function sync_role_to_metadata();

comment on function sync_role_to_metadata is 'Automatically sync user role to auth.users metadata';

-- ============================================================================
-- 9. Create view for user permissions (read-only)
-- ============================================================================

create or replace view user_permissions as
select
  up.user_id,
  u.email,
  up.role,
  up.display_name,
  up.zone,
  up.created_at,
  up.updated_at
from user_profiles up
join auth.users u on u.id = up.user_id
where u.deleted_at is null;

comment on view user_permissions is 'Unified view of user profiles with email from auth.users';

-- Grant select on view to authenticated users
grant select on user_permissions to authenticated;

-- ============================================================================
-- 10. Add helpful grants
-- ============================================================================

-- Grant access to audit_logs for authenticated users (with RLS)
grant select on audit_logs to authenticated;
grant insert on audit_logs to authenticated;

-- Grant usage of helper functions
grant execute on function get_user_role to authenticated;
grant execute on function has_permission to authenticated;
grant execute on function log_audit_event to authenticated;
