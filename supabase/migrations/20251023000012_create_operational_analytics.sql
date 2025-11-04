-- Create operational analytics views and functions

-- 1. Operational Metrics by Week
CREATE OR REPLACE VIEW operational_metrics_weekly AS
SELECT
  DATE_TRUNC('week', j.scheduled_date)::DATE as week,
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completed_jobs,
  COUNT(CASE WHEN j.status = 'cancelled' THEN 1 END) as cancelled_jobs,
  COUNT(CASE WHEN j.status = 'scheduled' THEN 1 END) as scheduled_jobs,
  ROUND(
    COUNT(CASE WHEN j.status = 'completed' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(*)::NUMERIC, 0) * 100,
    2
  ) as completion_rate_pct,
  AVG(CASE WHEN j.status = 'completed' THEN j.actual_duration END) as avg_job_duration_mins,
  COUNT(DISTINCT j.assigned_technician_id) as active_technicians,
  ROUND(
    COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT j.assigned_technician_id)::NUMERIC, 0),
    2
  ) as jobs_per_technician
FROM jobs j
WHERE j.scheduled_date IS NOT NULL
GROUP BY DATE_TRUNC('week', j.scheduled_date)::DATE
ORDER BY week DESC;

-- 2. Job Performance Overview
CREATE OR REPLACE VIEW job_performance_overview AS
SELECT
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
  COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_jobs,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_jobs,
  ROUND(
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(*)::NUMERIC, 0) * 100,
    2
  ) as completion_rate_pct,
  ROUND(
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(*)::NUMERIC, 0) * 100,
    2
  ) as cancellation_rate_pct,
  AVG(CASE WHEN status = 'completed' THEN actual_duration END) as avg_job_duration_mins,
  COUNT(DISTINCT assigned_technician_id) as total_technicians
FROM jobs;

-- 3. Technician Performance
CREATE OR REPLACE VIEW technician_performance AS
SELECT
  u.id as technician_id,
  u.first_name || ' ' || u.last_name as technician_name,
  COUNT(j.id) as total_jobs,
  COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completed_jobs,
  COUNT(CASE WHEN j.status = 'cancelled' THEN 1 END) as cancelled_jobs,
  ROUND(
    COUNT(CASE WHEN j.status = 'completed' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(j.id)::NUMERIC, 0) * 100,
    2
  ) as completion_rate_pct,
  AVG(CASE WHEN j.status = 'completed' THEN j.actual_duration END) as avg_job_duration_mins,
  SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as total_revenue,
  AVG(CASE WHEN j.status = 'completed' AND j.customer_rating IS NOT NULL THEN j.customer_rating END) as avg_rating,
  COUNT(CASE WHEN j.status = 'completed' AND j.customer_rating IS NOT NULL THEN 1 END) as rating_count,
  -- Efficiency score: combination of completion rate, on-time rate, and rating
  ROUND(
    (
      (COUNT(CASE WHEN j.status = 'completed' THEN 1 END)::NUMERIC / NULLIF(COUNT(j.id)::NUMERIC, 0) * 40) +
      (COALESCE(AVG(CASE WHEN j.status = 'completed' AND j.customer_rating IS NOT NULL THEN j.customer_rating END), 0) * 10) +
      (CASE WHEN AVG(CASE WHEN j.status = 'completed' THEN j.actual_duration END) <= AVG(CASE WHEN j.status = 'completed' THEN j.estimated_duration END) THEN 30 ELSE 20 END) +
      20 -- Base points
    ),
    2
  ) as efficiency_score
FROM users u
INNER JOIN jobs j ON j.assigned_technician_id = u.id
LEFT JOIN invoices i ON i.job_id = j.id
WHERE u.role = 'technician'
GROUP BY u.id, u.first_name, u.last_name
ORDER BY efficiency_score DESC;

-- 4. Service Time Analysis
CREATE OR REPLACE VIEW service_time_analysis AS
SELECT
  js.service_type,
  COUNT(j.id) as job_count,
  AVG(j.estimated_duration) as avg_estimated_duration,
  AVG(CASE WHEN j.status = 'completed' THEN j.actual_duration END) as avg_actual_duration,
  AVG(CASE WHEN j.status = 'completed' THEN j.actual_duration - j.estimated_duration END) as avg_variance,
  ROUND(
    AVG(CASE WHEN j.status = 'completed' THEN (j.actual_duration::NUMERIC / NULLIF(j.estimated_duration::NUMERIC, 0)) * 100 END),
    2
  ) as actual_vs_estimated_pct,
  COUNT(CASE WHEN j.status = 'completed' AND j.actual_duration > j.estimated_duration THEN 1 END) as runs_over_count,
  COUNT(CASE WHEN j.status = 'completed' AND j.actual_duration <= j.estimated_duration THEN 1 END) as on_time_count,
  ROUND(
    COUNT(CASE WHEN j.status = 'completed' AND j.actual_duration <= j.estimated_duration THEN 1 END)::NUMERIC /
    NULLIF(COUNT(CASE WHEN j.status = 'completed' THEN 1 END)::NUMERIC, 0) * 100,
    2
  ) as on_time_rate_pct
FROM job_services js
INNER JOIN jobs j ON j.id = js.job_id
GROUP BY js.service_type
ORDER BY job_count DESC;

-- 5. Cancellation Analysis
CREATE OR REPLACE VIEW cancellation_analysis AS
SELECT
  j.cancellation_reason,
  COUNT(*) as cancellation_count,
  ROUND(
    COUNT(*)::NUMERIC / NULLIF(total_cancelled.total, 0) * 100,
    2
  ) as percentage,
  AVG(EXTRACT(EPOCH FROM (j.cancelled_at - j.created_at)) / 86400) as avg_days_before_cancellation,
  SUM(CASE WHEN i.id IS NOT NULL THEN i.total_amount ELSE 0 END) as potential_lost_revenue
FROM jobs j
CROSS JOIN (
  SELECT COUNT(*) as total FROM jobs WHERE status = 'cancelled'
) total_cancelled
LEFT JOIN invoices i ON i.job_id = j.id
WHERE j.status = 'cancelled'
GROUP BY j.cancellation_reason, total_cancelled.total
ORDER BY cancellation_count DESC;

-- 6. Scheduling Efficiency by Zone
CREATE OR REPLACE VIEW scheduling_efficiency_by_zone AS
SELECT
  sz.id as zone_id,
  sz.zone_name,
  COUNT(j.id) as total_jobs,
  ROUND(AVG(j.actual_duration), 2) as avg_job_duration,
  ROUND(AVG(j.travel_time), 2) as avg_travel_time,
  ROUND(
    AVG(j.travel_time::NUMERIC / NULLIF(j.actual_duration::NUMERIC, 0)) * 100,
    2
  ) as travel_vs_service_ratio_pct,
  COUNT(DISTINCT DATE(j.scheduled_date)) as active_days,
  ROUND(
    COUNT(j.id)::NUMERIC / NULLIF(COUNT(DISTINCT DATE(j.scheduled_date))::NUMERIC, 0),
    2
  ) as jobs_per_day
FROM service_zones sz
LEFT JOIN jobs j ON j.service_zone_id = sz.id AND j.status = 'completed'
GROUP BY sz.id, sz.zone_name
ORDER BY total_jobs DESC;

-- 7. Daily Utilization Metrics
CREATE OR REPLACE VIEW daily_utilization_metrics AS
SELECT
  DATE(j.scheduled_date) as date,
  COUNT(j.id) as total_jobs,
  COUNT(DISTINCT j.assigned_technician_id) as technicians_working,
  SUM(j.actual_duration) as total_service_minutes,
  -- Assuming 8-hour workday = 480 minutes per technician
  (COUNT(DISTINCT j.assigned_technician_id) * 480) as available_minutes,
  ROUND(
    SUM(j.actual_duration)::NUMERIC /
    NULLIF((COUNT(DISTINCT j.assigned_technician_id) * 480)::NUMERIC, 0) * 100,
    2
  ) as utilization_rate_pct,
  ROUND(
    COUNT(j.id)::NUMERIC / NULLIF(COUNT(DISTINCT j.assigned_technician_id)::NUMERIC, 0),
    2
  ) as jobs_per_technician
FROM jobs j
WHERE j.status IN ('completed', 'in_progress')
  AND j.scheduled_date IS NOT NULL
GROUP BY DATE(j.scheduled_date)
ORDER BY date DESC;

-- Function to get operational metrics for date range
CREATE OR REPLACE FUNCTION get_operational_metrics(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(
  total_jobs BIGINT,
  completed_jobs BIGINT,
  cancelled_jobs BIGINT,
  scheduled_jobs BIGINT,
  completion_rate NUMERIC,
  cancellation_rate NUMERIC,
  avg_job_duration NUMERIC,
  total_technicians BIGINT,
  avg_jobs_per_technician NUMERIC,
  avg_utilization_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(j.id) as total_jobs,
    COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completed_jobs,
    COUNT(CASE WHEN j.status = 'cancelled' THEN 1 END) as cancelled_jobs,
    COUNT(CASE WHEN j.status = 'scheduled' THEN 1 END) as scheduled_jobs,
    ROUND(
      COUNT(CASE WHEN j.status = 'completed' THEN 1 END)::NUMERIC /
      NULLIF(COUNT(j.id)::NUMERIC, 0) * 100,
      2
    ) as completion_rate,
    ROUND(
      COUNT(CASE WHEN j.status = 'cancelled' THEN 1 END)::NUMERIC /
      NULLIF(COUNT(j.id)::NUMERIC, 0) * 100,
      2
    ) as cancellation_rate,
    ROUND(AVG(CASE WHEN j.status = 'completed' THEN j.actual_duration END), 2) as avg_job_duration,
    COUNT(DISTINCT j.assigned_technician_id) as total_technicians,
    ROUND(
      COUNT(j.id)::NUMERIC / NULLIF(COUNT(DISTINCT j.assigned_technician_id)::NUMERIC, 0),
      2
    ) as avg_jobs_per_technician,
    (
      SELECT AVG(utilization_rate_pct)
      FROM daily_utilization_metrics
      WHERE date >= start_date::DATE AND date <= end_date::DATE
    ) as avg_utilization_rate
  FROM jobs j
  WHERE j.scheduled_date >= start_date
    AND j.scheduled_date <= end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get job status breakdown over time
CREATE OR REPLACE FUNCTION get_job_status_trend(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  group_by TEXT DEFAULT 'day'
)
RETURNS TABLE(
  period TIMESTAMP WITH TIME ZONE,
  total_jobs BIGINT,
  completed BIGINT,
  cancelled BIGINT,
  scheduled BIGINT,
  in_progress BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(group_by, j.scheduled_date) as period,
    COUNT(j.id) as total_jobs,
    COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN j.status = 'cancelled' THEN 1 END) as cancelled,
    COUNT(CASE WHEN j.status = 'scheduled' THEN 1 END) as scheduled,
    COUNT(CASE WHEN j.status = 'in_progress' THEN 1 END) as in_progress
  FROM jobs j
  WHERE j.scheduled_date >= start_date
    AND j.scheduled_date <= end_date
  GROUP BY DATE_TRUNC(group_by, j.scheduled_date)
  ORDER BY period;
END;
$$ LANGUAGE plpgsql;

-- Function to identify optimization opportunities
CREATE OR REPLACE FUNCTION identify_optimization_opportunities()
RETURNS TABLE(
  opportunity_type VARCHAR,
  description TEXT,
  impact_level VARCHAR,
  affected_count INTEGER,
  potential_improvement TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Low utilization zones
  SELECT
    'Low Utilization Zone'::VARCHAR,
    'Zone "' || zone_name || '" has low job density (' || jobs_per_day::TEXT || ' jobs/day)'::TEXT,
    CASE
      WHEN jobs_per_day < 2 THEN 'High'::VARCHAR
      WHEN jobs_per_day < 4 THEN 'Medium'::VARCHAR
      ELSE 'Low'::VARCHAR
    END,
    total_jobs::INTEGER,
    'Consider reducing service frequency or combining with nearby zones'::TEXT
  FROM scheduling_efficiency_by_zone
  WHERE jobs_per_day < 5 AND total_jobs > 10

  UNION ALL

  -- Services consistently running over time
  SELECT
    'Service Time Overrun'::VARCHAR,
    'Service "' || service_type || '" runs ' || ROUND(actual_vs_estimated_pct - 100, 0)::TEXT || '% over estimate'::TEXT,
    CASE
      WHEN actual_vs_estimated_pct > 150 THEN 'High'::VARCHAR
      WHEN actual_vs_estimated_pct > 125 THEN 'Medium'::VARCHAR
      ELSE 'Low'::VARCHAR
    END,
    runs_over_count::INTEGER,
    'Adjust time estimates to ' || ROUND(avg_actual_duration, 0)::TEXT || ' minutes'::TEXT
  FROM service_time_analysis
  WHERE actual_vs_estimated_pct > 120 AND job_count > 5

  UNION ALL

  -- High travel-to-service ratio
  SELECT
    'High Travel Time'::VARCHAR,
    'Zone "' || zone_name || '" has ' || ROUND(travel_vs_service_ratio_pct, 0)::TEXT || '% travel time ratio'::TEXT,
    CASE
      WHEN travel_vs_service_ratio_pct > 50 THEN 'High'::VARCHAR
      WHEN travel_vs_service_ratio_pct > 30 THEN 'Medium'::VARCHAR
      ELSE 'Low'::VARCHAR
    END,
    total_jobs::INTEGER,
    'Optimize routing or batch jobs in this zone'::TEXT
  FROM scheduling_efficiency_by_zone
  WHERE travel_vs_service_ratio_pct > 25 AND total_jobs > 10

  UNION ALL

  -- Low efficiency technicians
  SELECT
    'Technician Performance'::VARCHAR,
    'Technician "' || technician_name || '" has ' || ROUND(efficiency_score, 0)::TEXT || ' efficiency score'::TEXT,
    CASE
      WHEN efficiency_score < 60 THEN 'High'::VARCHAR
      WHEN efficiency_score < 75 THEN 'Medium'::VARCHAR
      ELSE 'Low'::VARCHAR
    END,
    total_jobs::INTEGER,
    'Provide additional training or reassign complex jobs'::TEXT
  FROM technician_performance
  WHERE efficiency_score < 75 AND total_jobs > 10

  UNION ALL

  -- Common cancellation reasons
  SELECT
    'High Cancellation Reason'::VARCHAR,
    'Cancellation reason "' || COALESCE(cancellation_reason, 'Unspecified') || '" accounts for ' || ROUND(percentage, 0)::TEXT || '% of cancellations'::TEXT,
    CASE
      WHEN percentage > 30 THEN 'High'::VARCHAR
      WHEN percentage > 20 THEN 'Medium'::VARCHAR
      ELSE 'Low'::VARCHAR
    END,
    cancellation_count::INTEGER,
    'Address root cause to reduce cancellations'::TEXT
  FROM cancellation_analysis
  WHERE percentage > 15 AND cancellation_count > 5

  ORDER BY
    CASE impact_level
      WHEN 'High' THEN 1
      WHEN 'Medium' THEN 2
      ELSE 3
    END,
    affected_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get technician daily schedule density
CREATE OR REPLACE FUNCTION get_technician_schedule_density(
  target_date DATE
)
RETURNS TABLE(
  technician_id UUID,
  technician_name VARCHAR,
  total_jobs INTEGER,
  scheduled_minutes INTEGER,
  available_minutes INTEGER,
  utilization_pct NUMERIC,
  avg_gap_between_jobs NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as technician_id,
    (u.first_name || ' ' || u.last_name)::VARCHAR as technician_name,
    COUNT(j.id)::INTEGER as total_jobs,
    SUM(j.estimated_duration)::INTEGER as scheduled_minutes,
    480::INTEGER as available_minutes, -- 8 hour day
    ROUND(SUM(j.estimated_duration)::NUMERIC / 480 * 100, 2) as utilization_pct,
    CASE
      WHEN COUNT(j.id) > 1 THEN
        ROUND(
          (480 - SUM(j.estimated_duration))::NUMERIC / NULLIF((COUNT(j.id) - 1)::NUMERIC, 0),
          2
        )
      ELSE 0
    END as avg_gap_between_jobs
  FROM users u
  LEFT JOIN jobs j ON j.assigned_technician_id = u.id
    AND DATE(j.scheduled_date) = target_date
    AND j.status NOT IN ('cancelled')
  WHERE u.role = 'technician'
  GROUP BY u.id, u.first_name, u.last_name
  ORDER BY utilization_pct DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON VIEW operational_metrics_weekly IS 'Weekly operational performance metrics';
COMMENT ON VIEW job_performance_overview IS 'Overall job completion and performance statistics';
COMMENT ON VIEW technician_performance IS 'Individual technician performance metrics with efficiency scoring';
COMMENT ON VIEW service_time_analysis IS 'Actual vs estimated time analysis by service type';
COMMENT ON VIEW cancellation_analysis IS 'Breakdown of job cancellations by reason';
COMMENT ON VIEW scheduling_efficiency_by_zone IS 'Zone-level scheduling and travel efficiency metrics';
COMMENT ON VIEW daily_utilization_metrics IS 'Daily technician utilization rates';
COMMENT ON FUNCTION get_operational_metrics IS 'Get comprehensive operational metrics for a date range';
COMMENT ON FUNCTION get_job_status_trend IS 'Job status breakdown over time with grouping';
COMMENT ON FUNCTION identify_optimization_opportunities IS 'AI-powered identification of operational improvement areas';
COMMENT ON FUNCTION get_technician_schedule_density IS 'Analyze technician schedule density for a specific day';
