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
ON CONFLICT (migration_name) DO NOTHING;