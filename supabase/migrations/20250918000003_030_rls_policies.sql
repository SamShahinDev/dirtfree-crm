-- Row Level Security (RLS) policies
-- Phase 1.3: Implement comprehensive security policies
-- Admin: full access | Dispatcher: full access except audit_log read | Technician: scoped access

-- Enable RLS on all tables
alter table user_profiles enable row level security;
alter table customers enable row level security;
alter table jobs enable row level security;
alter table service_history enable row level security;
alter table reminders enable row level security;
alter table reminder_comments enable row level security;
alter table communication_logs enable row level security;
alter table satisfaction_surveys enable row level security;
alter table trucks enable row level security;
alter table truck_tools enable row level security;
alter table sms_opt_outs enable row level security;
alter table audit_log enable row level security;

-- Create role resolution helper view
-- This view determines the current user's role for use in policies
create or replace view v_current_user_role as
select
  u.id as user_id,
  coalesce(p.role, 'technician') as role
from auth.users u
left join user_profiles p on p.user_id = u.id
where u.id = auth.uid();

comment on view v_current_user_role is 'Helper view to get current user role for RLS policies';

-- ============================================================================
-- USER_PROFILES POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher see all, Technicians see only their own
create policy "user_profiles_select" on user_profiles for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or user_id = auth.uid()
);

-- Insert: Admin only (user creation handled by admin)
create policy "user_profiles_insert" on user_profiles for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- Update: Admin can update any, users can update their own
create policy "user_profiles_update" on user_profiles for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  ) or user_id = auth.uid()
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  ) or user_id = auth.uid()
);

-- Delete: Admin only
create policy "user_profiles_delete" on user_profiles for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- ============================================================================
-- CUSTOMERS POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher see all, Technicians see customers they have jobs with
create policy "customers_select" on customers for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or exists (
    select 1 from jobs j
    where j.customer_id = customers.id
    and j.technician_id = auth.uid()
  )
);

-- Insert: Admin/Dispatcher only
create policy "customers_insert" on customers for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Update: Admin/Dispatcher only
create policy "customers_update" on customers for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Delete: Admin only
create policy "customers_delete" on customers for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- ============================================================================
-- JOBS POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher see all, Technicians see only their assigned jobs
create policy "jobs_select" on jobs for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or technician_id = auth.uid()
);

-- Insert: Admin/Dispatcher only
create policy "jobs_insert" on jobs for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Update: Admin/Dispatcher full access, Technicians can update their own jobs
create policy "jobs_update" on jobs for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or technician_id = auth.uid()
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or technician_id = auth.uid()
);

-- Delete: Admin only
create policy "jobs_delete" on jobs for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- ============================================================================
-- SERVICE_HISTORY POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher see all, Technicians see their own service records
create policy "service_history_select" on service_history for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or technician_id = auth.uid()
);

-- Insert: Admin/Dispatcher and assigned technicians
create policy "service_history_insert" on service_history for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or technician_id = auth.uid()
);

-- Update: Admin/Dispatcher and record owner
create policy "service_history_update" on service_history for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or technician_id = auth.uid()
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or technician_id = auth.uid()
);

-- Delete: Admin only
create policy "service_history_delete" on service_history for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- ============================================================================
-- REMINDERS POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher see all, Technicians see assigned to them or their jobs
create policy "reminders_select" on reminders for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or assigned_user_id = auth.uid() or exists (
    select 1 from jobs j
    where j.id = reminders.job_id
    and j.technician_id = auth.uid()
  )
);

-- Insert: Admin/Dispatcher and users can create reminders for themselves
create policy "reminders_insert" on reminders for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or assigned_user_id = auth.uid()
);

-- Update: Admin/Dispatcher and assigned user
create policy "reminders_update" on reminders for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or assigned_user_id = auth.uid()
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or assigned_user_id = auth.uid()
);

-- Delete: Admin/Dispatcher only
create policy "reminders_delete" on reminders for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- ============================================================================
-- REMINDER_COMMENTS POLICIES
-- ============================================================================

-- Select: Same as parent reminder
create policy "reminder_comments_select" on reminder_comments for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or exists (
    select 1 from reminders rem
    where rem.id = reminder_comments.reminder_id
    and (rem.assigned_user_id = auth.uid() or exists (
      select 1 from jobs j
      where j.id = rem.job_id
      and j.technician_id = auth.uid()
    ))
  )
);

-- Insert: Can comment if can see the reminder
create policy "reminder_comments_insert" on reminder_comments for insert with check (
  author_id = auth.uid() and (
    exists (
      select 1 from v_current_user_role r
      where r.role in ('admin', 'dispatcher')
    ) or exists (
      select 1 from reminders rem
      where rem.id = reminder_comments.reminder_id
      and (rem.assigned_user_id = auth.uid() or exists (
        select 1 from jobs j
        where j.id = rem.job_id
        and j.technician_id = auth.uid()
      ))
    )
  )
);

-- Update: Admin/Dispatcher and comment author
create policy "reminder_comments_update" on reminder_comments for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or author_id = auth.uid()
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or author_id = auth.uid()
);

-- Delete: Admin/Dispatcher and comment author
create policy "reminder_comments_delete" on reminder_comments for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or author_id = auth.uid()
);

-- ============================================================================
-- COMMUNICATION_LOGS POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher see all, Technicians see logs for their jobs/customers
create policy "communication_logs_select" on communication_logs for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or exists (
    select 1 from jobs j
    where j.id = communication_logs.job_id
    and j.technician_id = auth.uid()
  ) or exists (
    select 1 from jobs j
    where j.customer_id = communication_logs.customer_id
    and j.technician_id = auth.uid()
  )
);

-- Insert: Admin/Dispatcher only (system generated)
create policy "communication_logs_insert" on communication_logs for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Update: Admin only (logs should be immutable)
create policy "communication_logs_update" on communication_logs for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- Delete: Admin only
create policy "communication_logs_delete" on communication_logs for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- ============================================================================
-- SATISFACTION_SURVEYS POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher see all, Technicians see surveys for their jobs
create policy "satisfaction_surveys_select" on satisfaction_surveys for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  ) or exists (
    select 1 from jobs j
    where j.id = satisfaction_surveys.job_id
    and j.technician_id = auth.uid()
  )
);

-- Insert: Admin/Dispatcher only (system generated)
create policy "satisfaction_surveys_insert" on satisfaction_surveys for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Update: Admin/Dispatcher only
create policy "satisfaction_surveys_update" on satisfaction_surveys for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Delete: Admin only
create policy "satisfaction_surveys_delete" on satisfaction_surveys for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- ============================================================================
-- TRUCKS POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher full access, Technicians read-only
create policy "trucks_select" on trucks for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher', 'technician')
  )
);

-- Insert: Admin/Dispatcher only
create policy "trucks_insert" on trucks for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Update: Admin/Dispatcher only
create policy "trucks_update" on trucks for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Delete: Admin only
create policy "trucks_delete" on trucks for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- ============================================================================
-- TRUCK_TOOLS POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher full access, Technicians read-only
create policy "truck_tools_select" on truck_tools for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher', 'technician')
  )
);

-- Insert: Admin/Dispatcher only
create policy "truck_tools_insert" on truck_tools for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Update: Admin/Dispatcher only
create policy "truck_tools_update" on truck_tools for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Delete: Admin/Dispatcher only
create policy "truck_tools_delete" on truck_tools for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- ============================================================================
-- SMS_OPT_OUTS POLICIES
-- ============================================================================

-- Select: Admin/Dispatcher only (privacy sensitive)
create policy "sms_opt_outs_select" on sms_opt_outs for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Insert: Admin/Dispatcher only (system controlled)
create policy "sms_opt_outs_insert" on sms_opt_outs for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);

-- Update: Admin only
create policy "sms_opt_outs_update" on sms_opt_outs for update using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
) with check (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- Delete: Admin only
create policy "sms_opt_outs_delete" on sms_opt_outs for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- ============================================================================
-- AUDIT_LOG POLICIES
-- ============================================================================

-- Select: Admin only (security sensitive)
create policy "audit_log_select" on audit_log for select using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- Insert: All authenticated users (for logging their actions)
create policy "audit_log_insert" on audit_log for insert with check (
  auth.uid() is not null
);

-- Update: No updates allowed (audit logs are immutable)
create policy "audit_log_update" on audit_log for update using (false);

-- Delete: Admin only (for cleanup/archival)
create policy "audit_log_delete" on audit_log for delete using (
  exists (
    select 1 from v_current_user_role r
    where r.role = 'admin'
  )
);

-- ============================================================================
-- SECURITY COMMENTS
-- ============================================================================

comment on policy "user_profiles_select" on user_profiles is 'Admin/Dispatcher see all, users see own profile';
comment on policy "customers_select" on customers is 'Admin/Dispatcher see all, technicians see customers with assigned jobs';
comment on policy "jobs_select" on jobs is 'Admin/Dispatcher see all, technicians see only assigned jobs';
comment on policy "audit_log_select" on audit_log is 'Admin-only access to audit logs for security';
comment on policy "audit_log_insert" on audit_log is 'All users can log actions, but only admins can read';

-- Grant usage on the view to authenticated users
grant select on v_current_user_role to authenticated;