-- =============================================================================
-- INVOICING SYSTEM MIGRATION
-- =============================================================================
-- Creates tables for invoice management, PDF generation, and payment tracking
-- Includes proper RBAC for admin/dispatcher full access, technicians read-only

-- Create invoice status enum
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'void');

-- Create payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded');

-- =============================================================================
-- INVOICES TABLE
-- =============================================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

    -- Invoice identification
    number TEXT NOT NULL UNIQUE, -- Format: DF-YYYYMMDD-####

    -- Status and workflow
    status invoice_status NOT NULL DEFAULT 'draft',

    -- Financial details (stored in cents to avoid floating point issues)
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'usd',

    -- Payment and delivery
    payment_link TEXT, -- Stripe payment link URL
    pdf_key TEXT, -- Storage key for generated PDF

    -- Timestamps
    emailed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX invoices_job_id_idx ON invoices(job_id);
CREATE INDEX invoices_customer_id_idx ON invoices(customer_id);
CREATE INDEX invoices_status_idx ON invoices(status);
CREATE INDEX invoices_paid_at_idx ON invoices(paid_at);
CREATE INDEX invoices_created_at_idx ON invoices(created_at);
CREATE INDEX invoices_number_idx ON invoices(number);

-- =============================================================================
-- INVOICE ITEMS TABLE
-- =============================================================================

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

    -- Item details
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1.0,
    unit_cents INTEGER NOT NULL,
    line_total_cents INTEGER NOT NULL,

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX invoice_items_invoice_id_idx ON invoice_items(invoice_id);
CREATE INDEX invoice_items_sort_order_idx ON invoice_items(invoice_id, sort_order);

-- =============================================================================
-- PAYMENTS TABLE
-- =============================================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,

    -- Payment provider details
    provider TEXT NOT NULL DEFAULT 'stripe',
    provider_ref TEXT NOT NULL, -- Stripe payment intent ID, session ID, etc.

    -- Payment details
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    status payment_status NOT NULL DEFAULT 'pending',

    -- Provider-specific metadata
    provider_data JSONB,

    -- Timestamps
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX payments_invoice_id_idx ON payments(invoice_id);
CREATE INDEX payments_provider_ref_idx ON payments(provider, provider_ref);
CREATE INDEX payments_status_idx ON payments(status);
CREATE INDEX payments_processed_at_idx ON payments(processed_at);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to all tables
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- INVOICES RLS POLICIES
-- =============================================================================

-- Admins and dispatchers: full access to all invoices
CREATE POLICY "admin_dispatcher_invoices_full_access" ON invoices
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'dispatcher')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'dispatcher')
        )
    );

-- Technicians: read-only access to invoices for their jobs
CREATE POLICY "technician_invoices_read_only" ON invoices
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            JOIN jobs ON jobs.assigned_technician_id = auth.users.id
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'technician'
            AND jobs.id = invoices.job_id
        )
    );

-- =============================================================================
-- INVOICE ITEMS RLS POLICIES
-- =============================================================================

-- Admins and dispatchers: full access to all invoice items
CREATE POLICY "admin_dispatcher_invoice_items_full_access" ON invoice_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'dispatcher')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'dispatcher')
        )
    );

-- Technicians: read-only access to invoice items for their jobs
CREATE POLICY "technician_invoice_items_read_only" ON invoice_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            JOIN jobs ON jobs.assigned_technician_id = auth.users.id
            JOIN invoices ON invoices.job_id = jobs.id
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'technician'
            AND invoices.id = invoice_items.invoice_id
        )
    );

-- =============================================================================
-- PAYMENTS RLS POLICIES
-- =============================================================================

-- Admins and dispatchers: full access to all payments
CREATE POLICY "admin_dispatcher_payments_full_access" ON payments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'dispatcher')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'dispatcher')
        )
    );

-- Technicians: read-only access to payments for their jobs
CREATE POLICY "technician_payments_read_only" ON payments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            JOIN jobs ON jobs.assigned_technician_id = auth.users.id
            JOIN invoices ON invoices.job_id = jobs.id
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'technician'
            AND invoices.id = payments.invoice_id
        )
    );

-- =============================================================================
-- CONSTRAINTS AND VALIDATIONS
-- =============================================================================

-- Ensure invoice totals are consistent
ALTER TABLE invoices ADD CONSTRAINT invoices_total_calculation_check
    CHECK (total_cents = subtotal_cents + tax_cents - discount_cents);

-- Ensure line item totals are consistent
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_line_total_check
    CHECK (line_total_cents = ROUND(quantity * unit_cents));

-- Ensure positive amounts
ALTER TABLE invoices ADD CONSTRAINT invoices_subtotal_positive_check
    CHECK (subtotal_cents >= 0);

ALTER TABLE invoices ADD CONSTRAINT invoices_tax_positive_check
    CHECK (tax_cents >= 0);

ALTER TABLE invoices ADD CONSTRAINT invoices_discount_positive_check
    CHECK (discount_cents >= 0);

ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_quantity_positive_check
    CHECK (quantity > 0);

ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_unit_cents_positive_check
    CHECK (unit_cents >= 0);

ALTER TABLE payments ADD CONSTRAINT payments_amount_positive_check
    CHECK (amount_cents > 0);

-- Ensure invoice number format
ALTER TABLE invoices ADD CONSTRAINT invoices_number_format_check
    CHECK (number ~ '^DF-\d{8}-\d{4}$');

-- Ensure email timestamp logic
ALTER TABLE invoices ADD CONSTRAINT invoices_email_status_logic_check
    CHECK (
        (status = 'draft' AND emailed_at IS NULL) OR
        (status IN ('sent', 'paid', 'void') AND emailed_at IS NOT NULL) OR
        (status = 'void') -- void can have any email state
    );

-- Ensure payment timestamp logic
ALTER TABLE invoices ADD CONSTRAINT invoices_payment_status_logic_check
    CHECK (
        (status IN ('draft', 'sent', 'void') AND paid_at IS NULL) OR
        (status = 'paid' AND paid_at IS NOT NULL)
    );

-- =============================================================================
-- FUNCTIONS FOR INVOICE OPERATIONS
-- =============================================================================

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    today_str TEXT;
    next_sequence INTEGER;
    invoice_number TEXT;
BEGIN
    -- Get today's date in YYYYMMDD format
    today_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    -- Get the next sequence number for today
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(number FROM 'DF-\d{8}-(\d{4})') AS INTEGER)
    ), 0) + 1
    INTO next_sequence
    FROM invoices
    WHERE number LIKE 'DF-' || today_str || '-%';

    -- Format the invoice number
    invoice_number := 'DF-' || today_str || '-' || LPAD(next_sequence::TEXT, 4, '0');

    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals(
    p_invoice_id UUID,
    p_tax_rate_percent DECIMAL DEFAULT 0,
    p_discount_cents INTEGER DEFAULT 0
) RETURNS TABLE (
    subtotal_cents INTEGER,
    tax_cents INTEGER,
    discount_cents INTEGER,
    total_cents INTEGER
) AS $$
DECLARE
    calc_subtotal INTEGER;
    calc_tax INTEGER;
    calc_discount INTEGER;
    calc_total INTEGER;
BEGIN
    -- Calculate subtotal from line items
    SELECT COALESCE(SUM(line_total_cents), 0)
    INTO calc_subtotal
    FROM invoice_items
    WHERE invoice_id = p_invoice_id;

    -- Calculate tax
    calc_tax := ROUND(calc_subtotal * p_tax_rate_percent / 100);

    -- Set discount
    calc_discount := p_discount_cents;

    -- Calculate total
    calc_total := calc_subtotal + calc_tax - calc_discount;

    -- Ensure total is not negative
    IF calc_total < 0 THEN
        calc_total := 0;
    END IF;

    RETURN QUERY SELECT calc_subtotal, calc_tax, calc_discount, calc_total;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- AUDIT LOGGING
-- =============================================================================

-- Create audit log entries for invoice state changes
CREATE OR REPLACE FUNCTION audit_invoice_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log status changes
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            old_values,
            new_values,
            user_id,
            user_role,
            ip_address,
            user_agent
        ) VALUES (
            'invoices',
            NEW.id,
            'status_change',
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status),
            auth.uid(),
            (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
            current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
            current_setting('request.headers', true)::jsonb->>'user-agent'
        );
    END IF;

    -- Log payment link generation
    IF TG_OP = 'UPDATE' AND OLD.payment_link IS NULL AND NEW.payment_link IS NOT NULL THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            new_values,
            user_id,
            user_role,
            ip_address,
            user_agent
        ) VALUES (
            'invoices',
            NEW.id,
            'payment_link_generated',
            jsonb_build_object('payment_link_created', true),
            auth.uid(),
            (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
            current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
            current_setting('request.headers', true)::jsonb->>'user-agent'
        );
    END IF;

    -- Log PDF generation
    IF TG_OP = 'UPDATE' AND OLD.pdf_key IS NULL AND NEW.pdf_key IS NOT NULL THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            new_values,
            user_id,
            user_role,
            ip_address,
            user_agent
        ) VALUES (
            'invoices',
            NEW.id,
            'pdf_generated',
            jsonb_build_object('pdf_key', '[REDACTED]'), -- Don't log actual storage key
            auth.uid(),
            (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
            current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
            current_setting('request.headers', true)::jsonb->>'user-agent'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit trigger to invoices
CREATE TRIGGER audit_invoice_changes_trigger
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION audit_invoice_changes();

-- =============================================================================
-- SAMPLE DATA (for testing only)
-- =============================================================================

-- Note: Sample data should only be inserted in development/testing environments
-- This is commented out but can be uncommented for testing purposes

/*
-- Sample invoice (only if in development)
DO $$
BEGIN
    IF current_setting('app.environment', true) = 'development' THEN
        -- This would create sample data
        -- INSERT INTO invoices (...) VALUES (...);
    END IF;
END $$;
*/

-- =============================================================================
-- MIGRATION COMPLETION
-- =============================================================================

-- Add migration record
INSERT INTO migrations_applied (migration_name, applied_at)
VALUES ('20250122000000_invoicing', NOW())
ON CONFLICT (migration_name) DO NOTHING;-- Initial extensions and shared utility functions
-- Phase 1.3: Initialize required extensions and triggers

-- Enable required extensions (idempotent)
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Create shared updated_at trigger function
-- This function will be applied to all tables with an updated_at column
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Comment on the function for documentation
comment on function set_updated_at() is 'Trigger function to automatically update updated_at timestamp';-- Core tables for Dirt Free CRM
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
comment on column audit_log.meta is 'Additional metadata about the action';-- Database indexes for performance optimization
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
comment on index idx_audit_log_entity is 'Entity-specific audit trail queries';-- Row Level Security (RLS) policies
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
grant select on v_current_user_role to authenticated;-- Seed data for initial system setup
-- Phase 1.3: Insert required reference data for testing and development

-- Insert three trucks with reasonable placeholders
-- These are the initial fleet vehicles for the business
insert into trucks (id, number, name, notes) values
  (uuid_generate_v4(), '01', 'Alpha', 'Primary service vehicle for North zone'),
  (uuid_generate_v4(), '02', 'Bravo', 'Primary service vehicle for South zone'),
  (uuid_generate_v4(), '03', 'Charlie', 'Primary service vehicle for Central zone')
on conflict (number) do nothing;

-- Seed basic tool inventory for each truck
-- Common carpet cleaning tools and supplies
with truck_ids as (
  select id, number from trucks where number in ('01', '02', '03')
),
tools as (
  select * from (values
    ('Carpet Cleaner Machine', 1, 1),
    ('Upholstery Tool', 2, 2),
    ('Vacuum Cleaner', 1, 1),
    ('Steam Cleaner', 1, 1),
    ('Cleaning Solution - Carpet', 5, 4),
    ('Cleaning Solution - Upholstery', 3, 2),
    ('Microfiber Cloths', 10, 8),
    ('Drop Cloths', 5, 4),
    ('Hose Assembly', 2, 2),
    ('Extension Cords', 3, 3)
  ) as t(tool_name, min_qty, qty_on_truck)
)
insert into truck_tools (truck_id, tool_name, min_qty, qty_on_truck, calibration_due)
select
  t.id,
  tools.tool_name,
  tools.min_qty,
  tools.qty_on_truck,
  case
    when tools.tool_name like '%Machine%' or tools.tool_name like '%Cleaner%'
    then current_date + interval '6 months'
    else null
  end as calibration_due
from truck_ids t
cross join tools
on conflict do nothing;

-- Insert sample customer data for testing (optional - can be removed for production)
-- These help with initial testing of the application
insert into customers (id, name, phone_e164, email, address_line1, city, state, postal_code, zone, notes) values
  (
    uuid_generate_v4(),
    'Sample Residential Customer',
    '+15551234567',
    'sample@example.com',
    '123 Main Street',
    'Anytown',
    'State',
    '12345',
    'Central',
    'Initial test customer - remove in production'
  ),
  (
    uuid_generate_v4(),
    'Sample Commercial Client',
    '+15559876543',
    'facilities@business.com',
    '456 Business Boulevard',
    'Commerce City',
    'State',
    '54321',
    'N',
    'Test commercial account - remove in production'
  )
on conflict do nothing;

-- Insert reminder types as reference data
-- These help populate the type dropdown and provide examples
insert into reminders (id, type, origin, title, body, scheduled_date, status) values
  (
    uuid_generate_v4(),
    'follow_up',
    'system',
    'Sample Follow-up Reminder',
    'This is an example follow-up reminder. Delete this in production.',
    current_date + interval '7 days',
    'pending'
  ),
  (
    uuid_generate_v4(),
    'truck',
    'system',
    'Sample Truck Maintenance',
    'Example truck maintenance reminder. Delete this in production.',
    current_date + interval '30 days',
    'pending'
  )
on conflict do nothing;

-- Comments for documentation
comment on table trucks is 'Company vehicles: Alpha (01), Bravo (02), Charlie (03) seeded for initial setup';

-- Log the seeding in audit trail
insert into audit_log (action, entity, meta) values
  ('SEED', 'trucks', '{"count": 3, "numbers": ["01", "02", "03"]}'),
  ('SEED', 'truck_tools', '{"tools_per_truck": 10}'),
  ('SEED', 'customers', '{"count": 2, "type": "test_data"}'),
  ('SEED', 'reminders', '{"count": 2, "type": "examples"}')
on conflict do nothing;-- Truck assignments and Vehicle Board system
-- Enables technician assignment to trucks and thread-based communication

-- Create truck_assignments table
CREATE TABLE IF NOT EXISTS truck_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(truck_id, user_id)
);

-- Create truck_threads table
CREATE TABLE IF NOT EXISTS truck_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text CHECK (status IN ('open', 'acknowledged', 'resolved')) DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

-- Create truck_posts table
CREATE TABLE IF NOT EXISTS truck_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES truck_threads(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('need', 'issue', 'note', 'update')) NOT NULL,
  body text NOT NULL,
  photo_key text,
  urgent boolean DEFAULT false,
  status text CHECK (status IN ('open', 'acknowledged', 'resolved')) DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  reminder_id uuid REFERENCES reminders(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_truck_assignments_user ON truck_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_truck_assignments_truck ON truck_assignments(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_threads_truck ON truck_threads(truck_id, status);
CREATE INDEX IF NOT EXISTS idx_truck_threads_status ON truck_threads(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_truck_posts_thread ON truck_posts(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_truck_posts_urgent ON truck_posts(urgent, status) WHERE urgent = true AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_truck_posts_reminder ON truck_posts(reminder_id) WHERE reminder_id IS NOT NULL;

-- Enable RLS on all tables
ALTER TABLE truck_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_posts ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is assigned to a truck
CREATE OR REPLACE FUNCTION is_assigned_to_truck(truck_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM truck_assignments
    WHERE truck_id = truck_uuid
    AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has admin or dispatcher role
CREATE OR REPLACE FUNCTION has_elevated_role(user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND role IN ('admin', 'dispatcher')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for truck_assignments

-- Admin/dispatcher can view all assignments
CREATE POLICY "Admin/dispatcher view all assignments"
  ON truck_assignments FOR SELECT
  USING (has_elevated_role(auth.uid()));

-- Technicians can view assignments for trucks they're assigned to
CREATE POLICY "Technicians view own assignments"
  ON truck_assignments FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM truck_assignments ta
      WHERE ta.truck_id = truck_assignments.truck_id
      AND ta.user_id = auth.uid()
    )
  );

-- Only admin/dispatcher can insert assignments
CREATE POLICY "Admin/dispatcher create assignments"
  ON truck_assignments FOR INSERT
  WITH CHECK (has_elevated_role(auth.uid()));

-- Only admin/dispatcher can delete assignments
CREATE POLICY "Admin/dispatcher delete assignments"
  ON truck_assignments FOR DELETE
  USING (has_elevated_role(auth.uid()));

-- RLS Policies for truck_threads

-- Admin/dispatcher can view all threads
CREATE POLICY "Admin/dispatcher view all threads"
  ON truck_threads FOR SELECT
  USING (has_elevated_role(auth.uid()));

-- Technicians can view threads for trucks they're assigned to
CREATE POLICY "Technicians view assigned truck threads"
  ON truck_threads FOR SELECT
  USING (is_assigned_to_truck(truck_id, auth.uid()));

-- Admin/dispatcher can create threads on any truck
CREATE POLICY "Admin/dispatcher create threads"
  ON truck_threads FOR INSERT
  WITH CHECK (
    has_elevated_role(auth.uid())
    AND created_by = auth.uid()
  );

-- Technicians can create threads on assigned trucks
CREATE POLICY "Technicians create threads on assigned trucks"
  ON truck_threads FOR INSERT
  WITH CHECK (
    is_assigned_to_truck(truck_id, auth.uid())
    AND created_by = auth.uid()
  );

-- Admin/dispatcher can update any thread
CREATE POLICY "Admin/dispatcher update threads"
  ON truck_threads FOR UPDATE
  USING (has_elevated_role(auth.uid()));

-- Technicians cannot directly update threads (status updates via posts)
-- No technician update policy

-- RLS Policies for truck_posts

-- Admin/dispatcher can view all posts
CREATE POLICY "Admin/dispatcher view all posts"
  ON truck_posts FOR SELECT
  USING (has_elevated_role(auth.uid()));

-- Technicians can view posts in threads for trucks they're assigned to
CREATE POLICY "Technicians view posts in assigned truck threads"
  ON truck_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM truck_threads tt
      JOIN truck_assignments ta ON ta.truck_id = tt.truck_id
      WHERE tt.id = truck_posts.thread_id
      AND ta.user_id = auth.uid()
    )
  );

-- Admin/dispatcher can create posts in any thread
CREATE POLICY "Admin/dispatcher create posts"
  ON truck_posts FOR INSERT
  WITH CHECK (
    has_elevated_role(auth.uid())
    AND created_by = auth.uid()
  );

-- Technicians can create posts in threads for assigned trucks
CREATE POLICY "Technicians create posts in assigned truck threads"
  ON truck_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM truck_threads tt
      JOIN truck_assignments ta ON ta.truck_id = tt.truck_id
      WHERE tt.id = truck_posts.thread_id
      AND ta.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Admin/dispatcher can update any post
CREATE POLICY "Admin/dispatcher update posts"
  ON truck_posts FOR UPDATE
  USING (has_elevated_role(auth.uid()));

-- Technicians can update their own posts (for acknowledgment)
CREATE POLICY "Technicians acknowledge own posts"
  ON truck_posts FOR UPDATE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM truck_threads tt
      JOIN truck_assignments ta ON ta.truck_id = tt.truck_id
      WHERE tt.id = truck_posts.thread_id
      AND ta.user_id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE truck_assignments IS 'Maps technicians to trucks they can access';
COMMENT ON TABLE truck_threads IS 'Communication threads for truck-specific issues';
COMMENT ON TABLE truck_posts IS 'Individual posts within truck threads';
COMMENT ON FUNCTION is_assigned_to_truck IS 'Helper to check truck assignment for RLS';
COMMENT ON FUNCTION has_elevated_role IS 'Helper to check admin/dispatcher role for RLS';

-- Create a view for thread summaries with post counts
CREATE OR REPLACE VIEW truck_thread_summaries AS
SELECT
  tt.id,
  tt.truck_id,
  tt.title,
  tt.status,
  tt.created_by,
  tt.created_at,
  tt.updated_at,
  COUNT(tp.id) AS post_count,
  MAX(tp.created_at) AS last_activity,
  COUNT(CASE WHEN tp.urgent = true AND tp.status = 'open' THEN 1 END) AS urgent_count,
  u.name AS created_by_name
FROM truck_threads tt
LEFT JOIN truck_posts tp ON tp.thread_id = tt.id
LEFT JOIN users u ON u.id = tt.created_by
GROUP BY tt.id, tt.truck_id, tt.title, tt.status, tt.created_by, tt.created_at, tt.updated_at, u.name;

-- Grant access to the view
GRANT SELECT ON truck_thread_summaries TO authenticated;-- Phase 8: Reminders Inbox enhancements
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