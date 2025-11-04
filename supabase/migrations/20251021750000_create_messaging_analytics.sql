-- =====================================================
-- Messaging Analytics Views and Functions
-- =====================================================
-- Provides comprehensive analytics for customer messaging,
-- chatbot performance, staff performance, and trends

-- =====================================================
-- Daily Message Analytics View
-- =====================================================

CREATE OR REPLACE VIEW message_analytics_daily AS
SELECT
  DATE(cm.created_at) as date,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN cm.sender_type = 'customer' THEN 1 END) as customer_messages,
  COUNT(CASE WHEN cm.sender_type = 'staff' THEN 1 END) as staff_messages,
  COUNT(CASE WHEN cm.sender_type = 'chatbot' THEN 1 END) as chatbot_messages,
  COUNT(DISTINCT cm.customer_id) as unique_customers,
  COUNT(DISTINCT CASE WHEN cm.sender_type = 'staff' THEN cm.sender_id END) as active_staff
FROM customer_messages cm
WHERE cm.deleted_at IS NULL
GROUP BY DATE(cm.created_at)
ORDER BY DATE(cm.created_at) DESC;

-- =====================================================
-- Hourly Message Volume View (for busiest times analysis)
-- =====================================================

CREATE OR REPLACE VIEW message_volume_by_hour AS
SELECT
  EXTRACT(HOUR FROM created_at) as hour_of_day,
  COUNT(*) as message_count,
  COUNT(CASE WHEN sender_type = 'customer' THEN 1 END) as customer_messages,
  COUNT(CASE WHEN sender_type = 'staff' THEN 1 END) as staff_messages,
  COUNT(CASE WHEN sender_type = 'chatbot' THEN 1 END) as chatbot_messages
FROM customer_messages
WHERE deleted_at IS NULL
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour_of_day;

-- =====================================================
-- Staff Performance View
-- =====================================================

CREATE OR REPLACE VIEW staff_performance_metrics AS
SELECT
  u.id as staff_id,
  u.full_name as staff_name,
  COUNT(DISTINCT cm.customer_id) as customers_handled,
  COUNT(cm.id) as total_messages_sent,
  COUNT(DISTINCT DATE(cm.created_at)) as days_active,
  MIN(cm.created_at) as first_message_date,
  MAX(cm.created_at) as last_message_date
FROM users u
INNER JOIN user_roles ur ON u.id = ur.user_id
INNER JOIN customer_messages cm ON cm.sender_id = u.id AND cm.sender_type = 'staff'
WHERE ur.role IN ('admin', 'manager', 'dispatcher', 'technician')
  AND cm.deleted_at IS NULL
GROUP BY u.id, u.full_name;

-- =====================================================
-- Function: Calculate Average Response Time
-- =====================================================

CREATE OR REPLACE FUNCTION get_average_response_time(
  p_staff_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS TABLE (
  staff_id uuid,
  staff_name text,
  avg_response_seconds numeric,
  median_response_seconds numeric,
  response_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH customer_staff_pairs AS (
    SELECT
      cm1.customer_id,
      cm1.created_at as customer_message_time,
      cm2.created_at as staff_message_time,
      cm2.sender_id as responding_staff_id,
      EXTRACT(EPOCH FROM (cm2.created_at - cm1.created_at)) as response_seconds
    FROM customer_messages cm1
    INNER JOIN LATERAL (
      SELECT cm2.created_at, cm2.sender_id
      FROM customer_messages cm2
      WHERE cm2.customer_id = cm1.customer_id
        AND cm2.sender_type = 'staff'
        AND cm2.created_at > cm1.created_at
        AND cm2.deleted_at IS NULL
        AND (p_staff_id IS NULL OR cm2.sender_id = p_staff_id)
      ORDER BY cm2.created_at ASC
      LIMIT 1
    ) cm2 ON true
    WHERE cm1.sender_type = 'customer'
      AND cm1.deleted_at IS NULL
      AND cm1.created_at BETWEEN p_start_date AND p_end_date
      AND (p_staff_id IS NULL OR cm2.sender_id = p_staff_id)
  )
  SELECT
    csp.responding_staff_id as staff_id,
    u.full_name as staff_name,
    ROUND(AVG(csp.response_seconds)::numeric, 2) as avg_response_seconds,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY csp.response_seconds)::numeric, 2) as median_response_seconds,
    COUNT(*)::bigint as response_count
  FROM customer_staff_pairs csp
  LEFT JOIN users u ON u.id = csp.responding_staff_id
  WHERE csp.response_seconds IS NOT NULL
    AND csp.response_seconds < 86400 -- Exclude responses longer than 24 hours
  GROUP BY csp.responding_staff_id, u.full_name
  ORDER BY avg_response_seconds ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Function: Get Messaging Overview Metrics
-- =====================================================

CREATE OR REPLACE FUNCTION get_messaging_overview(
  p_period varchar(10) DEFAULT 'month', -- 'day', 'week', 'month'
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_messages bigint,
  customer_messages bigint,
  staff_messages bigint,
  chatbot_messages bigint,
  unique_customers bigint,
  unique_staff bigint,
  avg_messages_per_customer numeric,
  chatbot_percentage numeric
) AS $$
DECLARE
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  -- Set date range based on period
  v_end_date := COALESCE(p_end_date, NOW());

  v_start_date := COALESCE(p_start_date,
    CASE p_period
      WHEN 'day' THEN v_end_date - INTERVAL '1 day'
      WHEN 'week' THEN v_end_date - INTERVAL '7 days'
      WHEN 'month' THEN v_end_date - INTERVAL '30 days'
      ELSE v_end_date - INTERVAL '30 days'
    END
  );

  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_messages,
    COUNT(CASE WHEN sender_type = 'customer' THEN 1 END)::bigint as customer_messages,
    COUNT(CASE WHEN sender_type = 'staff' THEN 1 END)::bigint as staff_messages,
    COUNT(CASE WHEN sender_type = 'chatbot' THEN 1 END)::bigint as chatbot_messages,
    COUNT(DISTINCT customer_id)::bigint as unique_customers,
    COUNT(DISTINCT CASE WHEN sender_type = 'staff' THEN sender_id END)::bigint as unique_staff,
    ROUND((COUNT(*)::numeric / NULLIF(COUNT(DISTINCT customer_id), 0))::numeric, 2) as avg_messages_per_customer,
    ROUND((COUNT(CASE WHEN sender_type = 'chatbot' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 2) as chatbot_percentage
  FROM customer_messages
  WHERE deleted_at IS NULL
    AND created_at BETWEEN v_start_date AND v_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Function: Get Message Volume Time Series
-- =====================================================

CREATE OR REPLACE FUNCTION get_message_volume_timeseries(
  p_period varchar(10) DEFAULT 'day', -- 'hour', 'day', 'week'
  p_start_date timestamptz DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS TABLE (
  period_start timestamptz,
  total_messages bigint,
  customer_messages bigint,
  staff_messages bigint,
  chatbot_messages bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(p_period, created_at) as period_start,
    COUNT(*)::bigint as total_messages,
    COUNT(CASE WHEN sender_type = 'customer' THEN 1 END)::bigint as customer_messages,
    COUNT(CASE WHEN sender_type = 'staff' THEN 1 END)::bigint as staff_messages,
    COUNT(CASE WHEN sender_type = 'chatbot' THEN 1 END)::bigint as chatbot_messages
  FROM customer_messages
  WHERE deleted_at IS NULL
    AND created_at BETWEEN p_start_date AND p_end_date
  GROUP BY DATE_TRUNC(p_period, created_at)
  ORDER BY period_start DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Function: Get Chatbot Performance Metrics
-- =====================================================

CREATE OR REPLACE FUNCTION get_chatbot_performance_metrics(
  p_start_date timestamptz DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS TABLE (
  total_sessions bigint,
  total_interactions bigint,
  successful_sessions bigint,
  escalated_sessions bigint,
  escalation_rate numeric,
  avg_confidence numeric,
  avg_interactions_per_session numeric,
  top_intent varchar(100),
  top_intent_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH session_stats AS (
    SELECT
      COUNT(DISTINCT cs.id)::bigint as total_sessions,
      COUNT(DISTINCT CASE WHEN cs.escalated = true THEN cs.id END)::bigint as escalated_sessions,
      COUNT(ci.id)::bigint as total_interactions,
      ROUND(AVG(ci.confidence_score)::numeric, 2) as avg_confidence
    FROM chatbot_sessions cs
    LEFT JOIN chatbot_interactions ci ON ci.session_id = cs.id
    WHERE cs.created_at BETWEEN p_start_date AND p_end_date
  ),
  intent_stats AS (
    SELECT
      ci.detected_intent,
      COUNT(*)::bigint as intent_count
    FROM chatbot_interactions ci
    INNER JOIN chatbot_sessions cs ON cs.id = ci.session_id
    WHERE cs.created_at BETWEEN p_start_date AND p_end_date
      AND ci.detected_intent IS NOT NULL
    GROUP BY ci.detected_intent
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  SELECT
    ss.total_sessions,
    ss.total_interactions,
    (ss.total_sessions - ss.escalated_sessions)::bigint as successful_sessions,
    ss.escalated_sessions,
    ROUND((ss.escalated_sessions::numeric / NULLIF(ss.total_sessions, 0) * 100)::numeric, 2) as escalation_rate,
    ss.avg_confidence,
    ROUND((ss.total_interactions::numeric / NULLIF(ss.total_sessions, 0))::numeric, 2) as avg_interactions_per_session,
    COALESCE(ist.detected_intent, 'N/A')::varchar(100) as top_intent,
    COALESCE(ist.intent_count, 0)::bigint as top_intent_count
  FROM session_stats ss
  LEFT JOIN intent_stats ist ON true;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Function: Get Topic Distribution
-- =====================================================

CREATE OR REPLACE FUNCTION get_message_topic_distribution(
  p_start_date timestamptz DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS TABLE (
  intent varchar(100),
  count bigint,
  percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH intent_counts AS (
    SELECT
      COALESCE(ci.detected_intent, 'unknown')::varchar(100) as intent,
      COUNT(*)::bigint as count
    FROM chatbot_interactions ci
    INNER JOIN chatbot_sessions cs ON cs.id = ci.session_id
    WHERE cs.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY ci.detected_intent
  ),
  total_count AS (
    SELECT SUM(count) as total FROM intent_counts
  )
  SELECT
    ic.intent,
    ic.count,
    ROUND((ic.count::numeric / NULLIF(tc.total, 0) * 100)::numeric, 2) as percentage
  FROM intent_counts ic
  CROSS JOIN total_count tc
  ORDER BY ic.count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Function: Get Escalation Trends
-- =====================================================

CREATE OR REPLACE FUNCTION get_escalation_trends(
  p_period varchar(10) DEFAULT 'day',
  p_start_date timestamptz DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS TABLE (
  period_start timestamptz,
  total_sessions bigint,
  escalated_sessions bigint,
  escalation_rate numeric,
  avg_confidence numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(p_period, cs.created_at) as period_start,
    COUNT(*)::bigint as total_sessions,
    COUNT(CASE WHEN cs.escalated = true THEN 1 END)::bigint as escalated_sessions,
    ROUND((COUNT(CASE WHEN cs.escalated = true THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 2) as escalation_rate,
    ROUND(AVG(
      (SELECT AVG(confidence_score)
       FROM chatbot_interactions
       WHERE session_id = cs.id)
    )::numeric, 2) as avg_confidence
  FROM chatbot_sessions cs
  WHERE cs.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY DATE_TRUNC(p_period, cs.created_at)
  ORDER BY period_start DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Function: Get Customer Satisfaction Ratings
-- =====================================================

CREATE OR REPLACE FUNCTION get_satisfaction_ratings(
  p_start_date timestamptz DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS TABLE (
  rating integer,
  count bigint,
  percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH rating_counts AS (
    SELECT
      cs.satisfaction_rating as rating,
      COUNT(*)::bigint as count
    FROM chatbot_sessions cs
    WHERE cs.satisfaction_rating IS NOT NULL
      AND cs.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY cs.satisfaction_rating
  ),
  total_count AS (
    SELECT SUM(count) as total FROM rating_counts
  )
  SELECT
    rc.rating,
    rc.count,
    ROUND((rc.count::numeric / NULLIF(tc.total, 0) * 100)::numeric, 2) as percentage
  FROM rating_counts rc
  CROSS JOIN total_count tc
  ORDER BY rc.rating DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Function: Get Resolution Time Metrics
-- =====================================================

CREATE OR REPLACE FUNCTION get_resolution_time_metrics(
  p_start_date timestamptz DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS TABLE (
  avg_resolution_hours numeric,
  median_resolution_hours numeric,
  min_resolution_hours numeric,
  max_resolution_hours numeric,
  total_resolved bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH resolution_times AS (
    SELECT
      EXTRACT(EPOCH FROM (st.resolved_at - st.created_at)) / 3600 as resolution_hours
    FROM support_tickets st
    WHERE st.status IN ('resolved', 'closed')
      AND st.resolved_at IS NOT NULL
      AND st.created_at BETWEEN p_start_date AND p_end_date
  )
  SELECT
    ROUND(AVG(resolution_hours)::numeric, 2) as avg_resolution_hours,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY resolution_hours)::numeric, 2) as median_resolution_hours,
    ROUND(MIN(resolution_hours)::numeric, 2) as min_resolution_hours,
    ROUND(MAX(resolution_hours)::numeric, 2) as max_resolution_hours,
    COUNT(*)::bigint as total_resolved
  FROM resolution_times;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT SELECT ON message_analytics_daily TO authenticated;
GRANT SELECT ON message_volume_by_hour TO authenticated;
GRANT SELECT ON staff_performance_metrics TO authenticated;

GRANT EXECUTE ON FUNCTION get_average_response_time(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_messaging_overview(varchar, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_volume_timeseries(varchar, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_chatbot_performance_metrics(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_topic_distribution(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_escalation_trends(varchar, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_satisfaction_ratings(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_resolution_time_metrics(timestamptz, timestamptz) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON VIEW message_analytics_daily IS 'Daily aggregated message statistics';
COMMENT ON VIEW message_volume_by_hour IS 'Message volume distribution by hour of day';
COMMENT ON VIEW staff_performance_metrics IS 'Staff messaging performance overview';

COMMENT ON FUNCTION get_average_response_time(uuid, timestamptz, timestamptz) IS 'Calculate average and median response times for staff';
COMMENT ON FUNCTION get_messaging_overview(varchar, timestamptz, timestamptz) IS 'Get comprehensive messaging overview metrics';
COMMENT ON FUNCTION get_message_volume_timeseries(varchar, timestamptz, timestamptz) IS 'Get message volume over time for charts';
COMMENT ON FUNCTION get_chatbot_performance_metrics(timestamptz, timestamptz) IS 'Get chatbot success rate, escalation rate, and intent distribution';
COMMENT ON FUNCTION get_message_topic_distribution(timestamptz, timestamptz) IS 'Get distribution of message topics/intents';
COMMENT ON FUNCTION get_escalation_trends(varchar, timestamptz, timestamptz) IS 'Get escalation rate trends over time';
COMMENT ON FUNCTION get_satisfaction_ratings(timestamptz, timestamptz) IS 'Get customer satisfaction rating distribution';
COMMENT ON FUNCTION get_resolution_time_metrics(timestamptz, timestamptz) IS 'Get ticket resolution time statistics';
