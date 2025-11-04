-- =============================================================================
-- FIXED DATABASE MIGRATION FOR DIRT FREE CRM
-- =============================================================================
-- Runs migrations in the correct dependency order
-- 1. Extensions first
-- 2. Core tables (in dependency order)
-- 3. Indexes
-- 4. RLS Policies
-- 5. Additional features
-- 6. Seed data

-- =============================================================================
-- STEP 1: EXTENSIONS (20250918000000_000_init_extensions.sql)
-- =============================================================================-- Initial extensions and shared utility functions
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
comment on function set_updated_at() is 'Trigger function to automatically update updated_at timestamp';
-- =============================================================================
-- STEP 2: CORE TABLES (20250918000001_010_core_tables.sql)
-- =============================================================================
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
-- =============================================================================
-- STEP 3: INVOICING SYSTEM (20250122000000_invoicing.sql)
-- Now that jobs table exists, we can add invoices
-- =============================================================================
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
            JOIN jobs ON jobs.technician_id = auth.users.id
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
            JOIN jobs ON jobs.technician_id = auth.users.id
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
            JOIN jobs ON jobs.technician_id = auth.users.id
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

-- Migration completed successfully
-- All tables created with proper dependencies