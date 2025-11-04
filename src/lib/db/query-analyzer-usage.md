# Query Analyzer Usage Guide

This guide explains how to use the Query Analyzer utility to monitor and optimize database performance.

## Table of Contents

1. [Installation](#installation)
2. [Basic Usage](#basic-usage)
3. [Monitoring Slow Queries](#monitoring-slow-queries)
4. [Analyzing Query Performance](#analyzing-query-performance)
5. [Finding Missing Indexes](#finding-missing-indexes)
6. [Performance Reports](#performance-reports)
7. [Best Practices](#best-practices)

## Installation

### Step 1: Run Migrations

```bash
# Run the performance indexes migration
npm run supabase:migrate sql/16-performance-indexes.sql

# Run the query analyzer schema migration
npm run supabase:migrate sql/17-query-analyzer-schema.sql
```

### Step 2: Verify Setup

```bash
# Connect to your Supabase database
psql your-database-url

# Check if tables and functions are created
\dt slow_query_log
\df get_index_usage_stats
```

## Basic Usage

### Wrapping Queries for Monitoring

```typescript
import { measureQuery } from '@/lib/db/query-analyzer'

// Wrap any database query to measure performance
const customers = await measureQuery(
  'fetch-active-customers',
  async () => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('deleted', false)
      .order('created_at', { ascending: false })

    return data
  },
  {
    userId: session?.user?.id,
    endpoint: '/api/customers',
  }
)
```

If the query takes longer than 100ms, it will be automatically logged to the `slow_query_log` table.

### Example in API Route

```typescript
// app/api/customers/route.ts
import { NextRequest } from 'next/server'
import { measureQuery } from '@/lib/db/query-analyzer'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const session = await getSession()

  const customers = await measureQuery(
    'GET /api/customers - fetch all customers',
    async () => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          jobs(count)
        `)
        .eq('deleted', false)

      if (error) throw error
      return data
    },
    {
      userId: session?.user?.id,
      endpoint: request.url,
      params: Object.fromEntries(request.nextUrl.searchParams),
    }
  )

  return Response.json({ customers })
}
```

## Monitoring Slow Queries

### View Recent Slow Queries

```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()

// Get slow queries from the last 24 hours
const { data: slowQueries } = await supabase
  .from('slow_query_log')
  .select('*')
  .gte('logged_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .order('duration_ms', { ascending: false })
  .limit(10)

console.log('Top 10 Slowest Queries:', slowQueries)
```

### Using Helper Views

```typescript
// View recent slow queries (pre-filtered)
const { data } = await supabase.from('recent_slow_queries').select('*')

// View slow queries grouped by endpoint
const { data: byEndpoint } = await supabase
  .from('slow_queries_by_endpoint')
  .select('*')
  .order('avg_duration', { ascending: false })

// View hourly trends
const { data: trends } = await supabase
  .from('slow_query_trends')
  .select('*')
  .limit(24) // Last 24 hours
```

### Get Summary Statistics

```typescript
const { data: summary } = await supabase.rpc('get_slow_query_summary', {
  since_hours: 24,
})

console.log(`
  Total Slow Queries: ${summary[0].total_slow_queries}
  Average Duration: ${summary[0].avg_duration}ms
  Critical Queries: ${summary[0].critical_queries}
  Affected Users: ${summary[0].affected_users}
`)
```

## Analyzing Query Performance

### Check Index Usage

```typescript
import { getIndexUsageStats } from '@/lib/db/query-analyzer'

const indexStats = await getIndexUsageStats()

console.log('Index Usage Statistics:')
indexStats.forEach((stat) => {
  console.log(`
    Table: ${stat.tablename}
    Index: ${stat.indexname}
    Scans: ${stat.idx_scan}
    Usage Ratio: ${stat.usage_ratio}%
    Size: ${stat.index_size}
  `)
})
```

### Find Unused Indexes

```typescript
import { findUnusedIndexes } from '@/lib/db/query-analyzer'

const unusedIndexes = await findUnusedIndexes()

if (unusedIndexes.length > 0) {
  console.log('⚠️ Unused Indexes Found:')
  unusedIndexes.forEach((index) => {
    console.log(`
      Table: ${index.tablename}
      Index: ${index.indexname}
      Size: ${index.index_size}

      -- SQL to drop:
      DROP INDEX IF EXISTS ${index.indexname};
    `)
  })
}
```

## Finding Missing Indexes

### Suggest Indexes Based on Slow Queries

```typescript
import { suggestMissingIndexes } from '@/lib/db/query-analyzer'

const suggestions = await suggestMissingIndexes()

console.log('🔍 Missing Index Suggestions:')
suggestions.forEach((suggestion) => {
  console.log(`
    Impact: ${suggestion.estimatedImpact.toUpperCase()}
    Table: ${suggestion.table}
    Columns: ${suggestion.columns.join(', ')}
    Reason: ${suggestion.reason}

    -- Suggested SQL:
    CREATE INDEX idx_${suggestion.table}_${suggestion.columns.join('_')}
      ON ${suggestion.table}(${suggestion.columns.join(', ')});
  `)
})
```

## Performance Reports

### Generate Comprehensive Report

```typescript
import { generatePerformanceReport } from '@/lib/db/query-analyzer'

const report = await generatePerformanceReport()

console.log('📊 Database Performance Report')
console.log('Generated:', report.generatedAt)
console.log('\nSummary:')
console.log(`  Total Slow Queries: ${report.summary.totalSlowQueries}`)
console.log(`  Avg Query Time: ${report.summary.averageSlowQueryTime}ms`)
console.log(`  Suggested Indexes: ${report.summary.suggestedIndexes}`)
console.log(`  Unused Indexes: ${report.summary.unusedIndexes}`)

console.log('\nTop 10 Slowest Queries:')
report.slowQueries.forEach((query, i) => {
  console.log(`${i + 1}. ${query.query_text.substring(0, 50)}... (${query.duration_ms}ms)`)
})

console.log('\nRecommendations:')
report.recommendations.forEach((rec) => {
  console.log(`  • ${rec}`)
})
```

### Schedule Automated Reports

```typescript
// Create a cron job to generate daily reports
// app/api/cron/performance-report/route.ts

import { generatePerformanceReport } from '@/lib/db/query-analyzer'
import { sendEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report = await generatePerformanceReport()

  // Send report to administrators
  await sendEmail({
    to: 'admin@dirtfree.com',
    subject: 'Daily Database Performance Report',
    html: formatReportEmail(report),
  })

  return Response.json({ success: true, report })
}
```

## Best Practices

### 1. Monitor Critical Paths

Always wrap performance-critical queries:

```typescript
// ✅ Good: Wrap critical queries
const jobs = await measureQuery('fetch-scheduled-jobs', async () => {
  return await supabase
    .from('jobs')
    .select('*, customers(*), users(*)')
    .eq('status', 'scheduled')
})

// ❌ Bad: No monitoring on critical query
const jobs = await supabase.from('jobs').select('*')
```

### 2. Set Contextual Information

Provide context to help debug slow queries:

```typescript
await measureQuery(
  'complex-analytics-query',
  queryFn,
  {
    userId: user.id,
    endpoint: '/api/analytics/revenue',
    params: {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      groupBy: 'month',
    },
  }
)
```

### 3. Regular Performance Audits

Schedule weekly reviews:

```bash
# Run these queries weekly
SELECT * FROM get_slow_query_summary(168); -- Last 7 days
SELECT * FROM find_unused_indexes();
SELECT * FROM get_top_slow_queries(20, 168);
```

### 4. Index Maintenance

```typescript
// Monthly index cleanup script
import { findUnusedIndexes } from '@/lib/db/query-analyzer'

async function cleanupUnusedIndexes() {
  const unused = await findUnusedIndexes()

  // Only drop indexes over 1MB that haven't been used
  const toRemove = unused.filter((idx) => idx.index_bytes > 1_000_000)

  console.log(`Found ${toRemove.length} unused indexes to remove`)

  // Review before executing!
  toRemove.forEach((idx) => {
    console.log(`DROP INDEX IF EXISTS ${idx.indexname};`)
  })
}
```

### 5. Performance Testing

Add performance tests to your test suite:

```typescript
// __tests__/performance/queries.test.ts
import { measureQuery } from '@/lib/db/query-analyzer'

test('customer list query should complete under 100ms', async () => {
  const startTime = performance.now()

  await measureQuery('test-customer-list', async () => {
    const { data } = await supabase.from('customers').select('*').limit(100)
    return data
  })

  const duration = performance.now() - startTime

  expect(duration).toBeLessThan(100)
})
```

## Troubleshooting

### Query Not Being Logged

Check these common issues:

1. **Threshold too high**: Query must exceed 100ms to be logged
2. **Test environment**: Logging is disabled in test environment
3. **Table permissions**: Ensure RLS policies allow inserts

### Missing Index Suggestions Not Accurate

The analyzer uses heuristics. Always:

1. Review suggestions manually
2. Check if index already exists
3. Test with EXPLAIN ANALYZE before creating
4. Monitor index usage after creation

### Cleanup Not Running

If using pg_cron:

```sql
-- Check scheduled jobs
SELECT * FROM cron.job;

-- Manually trigger cleanup
SELECT cleanup_old_slow_query_logs(30);
```

## Advanced Usage

### Custom Monitoring Integration

```typescript
// Integrate with DataDog, New Relic, etc.
import { measureQuery } from '@/lib/db/query-analyzer'

const originalMeasureQuery = measureQuery

export const measureQuery = async (name, queryFn, context) => {
  const result = await originalMeasureQuery(name, queryFn, context)

  // Send to custom monitoring
  if (typeof window === 'undefined') {
    datadogClient.gauge('database.query.duration', duration, {
      query: name,
      endpoint: context?.endpoint,
    })
  }

  return result
}
```

## Support

For issues or questions:

- Review the source code: `/src/lib/db/query-analyzer.ts`
- Check migration files: `/sql/16-performance-indexes.sql`, `/sql/17-query-analyzer-schema.sql`
- Consult PostgreSQL documentation: https://www.postgresql.org/docs/current/indexes.html
