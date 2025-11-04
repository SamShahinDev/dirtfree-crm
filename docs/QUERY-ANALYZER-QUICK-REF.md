# Query Analyzer Quick Reference

Quick reference for using the database query analyzer in Dirt Free CRM.

## Installation

```bash
npm run db:optimize
npm run db:verify
```

## Basic Usage

### Wrap a Query

```typescript
import { measureQuery } from '@/lib/db/query-analyzer'

const data = await measureQuery(
  'query-name',
  async () => {
    // Your database query
    return await supabase.from('table').select('*')
  },
  {
    userId: user.id,
    endpoint: '/api/endpoint',
  }
)
```

### In API Routes

```typescript
// app/api/customers/route.ts
export async function GET(request: NextRequest) {
  const customers = await measureQuery(
    'GET /api/customers',
    async () => {
      const supabase = await createClient()
      const { data } = await supabase.from('customers').select('*')
      return data
    },
    {
      endpoint: request.url,
      userId: session?.user?.id,
    }
  )

  return Response.json({ customers })
}
```

## Monitoring Functions

### View Slow Queries

```typescript
// Get recent slow queries
const { data } = await supabase
  .from('recent_slow_queries')
  .select('*')
  .limit(10)

// Get summary
const { data: summary } = await supabase.rpc('get_slow_query_summary', {
  since_hours: 24
})

// Get top slow queries
const { data: top } = await supabase.rpc('get_top_slow_queries', {
  limit_count: 10,
  since_hours: 24
})
```

### Check Index Usage

```typescript
import { getIndexUsageStats } from '@/lib/db/query-analyzer'

const stats = await getIndexUsageStats()
```

### Find Unused Indexes

```typescript
import { findUnusedIndexes } from '@/lib/db/query-analyzer'

const unused = await findUnusedIndexes()
```

### Get Missing Index Suggestions

```typescript
import { suggestMissingIndexes } from '@/lib/db/query-analyzer'

const suggestions = await suggestMissingIndexes()
```

### Generate Report

```typescript
import { generatePerformanceReport } from '@/lib/db/query-analyzer'

const report = await generatePerformanceReport()
```

## SQL Functions

```sql
-- Slow query summary
SELECT * FROM get_slow_query_summary(24);

-- Top slow queries
SELECT * FROM get_top_slow_queries(10, 24);

-- Index usage stats
SELECT * FROM get_index_usage_stats();

-- Unused indexes
SELECT * FROM find_unused_indexes();

-- Table bloat
SELECT * FROM get_table_bloat_stats();

-- Cleanup old logs
SELECT cleanup_old_slow_query_logs(30);
```

## SQL Views

```sql
-- Recent slow queries (24h)
SELECT * FROM recent_slow_queries;

-- By endpoint
SELECT * FROM slow_queries_by_endpoint;

-- Hourly trends (7d)
SELECT * FROM slow_query_trends;
```

## NPM Scripts

```bash
# Optimize database
npm run db:optimize

# Verify performance
npm run db:verify

# Analyze performance
npm run db:analyze
```

## Common Patterns

### API Route Pattern

```typescript
export async function GET(request: NextRequest) {
  return await measureQuery(
    `GET ${request.nextUrl.pathname}`,
    async () => {
      // Query logic
      const data = await fetchData()
      return Response.json({ data })
    },
    {
      endpoint: request.url,
      userId: session?.user?.id,
      params: Object.fromEntries(request.nextUrl.searchParams),
    }
  )
}
```

### Complex Query Pattern

```typescript
const results = await measureQuery(
  'complex-analytics-query',
  async () => {
    const { data } = await supabase
      .from('invoices')
      .select('*, jobs(*), customers(*)')
      .eq('status', 'paid')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    return processResults(data)
  },
  {
    userId: user.id,
    endpoint: '/api/analytics',
    params: { startDate, endDate },
  }
)
```

## Thresholds

- **Slow query**: > 100ms
- **Very slow**: > 1000ms (critical)
- **Log retention**: 30 days (configurable)

## Performance Targets

| Query Type | Target | Good | Needs Work |
|------------|--------|------|------------|
| Simple SELECT | < 50ms | < 100ms | > 100ms |
| JOIN (2-3 tables) | < 100ms | < 200ms | > 200ms |
| Complex Analytics | < 300ms | < 500ms | > 500ms |
| Aggregations | < 200ms | < 400ms | > 400ms |

## Troubleshooting

### Query still slow?

1. Check if index exists:
   ```sql
   SELECT * FROM get_index_usage_stats()
   WHERE tablename = 'your_table';
   ```

2. Check if index is being used:
   ```sql
   EXPLAIN ANALYZE SELECT ...;
   ```

3. Update statistics:
   ```sql
   ANALYZE your_table;
   ```

### Logs not appearing?

1. Check threshold (must be > 100ms)
2. Verify table exists: `SELECT * FROM slow_query_log LIMIT 1;`
3. Check RLS policies
4. Verify environment (disabled in test)

## Quick Checks

### Daily
```bash
npm run db:verify
```

### Weekly
```sql
SELECT * FROM get_slow_query_summary(168);
SELECT * FROM get_top_slow_queries(20, 168);
```

### Monthly
```sql
SELECT * FROM find_unused_indexes();
SELECT cleanup_old_slow_query_logs(30);
```

## Resources

- Full guide: `DATABASE-OPTIMIZATION.md`
- Detailed usage: `src/lib/db/query-analyzer-usage.md`
- Source code: `src/lib/db/query-analyzer.ts`

---

**Need help?** Check the full documentation in `DATABASE-OPTIMIZATION.md`
