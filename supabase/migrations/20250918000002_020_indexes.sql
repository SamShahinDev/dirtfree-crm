-- Database indexes for performance optimization
-- Phase 1.3: Create essential indexes for common queries

-- Customer address search using trigram similarity
-- Enables fast fuzzy search across concatenated address fields
create index if not exists idx_customers_addr_trgm
  on customers
  using gin ((
    coalesce(address_line1,'') || ' ' ||
    coalesce(city,'') || ' ' ||
    coalesce(state,'') || ' ' ||
    coalesce(postal_code,'')
  ) gin_trgm_ops);

-- Customer phone lookup
create index if not exists idx_customers_phone
  on customers (phone_e164);

-- Customer name search (for autocomplete and search)
create index if not exists idx_customers_name_trgm
  on customers
  using gin (name gin_trgm_ops);

-- Customer zone filtering
create index if not exists idx_customers_zone
  on customers (zone);

-- Job foreign key relationships
create index if not exists idx_jobs_customer
  on jobs (customer_id);

create index if not exists idx_jobs_technician
  on jobs (technician_id);

-- Job status and scheduling queries
create index if not exists idx_jobs_status
  on jobs (status);

create index if not exists idx_jobs_scheduled_date
  on jobs (scheduled_date);

create index if not exists idx_jobs_zone
  on jobs (zone);

-- Composite index for tech assignments by date
create index if not exists idx_jobs_tech_date
  on jobs (technician_id, scheduled_date)
  where status in ('scheduled', 'in_progress');

-- Service history relationships
create index if not exists idx_service_history_job
  on service_history (job_id);

create index if not exists idx_service_history_customer
  on service_history (customer_id);

create index if not exists idx_service_history_technician
  on service_history (technician_id);

-- Service history by completion date
create index if not exists idx_service_history_completed
  on service_history (completed_at);

-- Reminder queries
create index if not exists idx_reminders_assigned_user
  on reminders (assigned_user_id);

create index if not exists idx_reminders_customer
  on reminders (customer_id);

create index if not exists idx_reminders_job
  on reminders (job_id);

create index if not exists idx_reminders_scheduled_date
  on reminders (scheduled_date);

create index if not exists idx_reminders_status
  on reminders (status);

-- Reminders due today/overdue query optimization
create index if not exists idx_reminders_due
  on reminders (scheduled_date, status)
  where status in ('pending', 'snoozed');

-- Reminder comments relationship
create index if not exists idx_reminder_comments_reminder
  on reminder_comments (reminder_id);

create index if not exists idx_reminder_comments_author
  on reminder_comments (author_id);

-- Communication logs relationships
create index if not exists idx_communication_logs_job
  on communication_logs (job_id);

create index if not exists idx_communication_logs_customer
  on communication_logs (customer_id);

-- Communication logs by phone number
create index if not exists idx_communication_logs_to_phone
  on communication_logs (to_e164);

create index if not exists idx_communication_logs_from_phone
  on communication_logs (from_e164);

-- Communication logs by date for reporting
create index if not exists idx_communication_logs_created
  on communication_logs (created_at);

-- Satisfaction surveys relationship
create index if not exists idx_satisfaction_surveys_job
  on satisfaction_surveys (job_id);

-- Truck tools relationship
create index if not exists idx_truck_tools_truck
  on truck_tools (truck_id);

-- Tool inventory queries
create index if not exists idx_truck_tools_name
  on truck_tools (tool_name);

-- Low inventory alerts
create index if not exists idx_truck_tools_low_qty
  on truck_tools (truck_id, tool_name)
  where qty_on_truck < min_qty;

-- Calibration due alerts
create index if not exists idx_truck_tools_calibration_due
  on truck_tools (calibration_due)
  where calibration_due is not null;

-- Audit log queries
create index if not exists idx_audit_log_actor
  on audit_log (actor_id);

create index if not exists idx_audit_log_entity
  on audit_log (entity, entity_id);

create index if not exists idx_audit_log_created
  on audit_log (created_at);

-- Audit log by action type
create index if not exists idx_audit_log_action
  on audit_log (action, created_at);

-- User profiles relationship
create index if not exists idx_user_profiles_user
  on user_profiles (user_id);

create index if not exists idx_user_profiles_role
  on user_profiles (role);

create index if not exists idx_user_profiles_zone
  on user_profiles (zone);

-- Comments for documentation
comment on index idx_customers_addr_trgm is 'Trigram index for fast address fuzzy search';
comment on index idx_jobs_tech_date is 'Optimizes technician schedule queries';
comment on index idx_reminders_due is 'Optimizes due/overdue reminder queries';
comment on index idx_truck_tools_low_qty is 'Alerts for low inventory items';
comment on index idx_audit_log_entity is 'Entity-specific audit trail queries';