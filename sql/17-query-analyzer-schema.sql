-- =====================================================
-- Query Analyzer Infrastructure
-- =====================================================
-- This migration creates the necessary tables and functions
-- to support the query analyzer utility.
-- =====================================================

-- =====================================================
-- Slow Query Log Table
-- =====================================================

CREATE TABLE IF NOT EXISTS slow_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  duration_ms NUMERIC NOT NULL,
  user_id UUID REFERENCES users(id),
  endpoint TEXT,
  query_params JSONB,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity TEXT CHECK (severity IN ('warning', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for slow query log
CREATE INDEX IF NOT EXISTS idx_slow_query_log_duration
  ON slow_query_log(duration_ms DESC);

CREATE INDEX IF NOT EXISTS idx_slow_query_log_logged_at
  ON slow_query_log(logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_slow_query_log_severity
  ON slow_query_log(severity, logged_at DESC)
  WHERE severity = 'critical';

CREATE INDEX IF NOT EXISTS idx_slow_query_log_user
  ON slow_query_log(user_id, logged_at DESC)
  WHERE user_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE slow_query_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view slow query logs
CREATE POLICY "Admins can view slow query logs"
  ON slow_query_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: System can insert slow query logs
CREATE POLICY "System can insert slow query logs"
  ON slow_query_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function: Get index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE (
  schemaname name,
  tablename name,
  indexname name,
  idx_scan bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint,
  index_size text,
  usage_ratio numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.schemaname,
    s.tablename,
    s.indexname,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size,
    CASE
      WHEN s.idx_scan = 0 THEN 0
      ELSE ROUND((s.idx_scan::numeric / NULLIF(t.seq_scan + t.idx_scan, 0)) * 100, 2)
    END as usage_ratio
  FROM pg_stat_user_indexes s
  JOIN pg_stat_user_tables t ON s.schemaname = t.schemaname AND s.tablename = t.tablename
  WHERE s.schemaname = 'public'
  ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Find unused indexes
CREATE OR REPLACE FUNCTION find_unused_indexes()
RETURNS TABLE (
  schemaname name,
  tablename name,
  indexname name,
  index_size text,
  index_bytes bigint,
  table_size text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.schemaname,
    s.tablename,
    s.indexname,
    pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size,
    pg_relation_size(s.indexrelid) as index_bytes,
    pg_size_pretty(pg_relation_size(s.relid)) as table_size
  FROM pg_stat_user_indexes s
  WHERE s.idx_scan = 0
    AND s.indexrelname NOT LIKE 'pg_%'
    AND s.schemaname = 'public'
    -- Exclude primary keys and unique constraints
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conindid = s.indexrelid
      AND c.contype IN ('p', 'u')
    )
  ORDER BY pg_relation_size(s.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get table bloat statistics
CREATE OR REPLACE FUNCTION get_table_bloat_stats()
RETURNS TABLE (
  schemaname name,
  tablename name,
  table_size text,
  bloat_size text,
  bloat_ratio numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname::name,
    tablename::name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))::text as table_size,
    pg_size_pretty(
      pg_total_relation_size(schemaname||'.'||tablename) -
      pg_relation_size(schemaname||'.'||tablename)
    )::text as bloat_size,
    ROUND(
      ((pg_total_relation_size(schemaname||'.'||tablename)::numeric -
        pg_relation_size(schemaname||'.'||tablename)::numeric) /
        NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0)) * 100,
      2
    ) as bloat_ratio
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Analyze query execution plan
-- Note: This function is commented out as EXPLAIN ANALYZE requires superuser privileges
-- It should be created manually by a database administrator if needed
/*
CREATE OR REPLACE FUNCTION explain_query(query_text text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  EXECUTE 'EXPLAIN (ANALYZE, FORMAT JSON) ' || query_text INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

-- Function: Get slow query summary
CREATE OR REPLACE FUNCTION get_slow_query_summary(
  since_hours integer DEFAULT 24
)
RETURNS TABLE (
  total_slow_queries bigint,
  avg_duration numeric,
  max_duration numeric,
  critical_queries bigint,
  unique_endpoints bigint,
  affected_users bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_slow_queries,
    ROUND(AVG(duration_ms), 2) as avg_duration,
    MAX(duration_ms) as max_duration,
    COUNT(*) FILTER (WHERE severity = 'critical')::bigint as critical_queries,
    COUNT(DISTINCT endpoint)::bigint as unique_endpoints,
    COUNT(DISTINCT user_id)::bigint as affected_users
  FROM slow_query_log
  WHERE logged_at >= NOW() - (since_hours || ' hours')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get top slow queries
CREATE OR REPLACE FUNCTION get_top_slow_queries(
  limit_count integer DEFAULT 10,
  since_hours integer DEFAULT 24
)
RETURNS TABLE (
  query_text text,
  avg_duration numeric,
  max_duration numeric,
  occurrence_count bigint,
  last_seen timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    LEFT(q.query_text, 200) as query_text,
    ROUND(AVG(q.duration_ms), 2) as avg_duration,
    MAX(q.duration_ms) as max_duration,
    COUNT(*)::bigint as occurrence_count,
    MAX(q.logged_at) as last_seen
  FROM slow_query_log q
  WHERE q.logged_at >= NOW() - (since_hours || ' hours')::interval
  GROUP BY LEFT(q.query_text, 200)
  ORDER BY AVG(q.duration_ms) DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Clean old slow query logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_slow_query_logs(
  retention_days integer DEFAULT 30
)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM slow_query_log
  WHERE logged_at < NOW() - (retention_days || ' days')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Scheduled Cleanup Job (using pg_cron if available)
-- =====================================================

-- Note: This requires pg_cron extension
-- Uncomment if pg_cron is installed:
/*
SELECT cron.schedule(
  'cleanup-slow-query-logs',
  '0 2 * * *', -- Run daily at 2 AM
  $$SELECT cleanup_old_slow_query_logs(30)$$
);
*/

-- =====================================================
-- Query Performance Monitoring Views
-- =====================================================

-- View: Recent slow queries
CREATE OR REPLACE VIEW recent_slow_queries AS
SELECT
  id,
  LEFT(query_text, 100) as query_preview,
  duration_ms,
  severity,
  endpoint,
  user_id,
  logged_at
FROM slow_query_log
WHERE logged_at >= NOW() - INTERVAL '24 hours'
ORDER BY duration_ms DESC;

-- View: Slow query statistics by endpoint
CREATE OR REPLACE VIEW slow_queries_by_endpoint AS
SELECT
  endpoint,
  COUNT(*) as total_queries,
  ROUND(AVG(duration_ms), 2) as avg_duration,
  MAX(duration_ms) as max_duration,
  MIN(duration_ms) as min_duration,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_count
FROM slow_query_log
WHERE logged_at >= NOW() - INTERVAL '24 hours'
  AND endpoint IS NOT NULL
GROUP BY endpoint
ORDER BY avg_duration DESC;

-- View: Slow query trends over time
CREATE OR REPLACE VIEW slow_query_trends AS
SELECT
  DATE_TRUNC('hour', logged_at) as hour,
  COUNT(*) as query_count,
  ROUND(AVG(duration_ms), 2) as avg_duration,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_count
FROM slow_query_log
WHERE logged_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', logged_at)
ORDER BY hour DESC;

-- =====================================================
-- Grant Permissions
-- =====================================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_index_usage_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION find_unused_indexes() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_bloat_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_slow_query_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_slow_queries(integer, integer) TO authenticated;

-- Grant execute on cleanup function to service_role only
GRANT EXECUTE ON FUNCTION cleanup_old_slow_query_logs(integer) TO service_role;

-- Grant select on views to authenticated users
GRANT SELECT ON recent_slow_queries TO authenticated;
GRANT SELECT ON slow_queries_by_endpoint TO authenticated;
GRANT SELECT ON slow_query_trends TO authenticated;

-- =====================================================
-- Migration Complete
-- =====================================================
-- Query analyzer infrastructure created successfully.
--
-- Available functions:
-- - get_index_usage_stats(): View index usage statistics
-- - find_unused_indexes(): Find indexes that are never used
-- - get_table_bloat_stats(): Check table bloat
-- - get_slow_query_summary(hours): Get summary of slow queries
-- - get_top_slow_queries(limit, hours): Get top slow queries
-- - cleanup_old_slow_query_logs(days): Clean old logs
--
-- Available views:
-- - recent_slow_queries: Last 24 hours of slow queries
-- - slow_queries_by_endpoint: Slow queries grouped by endpoint
-- - slow_query_trends: Hourly trends over last 7 days
-- =====================================================
