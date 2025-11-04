/**
 * Database Query Analyzer
 *
 * Utilities for analyzing database query performance:
 * - Log slow queries (> 100ms threshold)
 * - Analyze EXPLAIN plans
 * - Identify missing indexes
 * - Report to monitoring system
 */

import { createClient } from '@/lib/supabase/server'

// =====================================================
// Configuration
// =====================================================

const SLOW_QUERY_THRESHOLD_MS = 100
const VERY_SLOW_QUERY_THRESHOLD_MS = 1000
const ANALYZE_SAMPLE_SIZE = 100

interface QueryMetrics {
  query: string
  duration: number
  timestamp: Date
  userId?: string
  endpoint?: string
  params?: any
}

interface ExplainPlan {
  planningTime: number
  executionTime: number
  totalCost: number
  plan: any
}

interface MissingIndexSuggestion {
  table: string
  columns: string[]
  reason: string
  queryPattern: string
  estimatedImpact: 'high' | 'medium' | 'low'
}

// =====================================================
// Slow Query Logger
// =====================================================

/**
 * Log slow database queries for performance monitoring
 */
export async function logSlowQuery(metrics: QueryMetrics): Promise<void> {
  // Skip logging in test environment
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const isVerySlow = metrics.duration > VERY_SLOW_QUERY_THRESHOLD_MS

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    const severity = isVerySlow ? '🔴 VERY SLOW' : '⚠️  SLOW'
    console.warn(`${severity} QUERY (${metrics.duration}ms):`, {
      query: metrics.query.substring(0, 200) + '...',
      duration: `${metrics.duration}ms`,
      endpoint: metrics.endpoint,
      userId: metrics.userId,
    })
  }

  try {
    const supabase = await createClient()

    // Log to database for analytics
    await supabase.from('slow_query_log').insert({
      query_text: metrics.query,
      duration_ms: metrics.duration,
      user_id: metrics.userId,
      endpoint: metrics.endpoint,
      query_params: metrics.params,
      logged_at: metrics.timestamp.toISOString(),
      severity: isVerySlow ? 'critical' : 'warning',
    })

    // Report to monitoring system (e.g., Sentry)
    if (isVerySlow && typeof window === 'undefined') {
      // Server-side only
      reportToMonitoring('slow_query', {
        query: metrics.query.substring(0, 500),
        duration: metrics.duration,
        endpoint: metrics.endpoint,
      })
    }
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log slow query:', error)
  }
}

/**
 * Wrapper function to measure and log query execution time
 */
export async function measureQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  context?: {
    userId?: string
    endpoint?: string
    params?: any
  }
): Promise<T> {
  const startTime = performance.now()

  try {
    const result = await queryFn()
    const duration = performance.now() - startTime

    // Log if exceeds threshold
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      await logSlowQuery({
        query: queryName,
        duration,
        timestamp: new Date(),
        userId: context?.userId,
        endpoint: context?.endpoint,
        params: context?.params,
      })
    }

    return result
  } catch (error) {
    const duration = performance.now() - startTime

    // Log failed queries
    console.error(`Query failed after ${duration}ms:`, queryName, error)

    throw error
  }
}

// =====================================================
// EXPLAIN Plan Analyzer
// =====================================================

/**
 * Analyze a query's execution plan
 */
export async function analyzeExplainPlan(query: string): Promise<ExplainPlan> {
  const supabase = await createClient()

  // Get EXPLAIN ANALYZE output
  const { data, error } = await supabase.rpc('explain_query', {
    query_text: query,
  })

  if (error) {
    throw new Error(`Failed to analyze query: ${error.message}`)
  }

  // Parse EXPLAIN output
  const plan = parseExplainOutput(data)

  return {
    planningTime: plan.planning_time,
    executionTime: plan.execution_time,
    totalCost: plan.total_cost,
    plan: plan.plan,
  }
}

/**
 * Parse PostgreSQL EXPLAIN output
 */
function parseExplainOutput(explainData: any): any {
  // PostgreSQL EXPLAIN returns an array with plan details
  if (Array.isArray(explainData) && explainData.length > 0) {
    const planInfo = explainData[0]

    return {
      planning_time: planInfo['Planning Time'] || 0,
      execution_time: planInfo['Execution Time'] || 0,
      total_cost: planInfo['Total Cost'] || 0,
      plan: planInfo.Plan || {},
    }
  }

  return {
    planning_time: 0,
    execution_time: 0,
    total_cost: 0,
    plan: {},
  }
}

/**
 * Check if query is using indexes efficiently
 */
export function isUsingIndexes(explainPlan: any): boolean {
  const planString = JSON.stringify(explainPlan).toLowerCase()

  // Red flags: sequential scans on large tables
  if (planString.includes('seq scan')) {
    return false
  }

  // Good signs: index scans, index only scans
  if (
    planString.includes('index scan') ||
    planString.includes('index only scan') ||
    planString.includes('bitmap index scan')
  ) {
    return true
  }

  return false
}

// =====================================================
// Missing Index Detection
// =====================================================

/**
 * Analyze slow queries to suggest missing indexes
 */
export async function suggestMissingIndexes(): Promise<MissingIndexSuggestion[]> {
  const supabase = await createClient()

  // Get recent slow queries
  const { data: slowQueries, error } = await supabase
    .from('slow_query_log')
    .select('*')
    .gte('logged_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('duration_ms', { ascending: false })
    .limit(ANALYZE_SAMPLE_SIZE)

  if (error || !slowQueries) {
    console.error('Failed to fetch slow queries:', error)
    return []
  }

  const suggestions: MissingIndexSuggestion[] = []

  // Analyze query patterns
  for (const query of slowQueries) {
    const queryText = query.query_text.toLowerCase()

    // Detect WHERE clause patterns
    const whereMatch = queryText.match(/where\s+(.+?)(?:order by|group by|limit|$)/i)
    if (whereMatch) {
      const whereClause = whereMatch[1]

      // Extract column names from WHERE clause
      const columnMatches = whereClause.match(/(\w+)\s*[=<>]/g)
      if (columnMatches) {
        const columns = columnMatches.map((m) => m.replace(/\s*[=<>]/, ''))

        // Extract table name
        const tableMatch = queryText.match(/from\s+(\w+)/i)
        if (tableMatch) {
          const table = tableMatch[1]

          suggestions.push({
            table,
            columns,
            reason: 'Frequent WHERE clause filtering',
            queryPattern: whereClause.substring(0, 100),
            estimatedImpact: query.duration_ms > 500 ? 'high' : 'medium',
          })
        }
      }
    }

    // Detect ORDER BY patterns
    const orderByMatch = queryText.match(/order by\s+(\w+)/i)
    if (orderByMatch) {
      const column = orderByMatch[1]
      const tableMatch = queryText.match(/from\s+(\w+)/i)

      if (tableMatch) {
        suggestions.push({
          table: tableMatch[1],
          columns: [column],
          reason: 'ORDER BY clause without index',
          queryPattern: orderByMatch[0],
          estimatedImpact: 'medium',
        })
      }
    }

    // Detect JOIN patterns
    const joinMatches = queryText.matchAll(/join\s+(\w+)\s+on\s+\w+\.(\w+)\s*=\s*\w+\.(\w+)/gi)
    for (const match of joinMatches) {
      const [, table, column1, column2] = match

      suggestions.push({
        table,
        columns: [column2],
        reason: 'JOIN condition without index',
        queryPattern: match[0],
        estimatedImpact: 'high',
      })
    }
  }

  // Deduplicate suggestions
  return deduplicateSuggestions(suggestions)
}

/**
 * Remove duplicate index suggestions
 */
function deduplicateSuggestions(
  suggestions: MissingIndexSuggestion[]
): MissingIndexSuggestion[] {
  const seen = new Set<string>()
  const unique: MissingIndexSuggestion[] = []

  for (const suggestion of suggestions) {
    const key = `${suggestion.table}:${suggestion.columns.join(',')}`

    if (!seen.has(key)) {
      seen.add(key)
      unique.push(suggestion)
    }
  }

  return unique.sort((a, b) => {
    const impactOrder = { high: 3, medium: 2, low: 1 }
    return impactOrder[b.estimatedImpact] - impactOrder[a.estimatedImpact]
  })
}

// =====================================================
// Index Usage Statistics
// =====================================================

/**
 * Get index usage statistics from PostgreSQL
 */
export async function getIndexUsageStats() {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_index_usage_stats')

  if (error) {
    console.error('Failed to get index usage stats:', error)
    return []
  }

  return data
}

/**
 * Find unused indexes that can be dropped
 */
export async function findUnusedIndexes() {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('find_unused_indexes')

  if (error) {
    console.error('Failed to find unused indexes:', error)
    return []
  }

  return data
}

// =====================================================
// Query Performance Report
// =====================================================

/**
 * Generate comprehensive query performance report
 */
export async function generatePerformanceReport() {
  const [slowQueries, indexSuggestions, unusedIndexes] = await Promise.all([
    getRecentSlowQueries(),
    suggestMissingIndexes(),
    findUnusedIndexes(),
  ])

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSlowQueries: slowQueries.length,
      averageSlowQueryTime:
        slowQueries.reduce((sum, q) => sum + q.duration_ms, 0) / slowQueries.length || 0,
      suggestedIndexes: indexSuggestions.length,
      unusedIndexes: unusedIndexes.length,
    },
    slowQueries: slowQueries.slice(0, 10), // Top 10 slowest
    indexSuggestions: indexSuggestions.slice(0, 10), // Top 10 suggestions
    unusedIndexes: unusedIndexes.slice(0, 10), // Top 10 unused
    recommendations: generateRecommendations(slowQueries, indexSuggestions, unusedIndexes),
  }

  return report
}

/**
 * Get recent slow queries from log
 */
async function getRecentSlowQueries() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('slow_query_log')
    .select('*')
    .gte('logged_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('duration_ms', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Failed to fetch slow queries:', error)
    return []
  }

  return data || []
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  slowQueries: any[],
  suggestions: MissingIndexSuggestion[],
  unusedIndexes: any[]
): string[] {
  const recommendations: string[] = []

  // High-impact index suggestions
  const highImpact = suggestions.filter((s) => s.estimatedImpact === 'high')
  if (highImpact.length > 0) {
    recommendations.push(
      `Add ${highImpact.length} high-impact indexes to improve query performance significantly`
    )
  }

  // Unused indexes
  if (unusedIndexes.length > 0) {
    recommendations.push(
      `Consider dropping ${unusedIndexes.length} unused indexes to reduce storage and improve write performance`
    )
  }

  // Very slow queries
  const verySlow = slowQueries.filter((q) => q.duration_ms > VERY_SLOW_QUERY_THRESHOLD_MS)
  if (verySlow.length > 0) {
    recommendations.push(
      `Investigate ${verySlow.length} critical queries taking over ${VERY_SLOW_QUERY_THRESHOLD_MS}ms`
    )
  }

  // General recommendations
  if (slowQueries.length > 50) {
    recommendations.push('High number of slow queries detected - review database performance')
  }

  return recommendations
}

// =====================================================
// Monitoring Integration
// =====================================================

/**
 * Report performance issues to monitoring system
 */
function reportToMonitoring(eventName: string, data: any): void {
  // Integration with Sentry or other monitoring service
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    try {
      // Sentry integration
      if (global.Sentry) {
        global.Sentry.captureMessage(`Database Performance: ${eventName}`, {
          level: 'warning',
          extra: data,
        })
      }

      // Custom monitoring endpoint
      if (process.env.MONITORING_WEBHOOK_URL) {
        fetch(process.env.MONITORING_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: eventName,
            timestamp: new Date().toISOString(),
            data,
          }),
        }).catch((err) => console.error('Failed to send monitoring data:', err))
      }
    } catch (error) {
      console.error('Failed to report to monitoring:', error)
    }
  }
}

// =====================================================
// Helper Database Functions (to be created in Supabase)
// =====================================================

/**
 * SQL functions to create in Supabase:
 *
 * 1. explain_query function:
 * CREATE OR REPLACE FUNCTION explain_query(query_text text)
 * RETURNS json AS $$
 * DECLARE
 *   result json;
 * BEGIN
 *   EXECUTE 'EXPLAIN (ANALYZE, FORMAT JSON) ' || query_text INTO result;
 *   RETURN result;
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 *
 * 2. get_index_usage_stats function:
 * CREATE OR REPLACE FUNCTION get_index_usage_stats()
 * RETURNS TABLE (
 *   schemaname name,
 *   tablename name,
 *   indexname name,
 *   idx_scan bigint,
 *   idx_tup_read bigint,
 *   idx_tup_fetch bigint
 * ) AS $$
 * BEGIN
 *   RETURN QUERY
 *   SELECT s.schemaname, s.tablename, s.indexname, s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
 *   FROM pg_stat_user_indexes s
 *   ORDER BY s.idx_scan DESC;
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 *
 * 3. find_unused_indexes function:
 * CREATE OR REPLACE FUNCTION find_unused_indexes()
 * RETURNS TABLE (
 *   schemaname name,
 *   tablename name,
 *   indexname name,
 *   index_size text
 * ) AS $$
 * BEGIN
 *   RETURN QUERY
 *   SELECT
 *     s.schemaname,
 *     s.tablename,
 *     s.indexname,
 *     pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
 *   FROM pg_stat_user_indexes s
 *   WHERE s.idx_scan = 0
 *     AND s.indexrelname NOT LIKE 'pg_%'
 *   ORDER BY pg_relation_size(s.indexrelid) DESC;
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 */

// =====================================================
// Export All Functions
// =====================================================

export {
  measureQuery,
  analyzeExplainPlan,
  isUsingIndexes,
  suggestMissingIndexes,
  getIndexUsageStats,
  findUnusedIndexes,
  generatePerformanceReport,
}
