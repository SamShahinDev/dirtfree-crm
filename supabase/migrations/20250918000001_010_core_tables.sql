-- Core tables for Dirt Free CRM
-- Phase 1.3: Create all main business logic tables

-- User profiles (1:1 with auth.users)
-- Extends Supabase auth.users with business-specific data
create table if not exists user_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) unique not null,
  role text check (role in ('admin','dispatcher','technician')) not null default 'technician',
  display_name text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{6,}'),
  zone text check (zone in ('N','S','E','W','Central')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table user_profiles is 'Business profiles extending auth.users with role and zone information';
comment on column user_profiles.phone_e164 is 'Phone number in E.164 format (+1...)';
comment on column user_profiles.role is 'User role: admin (full access), dispatcher (scheduling), technician (field work)';
comment on column user_profiles.zone is 'Geographic zone assignment for technicians';

-- Customers table
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{6,}'),
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  notes text,
  zone text check (zone in ('N','S','E','W','Central')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table customers is 'Customer information and addresses';
comment on column customers.phone_e164 is 'Phone number in E.164 format (+1...)';
comment on column customers.zone is 'Geographic zone for scheduling optimization';

-- Jobs table
create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) not null,
  technician_id uuid references auth.users(id) on delete set null,
  zone text check (zone in ('N','S','E','W','Central')),
  status text check (status in ('scheduled','in_progress','completed','cancelled')) default 'scheduled' not null,
  scheduled_date date,
  scheduled_time_start time,
  scheduled_time_end time,
  description text,
  invoice_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table jobs is 'Service jobs and appointments';
comment on column jobs.status is 'Job status: scheduled, in_progress, completed, cancelled';
comment on column jobs.zone is 'Geographic zone for this job';

-- Service history table
create table if not exists service_history (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs(id) on delete cascade not null,
  customer_id uuid references customers(id) not null,
  technician_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger service_history_updated_at
  before update on service_history
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table service_history is 'Historical record of completed services';

-- Reminders table
create table if not exists reminders (
  id uuid primary key default uuid_generate_v4(),
  type text check (type in ('follow_up','customer','job','truck','tool')) not null,
  origin text,
  customer_id uuid references customers(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  scheduled_date date not null,
  snoozed_until timestamptz,
  status text check (status in ('pending','completed','snoozed','cancelled')) default 'pending',
  title text,
  body text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger reminders_updated_at
  before update on reminders
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table reminders is 'Task reminders and follow-ups';
comment on column reminders.type is 'Reminder type: follow_up, customer, job, truck, tool';
comment on column reminders.origin is 'Source that created this reminder';

-- Reminder comments table
create table if not exists reminder_comments (
  id uuid primary key default uuid_generate_v4(),
  reminder_id uuid references reminders(id) on delete cascade not null,
  author_id uuid references auth.users(id) not null,
  content text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger reminder_comments_updated_at
  before update on reminder_comments
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table reminder_comments is 'Comments and notes on reminders';

-- Communication logs table
create table if not exists communication_logs (
  id uuid primary key default uuid_generate_v4(),
  direction text check (direction in ('outbound','inbound')) not null,
  to_e164 text check (to_e164 is null or to_e164 ~ '^[+][1-9][0-9]{6,}'),
  from_e164 text check (from_e164 is null or from_e164 ~ '^[+][1-9][0-9]{6,}'),
  template_key text,
  status text,
  provider_message_id text,
  job_id uuid references jobs(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  body text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger communication_logs_updated_at
  before update on communication_logs
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table communication_logs is 'SMS and communication history';
comment on column communication_logs.to_e164 is 'Recipient phone number in E.164 format (+1...)';
comment on column communication_logs.from_e164 is 'Sender phone number in E.164 format (+1...)';

-- Satisfaction surveys table
create table if not exists satisfaction_surveys (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs(id) unique not null,
  sent_at timestamptz,
  responded_at timestamptz,
  score int check (score between 1 and 5),
  feedback text,
  review_requested boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger satisfaction_surveys_updated_at
  before update on satisfaction_surveys
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table satisfaction_surveys is 'Customer satisfaction surveys and feedback';
comment on column satisfaction_surveys.score is 'Rating from 1 (poor) to 5 (excellent)';

-- Trucks table
create table if not exists trucks (
  id uuid primary key default uuid_generate_v4(),
  number text not null unique,
  name text,
  next_maintenance_date date,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger trucks_updated_at
  before update on trucks
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table trucks is 'Company vehicles and equipment';
comment on column trucks.number is 'Unique truck identifier (e.g., "01", "02")';

-- Truck tools table
create table if not exists truck_tools (
  id uuid primary key default uuid_generate_v4(),
  truck_id uuid references trucks(id) on delete cascade not null,
  tool_name text not null,
  min_qty int default 0,
  qty_on_truck int default 0,
  calibration_due date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger truck_tools_updated_at
  before update on truck_tools
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table truck_tools is 'Tools and equipment inventory per truck';

-- SMS opt-outs table
create table if not exists sms_opt_outs (
  phone_e164 text primary key check (phone_e164 ~ '^[+][1-9][0-9]{6,}'),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger sms_opt_outs_updated_at
  before update on sms_opt_outs
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table sms_opt_outs is 'Phone numbers that have opted out of SMS communications';
comment on column sms_opt_outs.phone_e164 is 'Phone number in E.164 format (+1...)';

-- Audit log table
create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add updated_at trigger
create trigger audit_log_updated_at
  before update on audit_log
  for each row execute function set_updated_at();

-- Comments for documentation
comment on table audit_log is 'Audit trail of all system actions';
comment on column audit_log.action is 'Action performed (e.g., "CREATE", "UPDATE", "DELETE")';
comment on column audit_log.entity is 'Entity type affected (e.g., "customer", "job")';
comment on column audit_log.meta is 'Additional metadata about the action';