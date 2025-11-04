-- =====================================================
-- Custom Reports System Migration
-- =====================================================
-- This migration creates a flexible report builder system
-- that allows staff to create ad-hoc reports without developer intervention.

-- =====================================================
-- 1. Custom Reports Table
-- =====================================================

CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name VARCHAR(255) NOT NULL,
  report_description TEXT,
  data_source VARCHAR(50) NOT NULL CHECK (data_source IN ('customers', 'jobs', 'invoices', 'payments', 'promotions', 'messages', 'reviews', 'loyalty')),
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Column format: [{"field": "name", "label": "Customer Name", "type": "string", "aggregate": null}, ...]
  -- Aggregate types: "sum", "avg", "count", "min", "max", "count_distinct"
  filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Filter format: [{"field": "created_at", "operator": ">=", "value": "2024-01-01", "logic": "AND"}, ...]
  -- Operators: "=", "!=", ">", "<", ">=", "<=", "contains", "not_contains", "in", "not_in", "between", "is_null", "is_not_null"
  grouping JSONB DEFAULT '[]'::jsonb,
  -- Grouping format: [{"field": "zone", "order": 1}, {"field": "service_type", "order": 2}]
  sorting JSONB DEFAULT '[]'::jsonb,
  -- Sorting format: [{"field": "total_amount", "direction": "desc"}, ...]
  visualization_type VARCHAR(30) DEFAULT 'table' CHECK (visualization_type IN ('table', 'bar', 'line', 'pie', 'area', 'scatter')),
  visualization_config JSONB DEFAULT '{}'::jsonb,
  -- Config format: {"x_axis": "date", "y_axis": "revenue", "color_by": "status"}
  schedule JSONB DEFAULT NULL,
  -- Schedule format: {"enabled": true, "frequency": "daily", "time": "09:00", "timezone": "America/New_York", "recipients": ["email@example.com"], "format": "csv"}
  -- Frequencies: "daily", "weekly", "monthly", "once"
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_custom_reports_creator ON custom_reports(created_by_user_id);
CREATE INDEX idx_custom_reports_data_source ON custom_reports(data_source);
CREATE INDEX idx_custom_reports_is_public ON custom_reports(is_public);
CREATE INDEX idx_custom_reports_schedule ON custom_reports USING GIN (schedule);

-- =====================================================
-- 2. Report Execution Logs
-- =====================================================

CREATE TABLE IF NOT EXISTS report_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES custom_reports(id) ON DELETE CASCADE,
  executed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  execution_type VARCHAR(20) DEFAULT 'manual' CHECK (execution_type IN ('manual', 'scheduled')),
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  row_count INTEGER,
  execution_time_ms INTEGER,
  error_message TEXT,
  result_file_url TEXT, -- S3 URL if result is exported
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_report_execution_logs_report ON report_execution_logs(report_id);
CREATE INDEX idx_report_execution_logs_executed_by ON report_execution_logs(executed_by_user_id);
CREATE INDEX idx_report_execution_logs_created_at ON report_execution_logs(created_at);

-- =====================================================
-- 3. Report Data Source Metadata
-- =====================================================
-- This table defines available data sources and their queryable fields

CREATE TABLE IF NOT EXISTS report_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name VARCHAR(50) UNIQUE NOT NULL,
  source_label VARCHAR(100) NOT NULL,
  base_table VARCHAR(100) NOT NULL,
  description TEXT,
  available_fields JSONB NOT NULL,
  -- Field format: [{"field": "name", "label": "Customer Name", "type": "string", "aggregatable": false, "filterable": true, "sortable": true}, ...]
  -- Types: "string", "number", "date", "boolean", "json"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert metadata for available data sources
INSERT INTO report_data_sources (source_name, source_label, base_table, description, available_fields) VALUES

-- Customers data source
('customers', 'Customers', 'customers', 'Customer information and profiles', '[
  {"field": "id", "label": "Customer ID", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "name", "label": "Customer Name", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "email", "label": "Email", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "phone", "label": "Phone", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "address", "label": "Address", "type": "string", "aggregatable": false, "filterable": true, "sortable": false},
  {"field": "city", "label": "City", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "state", "label": "State", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "zip_code", "label": "ZIP Code", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "source", "label": "Source", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "created_at", "label": "Created Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "total_jobs", "label": "Total Jobs", "type": "number", "aggregatable": true, "filterable": true, "sortable": true, "calculated": true},
  {"field": "total_revenue", "label": "Total Revenue", "type": "number", "aggregatable": true, "filterable": true, "sortable": true, "calculated": true},
  {"field": "last_job_date", "label": "Last Job Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true}
]'::jsonb),

-- Jobs data source
('jobs', 'Jobs', 'jobs', 'Job bookings and scheduling', '[
  {"field": "id", "label": "Job ID", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "customer_name", "label": "Customer Name", "type": "string", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true},
  {"field": "service_type", "label": "Service Type", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "status", "label": "Status", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "scheduled_date", "label": "Scheduled Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "completed_at", "label": "Completed Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "zone", "label": "Zone", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "technician", "label": "Technician", "type": "string", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true},
  {"field": "booking_source", "label": "Booking Source", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "estimated_duration", "label": "Estimated Duration (mins)", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "actual_duration", "label": "Actual Duration (mins)", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "created_at", "label": "Created Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true}
]'::jsonb),

-- Invoices data source
('invoices', 'Invoices', 'invoices', 'Invoice and billing information', '[
  {"field": "id", "label": "Invoice ID", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "invoice_number", "label": "Invoice Number", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "customer_name", "label": "Customer Name", "type": "string", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true},
  {"field": "status", "label": "Status", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "subtotal", "label": "Subtotal", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "tax_amount", "label": "Tax Amount", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "discount_amount", "label": "Discount Amount", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "total_amount", "label": "Total Amount", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "due_date", "label": "Due Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "paid_date", "label": "Paid Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "created_at", "label": "Created Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "days_overdue", "label": "Days Overdue", "type": "number", "aggregatable": true, "filterable": true, "sortable": true, "calculated": true}
]'::jsonb),

-- Payments data source
('payments', 'Payments', 'payments', 'Payment transactions', '[
  {"field": "id", "label": "Payment ID", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "customer_name", "label": "Customer Name", "type": "string", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true},
  {"field": "payment_method", "label": "Payment Method", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "amount", "label": "Amount", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "status", "label": "Status", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "transaction_id", "label": "Transaction ID", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "payment_date", "label": "Payment Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "created_at", "label": "Created Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true}
]'::jsonb),

-- Promotions data source
('promotions', 'Promotions', 'promotions', 'Promotional codes and discounts', '[
  {"field": "id", "label": "Promotion ID", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "code", "label": "Promotion Code", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "description", "label": "Description", "type": "string", "aggregatable": false, "filterable": true, "sortable": false},
  {"field": "discount_type", "label": "Discount Type", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "discount_value", "label": "Discount Value", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "times_claimed", "label": "Times Claimed", "type": "number", "aggregatable": true, "filterable": true, "sortable": true, "calculated": true},
  {"field": "times_redeemed", "label": "Times Redeemed", "type": "number", "aggregatable": true, "filterable": true, "sortable": true, "calculated": true},
  {"field": "revenue_generated", "label": "Revenue Generated", "type": "number", "aggregatable": true, "filterable": true, "sortable": true, "calculated": true},
  {"field": "valid_from", "label": "Valid From", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "valid_until", "label": "Valid Until", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "active", "label": "Active", "type": "boolean", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "created_at", "label": "Created Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true}
]'::jsonb),

-- Messages data source
('messages', 'Messages', 'communications', 'Customer communications', '[
  {"field": "id", "label": "Message ID", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "customer_name", "label": "Customer Name", "type": "string", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true},
  {"field": "type", "label": "Type", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "channel", "label": "Channel", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "status", "label": "Status", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "sent_at", "label": "Sent Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "opened_at", "label": "Opened Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "clicked_at", "label": "Clicked Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "campaign_id", "label": "Campaign ID", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "created_at", "label": "Created Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true}
]'::jsonb),

-- Reviews data source
('reviews', 'Reviews', 'reviews', 'Customer reviews and ratings', '[
  {"field": "id", "label": "Review ID", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "customer_name", "label": "Customer Name", "type": "string", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true},
  {"field": "rating", "label": "Rating", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "comment", "label": "Comment", "type": "string", "aggregatable": false, "filterable": true, "sortable": false},
  {"field": "service_type", "label": "Service Type", "type": "string", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true},
  {"field": "technician", "label": "Technician", "type": "string", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true},
  {"field": "submitted_at", "label": "Submitted Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "source", "label": "Source", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "created_at", "label": "Created Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true}
]'::jsonb),

-- Loyalty data source
('loyalty', 'Loyalty Program', 'customer_loyalty', 'Loyalty program participation', '[
  {"field": "customer_name", "label": "Customer Name", "type": "string", "aggregatable": false, "filterable": true, "sortable": true, "calculated": true},
  {"field": "current_tier", "label": "Current Tier", "type": "string", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "current_points", "label": "Current Points", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "lifetime_points", "label": "Lifetime Points", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "points_redeemed", "label": "Points Redeemed", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "tier_progress", "label": "Tier Progress", "type": "number", "aggregatable": true, "filterable": true, "sortable": true},
  {"field": "enrolled_at", "label": "Enrolled Date", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "last_activity_at", "label": "Last Activity", "type": "date", "aggregatable": false, "filterable": true, "sortable": true},
  {"field": "achievements_count", "label": "Achievements Count", "type": "number", "aggregatable": true, "filterable": true, "sortable": true, "calculated": true}
]'::jsonb);

-- =====================================================
-- 4. Dynamic Report Execution Function
-- =====================================================
-- This function builds and executes SQL queries based on report configuration

CREATE OR REPLACE FUNCTION execute_custom_report(
  report_config JSONB,
  limit_rows INTEGER DEFAULT 1000,
  offset_rows INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  data_source TEXT;
  base_query TEXT;
  select_clause TEXT := '';
  from_clause TEXT;
  where_clause TEXT := '';
  group_clause TEXT := '';
  order_clause TEXT := '';
  column_item JSONB;
  filter_item JSONB;
  group_item JSONB;
  sort_item JSONB;
  filter_logic TEXT := 'AND';
  result JSONB;
BEGIN
  -- Extract data source
  data_source := report_config->>'data_source';

  -- Build SELECT clause with aggregations
  FOR column_item IN SELECT * FROM jsonb_array_elements(report_config->'columns')
  LOOP
    IF select_clause <> '' THEN
      select_clause := select_clause || ', ';
    END IF;

    IF column_item->>'aggregate' IS NOT NULL AND column_item->>'aggregate' <> 'null' THEN
      -- Apply aggregation
      CASE column_item->>'aggregate'
        WHEN 'sum' THEN
          select_clause := select_clause || 'SUM(' || (column_item->>'field') || ') as ' || (column_item->>'field');
        WHEN 'avg' THEN
          select_clause := select_clause || 'ROUND(AVG(' || (column_item->>'field') || ')::numeric, 2) as ' || (column_item->>'field');
        WHEN 'count' THEN
          select_clause := select_clause || 'COUNT(' || (column_item->>'field') || ') as ' || (column_item->>'field');
        WHEN 'count_distinct' THEN
          select_clause := select_clause || 'COUNT(DISTINCT ' || (column_item->>'field') || ') as ' || (column_item->>'field');
        WHEN 'min' THEN
          select_clause := select_clause || 'MIN(' || (column_item->>'field') || ') as ' || (column_item->>'field');
        WHEN 'max' THEN
          select_clause := select_clause || 'MAX(' || (column_item->>'field') || ') as ' || (column_item->>'field');
      END CASE;
    ELSE
      -- Regular column
      select_clause := select_clause || (column_item->>'field');
    END IF;
  END LOOP;

  -- Build FROM clause based on data source
  CASE data_source
    WHEN 'customers' THEN
      from_clause := 'FROM customers c LEFT JOIN jobs j ON c.id = j.customer_id LEFT JOIN invoices i ON j.id = i.job_id AND i.status = ''paid''';
    WHEN 'jobs' THEN
      from_clause := 'FROM jobs j LEFT JOIN customers c ON j.customer_id = c.id LEFT JOIN users u ON j.assigned_to_user_id = u.id';
    WHEN 'invoices' THEN
      from_clause := 'FROM invoices i LEFT JOIN jobs j ON i.job_id = j.id LEFT JOIN customers c ON j.customer_id = c.id';
    WHEN 'payments' THEN
      from_clause := 'FROM payments p LEFT JOIN invoices i ON p.invoice_id = i.id LEFT JOIN jobs j ON i.job_id = j.id LEFT JOIN customers c ON j.customer_id = c.id';
    WHEN 'promotions' THEN
      from_clause := 'FROM promotions p LEFT JOIN promotion_claims pc ON p.id = pc.promotion_id LEFT JOIN invoices i ON pc.invoice_id = i.id';
    WHEN 'messages' THEN
      from_clause := 'FROM communications com LEFT JOIN customers c ON com.customer_id = c.id';
    WHEN 'reviews' THEN
      from_clause := 'FROM reviews r LEFT JOIN jobs j ON r.job_id = j.id LEFT JOIN customers c ON j.customer_id = c.id LEFT JOIN users u ON j.assigned_to_user_id = u.id';
    WHEN 'loyalty' THEN
      from_clause := 'FROM customer_loyalty cl LEFT JOIN customers c ON cl.customer_id = c.id LEFT JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id';
    ELSE
      RAISE EXCEPTION 'Invalid data source: %', data_source;
  END CASE;

  -- Build WHERE clause with filters
  IF jsonb_array_length(report_config->'filters') > 0 THEN
    where_clause := 'WHERE ';
    FOR filter_item IN SELECT * FROM jsonb_array_elements(report_config->'filters')
    LOOP
      IF where_clause <> 'WHERE ' THEN
        filter_logic := COALESCE(filter_item->>'logic', 'AND');
        where_clause := where_clause || ' ' || filter_logic || ' ';
      END IF;

      -- Build filter condition based on operator
      CASE filter_item->>'operator'
        WHEN '=' THEN
          where_clause := where_clause || (filter_item->>'field') || ' = ''' || (filter_item->>'value') || '''';
        WHEN '!=' THEN
          where_clause := where_clause || (filter_item->>'field') || ' != ''' || (filter_item->>'value') || '''';
        WHEN '>' THEN
          where_clause := where_clause || (filter_item->>'field') || ' > ''' || (filter_item->>'value') || '''';
        WHEN '<' THEN
          where_clause := where_clause || (filter_item->>'field') || ' < ''' || (filter_item->>'value') || '''';
        WHEN '>=' THEN
          where_clause := where_clause || (filter_item->>'field') || ' >= ''' || (filter_item->>'value') || '''';
        WHEN '<=' THEN
          where_clause := where_clause || (filter_item->>'field') || ' <= ''' || (filter_item->>'value') || '''';
        WHEN 'contains' THEN
          where_clause := where_clause || (filter_item->>'field') || ' ILIKE ''%' || (filter_item->>'value') || '%''';
        WHEN 'not_contains' THEN
          where_clause := where_clause || (filter_item->>'field') || ' NOT ILIKE ''%' || (filter_item->>'value') || '%''';
        WHEN 'between' THEN
          where_clause := where_clause || (filter_item->>'field') || ' BETWEEN ''' || (filter_item->'value'->>0) || ''' AND ''' || (filter_item->'value'->>1) || '''';
        WHEN 'is_null' THEN
          where_clause := where_clause || (filter_item->>'field') || ' IS NULL';
        WHEN 'is_not_null' THEN
          where_clause := where_clause || (filter_item->>'field') || ' IS NOT NULL';
      END CASE;
    END LOOP;
  END IF;

  -- Build GROUP BY clause
  IF jsonb_array_length(report_config->'grouping') > 0 THEN
    group_clause := 'GROUP BY ';
    FOR group_item IN SELECT * FROM jsonb_array_elements(report_config->'grouping')
    LOOP
      IF group_clause <> 'GROUP BY ' THEN
        group_clause := group_clause || ', ';
      END IF;
      group_clause := group_clause || (group_item->>'field');
    END LOOP;
  END IF;

  -- Build ORDER BY clause
  IF jsonb_array_length(report_config->'sorting') > 0 THEN
    order_clause := 'ORDER BY ';
    FOR sort_item IN SELECT * FROM jsonb_array_elements(report_config->'sorting')
    LOOP
      IF order_clause <> 'ORDER BY ' THEN
        order_clause := order_clause || ', ';
      END IF;
      order_clause := order_clause || (sort_item->>'field') || ' ' || UPPER(sort_item->>'direction');
    END LOOP;
  END IF;

  -- Construct final query
  base_query := 'SELECT ' || select_clause || ' ' || from_clause;

  IF where_clause <> '' THEN
    base_query := base_query || ' ' || where_clause;
  END IF;

  IF group_clause <> '' THEN
    base_query := base_query || ' ' || group_clause;
  END IF;

  IF order_clause <> '' THEN
    base_query := base_query || ' ' || order_clause;
  END IF;

  base_query := base_query || ' LIMIT ' || limit_rows || ' OFFSET ' || offset_rows;

  -- Execute query and return results as JSONB
  EXECUTE 'SELECT jsonb_agg(row_to_json(t.*)) FROM (' || base_query || ') t' INTO result;

  RETURN COALESCE(result, '[]'::jsonb);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error executing custom report: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Report Scheduling Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_scheduled_reports_due()
RETURNS TABLE(
  report_id UUID,
  report_name VARCHAR,
  schedule JSONB,
  created_by_user_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id as report_id,
    cr.report_name,
    cr.schedule,
    cr.created_by_user_id
  FROM custom_reports cr
  WHERE cr.schedule IS NOT NULL
    AND (cr.schedule->>'enabled')::boolean = true
    AND cr.is_active = true
    AND (
      -- Daily reports
      (cr.schedule->>'frequency' = 'daily' AND
       NOW()::time >= (cr.schedule->>'time')::time AND
       (cr.last_run_at IS NULL OR cr.last_run_at::date < NOW()::date))
      OR
      -- Weekly reports
      (cr.schedule->>'frequency' = 'weekly' AND
       EXTRACT(DOW FROM NOW()) = (cr.schedule->>'day_of_week')::integer AND
       NOW()::time >= (cr.schedule->>'time')::time AND
       (cr.last_run_at IS NULL OR cr.last_run_at < NOW() - INTERVAL '6 days'))
      OR
      -- Monthly reports
      (cr.schedule->>'frequency' = 'monthly' AND
       EXTRACT(DAY FROM NOW()) = (cr.schedule->>'day_of_month')::integer AND
       NOW()::time >= (cr.schedule->>'time')::time AND
       (cr.last_run_at IS NULL OR cr.last_run_at < NOW() - INTERVAL '25 days'))
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Row Level Security (RLS)
-- =====================================================

ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_data_sources ENABLE ROW LEVEL SECURITY;

-- Custom Reports Policies
CREATE POLICY "Staff can view all public reports"
  ON custom_reports FOR SELECT
  USING (
    is_public = true AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'manager', 'dispatcher')
    )
  );

CREATE POLICY "Users can view their own reports"
  ON custom_reports FOR SELECT
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Staff can create reports"
  ON custom_reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'manager', 'dispatcher')
    )
  );

CREATE POLICY "Users can update their own reports"
  ON custom_reports FOR UPDATE
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own reports"
  ON custom_reports FOR DELETE
  USING (created_by_user_id = auth.uid());

-- Report Execution Logs Policies
CREATE POLICY "Staff can view all execution logs"
  ON report_execution_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'manager', 'dispatcher')
    )
  );

CREATE POLICY "Staff can create execution logs"
  ON report_execution_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Report Data Sources Policies
CREATE POLICY "Staff can view data sources"
  ON report_data_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- =====================================================
-- 7. Helper Functions
-- =====================================================

-- Update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_reports_updated_at
  BEFORE UPDATE ON custom_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_report_updated_at();

-- =====================================================
-- 8. Indexes for Performance
-- =====================================================

CREATE INDEX idx_custom_reports_active ON custom_reports(is_active) WHERE is_active = true;
CREATE INDEX idx_custom_reports_last_run ON custom_reports(last_run_at);
CREATE INDEX idx_report_execution_logs_status ON report_execution_logs(status);

COMMENT ON TABLE custom_reports IS 'Stores custom report templates created by users';
COMMENT ON TABLE report_execution_logs IS 'Tracks execution history of custom reports';
COMMENT ON TABLE report_data_sources IS 'Metadata for available data sources in report builder';
COMMENT ON FUNCTION execute_custom_report IS 'Dynamically builds and executes SQL queries based on report configuration';
COMMENT ON FUNCTION get_scheduled_reports_due IS 'Returns list of scheduled reports that are due to run';
