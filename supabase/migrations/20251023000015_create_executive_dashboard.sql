-- =====================================================
-- Executive Dashboard Migration
-- =====================================================
-- This migration creates views and functions for executive-level KPIs
-- providing C-level executives with real-time business health overview.

-- =====================================================
-- 1. Executive Dashboard View
-- =====================================================

CREATE OR REPLACE VIEW executive_dashboard AS
SELECT
  -- Financial KPIs - Month to Date (MTD)
  (
    SELECT COALESCE(SUM(i.total_amount), 0)
    FROM invoices i
    WHERE i.status = 'paid'
      AND i.paid_date >= DATE_TRUNC('month', NOW())
      AND i.paid_date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  ) as mtd_revenue,

  (
    SELECT COALESCE(SUM(i.total_amount), 0)
    FROM invoices i
    WHERE i.status = 'paid'
      AND i.paid_date >= DATE_TRUNC('year', NOW())
      AND i.paid_date < DATE_TRUNC('year', NOW()) + INTERVAL '1 year'
  ) as ytd_revenue,

  (
    SELECT COALESCE(AVG(i.total_amount), 0)
    FROM invoices i
    WHERE i.status = 'paid'
      AND i.paid_date >= DATE_TRUNC('month', NOW())
  ) as avg_invoice_value,

  (
    SELECT COALESCE(SUM(i.total_amount), 0)
    FROM invoices i
    WHERE i.status IN ('sent', 'overdue')
  ) as outstanding_receivables,

  (
    SELECT COUNT(DISTINCT i.id)
    FROM invoices i
    WHERE i.status = 'overdue'
  ) as overdue_invoice_count,

  -- Customer KPIs
  (SELECT COUNT(*) FROM customers WHERE deleted = false) as total_customers,

  (
    SELECT COUNT(*)
    FROM customers
    WHERE created_at >= DATE_TRUNC('month', NOW())
      AND deleted = false
  ) as new_customers_mtd,

  (
    SELECT COALESCE(AVG(cl.current_points), 0)
    FROM customer_loyalty cl
    WHERE cl.current_points > 0
  ) as avg_loyalty_points,

  -- Operational KPIs
  (
    SELECT COUNT(*)
    FROM jobs
    WHERE status = 'completed'
      AND completed_at >= DATE_TRUNC('month', NOW())
  ) as mtd_completed_jobs,

  (
    SELECT COUNT(*)
    FROM jobs
    WHERE scheduled_date >= DATE_TRUNC('month', NOW())
      AND scheduled_date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  ) as mtd_total_jobs,

  (
    SELECT COALESCE(AVG(
      CASE
        WHEN j.completed_at IS NOT NULL AND j.scheduled_date IS NOT NULL
        THEN EXTRACT(EPOCH FROM (j.completed_at - j.scheduled_date)) / 3600
        ELSE NULL
      END
    ), 0)
    FROM jobs j
    WHERE j.status = 'completed'
      AND j.completed_at >= DATE_TRUNC('month', NOW())
  ) as avg_job_completion_time_hours,

  (
    SELECT COALESCE(AVG(rr.portal_review_rating), 0)
    FROM review_requests rr
    WHERE rr.portal_review_completed = true
      AND rr.portal_review_submitted_at >= DATE_TRUNC('month', NOW())
  ) as avg_rating_mtd,

  -- Marketing KPIs
  (
    SELECT COUNT(DISTINCT customer_id)
    FROM portal_activities
    WHERE created_at >= DATE_TRUNC('month', NOW())
  ) as portal_active_users_mtd,

  (
    SELECT COUNT(*)
    FROM jobs
    WHERE booking_source = 'portal'
      AND created_at >= DATE_TRUNC('month', NOW())
  ) as portal_bookings_mtd,

  (
    SELECT COUNT(*)
    FROM referrals
    WHERE status = 'converted'
      AND converted_at >= DATE_TRUNC('month', NOW())
  ) as referral_conversions_mtd,

  NOW() as calculated_at;

-- =====================================================
-- 2. Financial KPIs Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_financial_kpis(
  period_start DATE DEFAULT DATE_TRUNC('month', NOW())::DATE,
  period_end DATE DEFAULT NOW()::DATE
)
RETURNS TABLE(
  current_revenue NUMERIC,
  previous_revenue NUMERIC,
  revenue_growth_pct NUMERIC,
  avg_invoice_value NUMERIC,
  previous_avg_invoice_value NUMERIC,
  outstanding_receivables NUMERIC,
  overdue_amount NUMERIC,
  profit_margin_estimate NUMERIC,
  total_costs NUMERIC
) AS $$
DECLARE
  period_days INTEGER;
BEGIN
  period_days := period_end - period_start;

  RETURN QUERY
  SELECT
    -- Current period revenue
    COALESCE(SUM(i.total_amount) FILTER (
      WHERE i.paid_date >= period_start AND i.paid_date <= period_end
    ), 0) as current_revenue,

    -- Previous period revenue (same length)
    COALESCE(SUM(i.total_amount) FILTER (
      WHERE i.paid_date >= (period_start - period_days) AND i.paid_date < period_start
    ), 0) as previous_revenue,

    -- Revenue growth percentage
    CASE
      WHEN SUM(i.total_amount) FILTER (
        WHERE i.paid_date >= (period_start - period_days) AND i.paid_date < period_start
      ) > 0 THEN
        ROUND((
          (SUM(i.total_amount) FILTER (WHERE i.paid_date >= period_start AND i.paid_date <= period_end) -
           SUM(i.total_amount) FILTER (WHERE i.paid_date >= (period_start - period_days) AND i.paid_date < period_start))
          /
          SUM(i.total_amount) FILTER (WHERE i.paid_date >= (period_start - period_days) AND i.paid_date < period_start)
          * 100
        )::numeric, 2)
      ELSE 0
    END as revenue_growth_pct,

    -- Average invoice value (current)
    COALESCE(AVG(i.total_amount) FILTER (
      WHERE i.paid_date >= period_start AND i.paid_date <= period_end
    ), 0) as avg_invoice_value,

    -- Average invoice value (previous)
    COALESCE(AVG(i.total_amount) FILTER (
      WHERE i.paid_date >= (period_start - period_days) AND i.paid_date < period_start
    ), 0) as previous_avg_invoice_value,

    -- Outstanding receivables
    COALESCE(SUM(i.total_amount) FILTER (WHERE i.status IN ('sent', 'overdue')), 0) as outstanding_receivables,

    -- Overdue amount
    COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'overdue'), 0) as overdue_amount,

    -- Profit margin estimate (revenue - estimated costs)
    -- Assuming 35% cost ratio for service business
    ROUND((
      COALESCE(SUM(i.total_amount) FILTER (
        WHERE i.paid_date >= period_start AND i.paid_date <= period_end
      ), 0) * 0.65
    )::numeric, 2) as profit_margin_estimate,

    -- Total costs estimate
    ROUND((
      COALESCE(SUM(i.total_amount) FILTER (
        WHERE i.paid_date >= period_start AND i.paid_date <= period_end
      ), 0) * 0.35
    )::numeric, 2) as total_costs

  FROM invoices i
  WHERE i.status = 'paid' OR i.status IN ('sent', 'overdue');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. Customer KPIs Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_customer_kpis(
  period_start DATE DEFAULT DATE_TRUNC('month', NOW())::DATE,
  period_end DATE DEFAULT NOW()::DATE
)
RETURNS TABLE(
  total_customers INTEGER,
  new_customers INTEGER,
  previous_new_customers INTEGER,
  customer_growth_pct NUMERIC,
  retention_rate NUMERIC,
  avg_customer_ltv NUMERIC,
  nps_score NUMERIC,
  active_customers INTEGER,
  churned_customers INTEGER
) AS $$
DECLARE
  period_days INTEGER;
BEGIN
  period_days := period_end - period_start;

  RETURN QUERY
  WITH customer_metrics AS (
    SELECT
      c.id,
      c.created_at,
      COUNT(DISTINCT j.id) as job_count,
      MAX(j.scheduled_date) as last_job_date,
      COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'paid'), 0) as total_revenue
    FROM customers c
    LEFT JOIN jobs j ON c.id = j.customer_id
    LEFT JOIN invoices i ON j.id = i.job_id
    WHERE c.deleted = false
    GROUP BY c.id, c.created_at
  ),
  nps_data AS (
    SELECT
      CASE
        WHEN portal_review_rating >= 9 THEN 'promoter'
        WHEN portal_review_rating >= 7 THEN 'passive'
        ELSE 'detractor'
      END as category
    FROM review_requests
    WHERE portal_review_completed = true
      AND portal_review_rating IS NOT NULL
      AND portal_review_submitted_at >= period_start
      AND portal_review_submitted_at <= period_end
  )
  SELECT
    COUNT(DISTINCT cm.id)::INTEGER as total_customers,

    -- New customers in current period
    COUNT(DISTINCT cm.id) FILTER (
      WHERE cm.created_at >= period_start AND cm.created_at <= period_end
    )::INTEGER as new_customers,

    -- New customers in previous period
    COUNT(DISTINCT cm.id) FILTER (
      WHERE cm.created_at >= (period_start - period_days) AND cm.created_at < period_start
    )::INTEGER as previous_new_customers,

    -- Customer growth percentage
    CASE
      WHEN COUNT(DISTINCT cm.id) FILTER (
        WHERE cm.created_at >= (period_start - period_days) AND cm.created_at < period_start
      ) > 0 THEN
        ROUND((
          (COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= period_start AND cm.created_at <= period_end)::NUMERIC -
           COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= (period_start - period_days) AND cm.created_at < period_start))
          /
          COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= (period_start - period_days) AND cm.created_at < period_start)
          * 100
        ), 2)
      ELSE 0
    END as customer_growth_pct,

    -- Retention rate (customers with repeat bookings)
    CASE
      WHEN COUNT(DISTINCT cm.id) > 0 THEN
        ROUND((
          COUNT(DISTINCT cm.id) FILTER (WHERE cm.job_count > 1)::NUMERIC /
          COUNT(DISTINCT cm.id)
          * 100
        ), 2)
      ELSE 0
    END as retention_rate,

    -- Average customer lifetime value
    ROUND(COALESCE(AVG(cm.total_revenue), 0), 2) as avg_customer_ltv,

    -- NPS Score (% promoters - % detractors)
    COALESCE((
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE category = 'promoter')::NUMERIC / COUNT(*)::NUMERIC * 100) -
        (COUNT(*) FILTER (WHERE category = 'detractor')::NUMERIC / COUNT(*)::NUMERIC * 100)
      , 2)
      FROM nps_data
    ), 0) as nps_score,

    -- Active customers (booked in last 90 days)
    COUNT(DISTINCT cm.id) FILTER (
      WHERE cm.last_job_date >= NOW() - INTERVAL '90 days'
    )::INTEGER as active_customers,

    -- Churned customers (no booking in 180+ days)
    COUNT(DISTINCT cm.id) FILTER (
      WHERE cm.last_job_date < NOW() - INTERVAL '180 days'
      AND cm.job_count > 0
    )::INTEGER as churned_customers

  FROM customer_metrics cm;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. Operational KPIs Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_operational_kpis(
  period_start DATE DEFAULT DATE_TRUNC('month', NOW())::DATE,
  period_end DATE DEFAULT NOW()::DATE
)
RETURNS TABLE(
  total_jobs_completed INTEGER,
  previous_jobs_completed INTEGER,
  jobs_growth_pct NUMERIC,
  avg_jobs_per_day NUMERIC,
  technician_utilization_rate NUMERIC,
  service_completion_rate NUMERIC,
  avg_customer_rating NUMERIC,
  previous_avg_rating NUMERIC,
  on_time_completion_rate NUMERIC,
  avg_response_time_hours NUMERIC
) AS $$
DECLARE
  period_days INTEGER;
BEGIN
  period_days := period_end - period_start;

  RETURN QUERY
  WITH job_metrics AS (
    SELECT
      j.id,
      j.status,
      j.scheduled_date,
      j.completed_at,
      j.created_at,
      j.estimated_duration,
      CASE
        WHEN j.completed_at IS NOT NULL AND j.scheduled_date IS NOT NULL THEN
          EXTRACT(EPOCH FROM (j.completed_at - j.scheduled_date)) / 3600
        ELSE NULL
      END as completion_time_hours
    FROM jobs j
  ),
  tech_metrics AS (
    SELECT
      u.id as tech_id,
      COUNT(DISTINCT j.id) as jobs_assigned,
      COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') as jobs_completed
    FROM users u
    INNER JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN jobs j ON u.id = j.assigned_to_user_id
      AND j.scheduled_date >= period_start
      AND j.scheduled_date <= period_end
    WHERE ur.role = 'technician'
    GROUP BY u.id
  )
  SELECT
    -- Total jobs completed
    COUNT(DISTINCT jm.id) FILTER (
      WHERE jm.status = 'completed'
      AND jm.completed_at >= period_start
      AND jm.completed_at <= period_end
    )::INTEGER as total_jobs_completed,

    -- Previous period jobs completed
    COUNT(DISTINCT jm.id) FILTER (
      WHERE jm.status = 'completed'
      AND jm.completed_at >= (period_start - period_days)
      AND jm.completed_at < period_start
    )::INTEGER as previous_jobs_completed,

    -- Jobs growth percentage
    CASE
      WHEN COUNT(DISTINCT jm.id) FILTER (
        WHERE jm.status = 'completed'
        AND jm.completed_at >= (period_start - period_days)
        AND jm.completed_at < period_start
      ) > 0 THEN
        ROUND((
          (COUNT(DISTINCT jm.id) FILTER (
            WHERE jm.status = 'completed'
            AND jm.completed_at >= period_start
            AND jm.completed_at <= period_end
          )::NUMERIC -
           COUNT(DISTINCT jm.id) FILTER (
            WHERE jm.status = 'completed'
            AND jm.completed_at >= (period_start - period_days)
            AND jm.completed_at < period_start
          ))
          /
          COUNT(DISTINCT jm.id) FILTER (
            WHERE jm.status = 'completed'
            AND jm.completed_at >= (period_start - period_days)
            AND jm.completed_at < period_start
          )
          * 100
        ), 2)
      ELSE 0
    END as jobs_growth_pct,

    -- Average jobs per day
    ROUND(
      COUNT(DISTINCT jm.id) FILTER (
        WHERE jm.status = 'completed'
        AND jm.completed_at >= period_start
        AND jm.completed_at <= period_end
      )::NUMERIC / NULLIF(period_days, 0)
    , 2) as avg_jobs_per_day,

    -- Technician utilization rate (jobs completed / jobs assigned)
    CASE
      WHEN SUM(tm.jobs_assigned) > 0 THEN
        ROUND((SUM(tm.jobs_completed)::NUMERIC / SUM(tm.jobs_assigned) * 100), 2)
      ELSE 0
    END as technician_utilization_rate,

    -- Service completion rate
    CASE
      WHEN COUNT(DISTINCT jm.id) FILTER (
        WHERE jm.scheduled_date >= period_start
        AND jm.scheduled_date <= period_end
      ) > 0 THEN
        ROUND((
          COUNT(DISTINCT jm.id) FILTER (
            WHERE jm.status = 'completed'
            AND jm.scheduled_date >= period_start
            AND jm.scheduled_date <= period_end
          )::NUMERIC /
          COUNT(DISTINCT jm.id) FILTER (
            WHERE jm.scheduled_date >= period_start
            AND jm.scheduled_date <= period_end
          )
          * 100
        ), 2)
      ELSE 0
    END as service_completion_rate,

    -- Average customer rating (current period)
    COALESCE(ROUND((
      SELECT AVG(portal_review_rating)
      FROM review_requests
      WHERE portal_review_completed = true
        AND portal_review_submitted_at >= period_start
        AND portal_review_submitted_at <= period_end
    ), 2), 0) as avg_customer_rating,

    -- Average customer rating (previous period)
    COALESCE(ROUND((
      SELECT AVG(portal_review_rating)
      FROM review_requests
      WHERE portal_review_completed = true
        AND portal_review_submitted_at >= (period_start - period_days)
        AND portal_review_submitted_at < period_start
    ), 2), 0) as previous_avg_rating,

    -- On-time completion rate (within 2 hours of scheduled time)
    CASE
      WHEN COUNT(DISTINCT jm.id) FILTER (
        WHERE jm.status = 'completed'
        AND jm.completed_at >= period_start
        AND jm.completed_at <= period_end
      ) > 0 THEN
        ROUND((
          COUNT(DISTINCT jm.id) FILTER (
            WHERE jm.status = 'completed'
            AND jm.completed_at >= period_start
            AND jm.completed_at <= period_end
            AND jm.completion_time_hours <= 2
          )::NUMERIC /
          COUNT(DISTINCT jm.id) FILTER (
            WHERE jm.status = 'completed'
            AND jm.completed_at >= period_start
            AND jm.completed_at <= period_end
          )
          * 100
        ), 2)
      ELSE 0
    END as on_time_completion_rate,

    -- Average response time (booking to completion)
    COALESCE(ROUND(AVG(jm.completion_time_hours) FILTER (
      WHERE jm.status = 'completed'
      AND jm.completed_at >= period_start
      AND jm.completed_at <= period_end
    ), 2), 0) as avg_response_time_hours

  FROM job_metrics jm
  CROSS JOIN tech_metrics tm;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Marketing KPIs Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_marketing_kpis(
  period_start DATE DEFAULT DATE_TRUNC('month', NOW())::DATE,
  period_end DATE DEFAULT NOW()::DATE
)
RETURNS TABLE(
  portal_adoption_rate NUMERIC,
  portal_bookings INTEGER,
  total_bookings INTEGER,
  campaign_avg_roi NUMERIC,
  referral_conversion_rate NUMERIC,
  total_referrals INTEGER,
  converted_referrals INTEGER,
  avg_review_score NUMERIC,
  review_count INTEGER,
  email_open_rate NUMERIC,
  email_click_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Portal adoption rate (portal bookings / total bookings)
    CASE
      WHEN COUNT(DISTINCT j.id) > 0 THEN
        ROUND((
          COUNT(DISTINCT j.id) FILTER (WHERE j.booking_source = 'portal')::NUMERIC /
          COUNT(DISTINCT j.id)
          * 100
        ), 2)
      ELSE 0
    END as portal_adoption_rate,

    -- Portal bookings
    COUNT(DISTINCT j.id) FILTER (
      WHERE j.booking_source = 'portal'
      AND j.created_at >= period_start
      AND j.created_at <= period_end
    )::INTEGER as portal_bookings,

    -- Total bookings
    COUNT(DISTINCT j.id) FILTER (
      WHERE j.created_at >= period_start
      AND j.created_at <= period_end
    )::INTEGER as total_bookings,

    -- Campaign average ROI
    COALESCE((
      SELECT ROUND(AVG(
        CASE
          WHEN campaign_cost > 0 THEN
            ((revenue - campaign_cost) / campaign_cost * 100)
          ELSE 0
        END
      ), 2)
      FROM (
        SELECT
          mc.id,
          COALESCE(mc.cost, 0) as campaign_cost,
          COALESCE(SUM(i.total_amount), 0) as revenue
        FROM marketing_campaigns mc
        LEFT JOIN campaign_leads cl ON mc.id = cl.campaign_id
        LEFT JOIN jobs j ON cl.customer_id = j.customer_id
        LEFT JOIN invoices i ON j.id = i.job_id AND i.status = 'paid'
        WHERE mc.start_date >= period_start
          AND mc.start_date <= period_end
        GROUP BY mc.id, mc.cost
      ) campaign_revenue
    ), 0) as campaign_avg_roi,

    -- Referral conversion rate
    CASE
      WHEN COUNT(DISTINCT r.id) > 0 THEN
        ROUND((
          COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'converted')::NUMERIC /
          COUNT(DISTINCT r.id)
          * 100
        ), 2)
      ELSE 0
    END as referral_conversion_rate,

    -- Total referrals
    COUNT(DISTINCT r.id) FILTER (
      WHERE r.created_at >= period_start
      AND r.created_at <= period_end
    )::INTEGER as total_referrals,

    -- Converted referrals
    COUNT(DISTINCT r.id) FILTER (
      WHERE r.status = 'converted'
      AND r.created_at >= period_start
      AND r.created_at <= period_end
    )::INTEGER as converted_referrals,

    -- Average review score
    COALESCE(ROUND((
      SELECT AVG(portal_review_rating)
      FROM review_requests
      WHERE portal_review_completed = true
        AND portal_review_submitted_at >= period_start
        AND portal_review_submitted_at <= period_end
    ), 2), 0) as avg_review_score,

    -- Review count
    (
      SELECT COUNT(*)
      FROM review_requests
      WHERE portal_review_completed = true
        AND portal_review_submitted_at >= period_start
        AND portal_review_submitted_at <= period_end
    )::INTEGER as review_count,

    -- Email open rate
    CASE
      WHEN COUNT(DISTINCT com.id) FILTER (WHERE com.channel = 'email') > 0 THEN
        ROUND((
          COUNT(DISTINCT com.id) FILTER (
            WHERE com.channel = 'email' AND com.opened_at IS NOT NULL
          )::NUMERIC /
          COUNT(DISTINCT com.id) FILTER (WHERE com.channel = 'email')
          * 100
        ), 2)
      ELSE 0
    END as email_open_rate,

    -- Email click rate
    CASE
      WHEN COUNT(DISTINCT com.id) FILTER (WHERE com.channel = 'email') > 0 THEN
        ROUND((
          COUNT(DISTINCT com.id) FILTER (
            WHERE com.channel = 'email' AND com.clicked_at IS NOT NULL
          )::NUMERIC /
          COUNT(DISTINCT com.id) FILTER (WHERE com.channel = 'email')
          * 100
        ), 2)
      ELSE 0
    END as email_click_rate

  FROM jobs j
  LEFT JOIN referrals r ON j.customer_id = r.referred_customer_id
  LEFT JOIN communications com ON j.customer_id = com.customer_id
    AND com.sent_at >= period_start
    AND com.sent_at <= period_end;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Revenue Trend Function (12 months)
-- =====================================================

CREATE OR REPLACE FUNCTION get_revenue_trend_12m()
RETURNS TABLE(
  month DATE,
  revenue NUMERIC,
  job_count INTEGER,
  avg_invoice_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', i.paid_date)::DATE as month,
    SUM(i.total_amount) as revenue,
    COUNT(DISTINCT i.job_id)::INTEGER as job_count,
    ROUND(AVG(i.total_amount), 2) as avg_invoice_value
  FROM invoices i
  WHERE i.status = 'paid'
    AND i.paid_date >= NOW() - INTERVAL '12 months'
    AND i.paid_date < NOW()
  GROUP BY DATE_TRUNC('month', i.paid_date)
  ORDER BY month ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Customer Acquisition Trend Function (12 months)
-- =====================================================

CREATE OR REPLACE FUNCTION get_customer_acquisition_trend_12m()
RETURNS TABLE(
  month DATE,
  new_customers INTEGER,
  total_customers INTEGER,
  growth_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_customers AS (
    SELECT
      DATE_TRUNC('month', created_at)::DATE as month,
      COUNT(*)::INTEGER as new_customers
    FROM customers
    WHERE created_at >= NOW() - INTERVAL '12 months'
      AND deleted = false
    GROUP BY DATE_TRUNC('month', created_at)
  ),
  running_totals AS (
    SELECT
      mc.month,
      mc.new_customers,
      (
        SELECT COUNT(*)::INTEGER
        FROM customers
        WHERE created_at <= mc.month + INTERVAL '1 month' - INTERVAL '1 day'
          AND deleted = false
      ) as total_customers
    FROM monthly_customers mc
  )
  SELECT
    rt.month,
    rt.new_customers,
    rt.total_customers,
    CASE
      WHEN LAG(rt.new_customers) OVER (ORDER BY rt.month) > 0 THEN
        ROUND((
          (rt.new_customers - LAG(rt.new_customers) OVER (ORDER BY rt.month))::NUMERIC /
          LAG(rt.new_customers) OVER (ORDER BY rt.month)
          * 100
        ), 2)
      ELSE 0
    END as growth_rate
  FROM running_totals rt
  ORDER BY rt.month ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Goal Tracking Table
-- =====================================================

CREATE TABLE IF NOT EXISTS executive_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  metric_category VARCHAR(50) NOT NULL CHECK (metric_category IN ('financial', 'customer', 'operational', 'marketing', 'growth')),
  target_value NUMERIC NOT NULL,
  current_value NUMERIC,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'off_track', 'achieved')),
  notes TEXT,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_executive_goals_category ON executive_goals(metric_category);
CREATE INDEX idx_executive_goals_period ON executive_goals(period_start, period_end);
CREATE INDEX idx_executive_goals_status ON executive_goals(status);

-- =====================================================
-- 9. Row Level Security (RLS)
-- =====================================================

ALTER TABLE executive_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view goals"
  ON executive_goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can manage goals"
  ON executive_goals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- =====================================================
-- 10. Helper Function - Update Goal Status
-- =====================================================

CREATE OR REPLACE FUNCTION update_executive_goal_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-update status based on current_value vs target_value
  IF NEW.current_value >= NEW.target_value THEN
    NEW.status := 'achieved';
  ELSIF NEW.current_value >= (NEW.target_value * 0.9) THEN
    NEW.status := 'on_track';
  ELSIF NEW.current_value >= (NEW.target_value * 0.75) THEN
    NEW.status := 'at_risk';
  ELSE
    NEW.status := 'off_track';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_goal_status_trigger
  BEFORE UPDATE ON executive_goals
  FOR EACH ROW
  WHEN (NEW.current_value IS DISTINCT FROM OLD.current_value)
  EXECUTE FUNCTION update_executive_goal_status();

COMMENT ON TABLE executive_goals IS 'Stores executive KPI goals and targets for performance tracking';
COMMENT ON VIEW executive_dashboard IS 'Real-time executive dashboard with key business metrics';
COMMENT ON FUNCTION get_financial_kpis IS 'Returns comprehensive financial KPIs with period-over-period comparison';
COMMENT ON FUNCTION get_customer_kpis IS 'Returns customer acquisition, retention, and satisfaction metrics';
COMMENT ON FUNCTION get_operational_kpis IS 'Returns operational efficiency and service quality metrics';
COMMENT ON FUNCTION get_marketing_kpis IS 'Returns marketing effectiveness and channel performance metrics';
