# API Response Caching Guide

Complete guide for using the LRU caching system in Dirt Free CRM.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Cache Configuration](#cache-configuration)
4. [Usage Examples](#usage-examples)
5. [Cache Invalidation](#cache-invalidation)
6. [Monitoring & Statistics](#monitoring--statistics)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Overview

The caching system uses **LRU (Least Recently Used)** caching to improve API response times and reduce database load.

### Features

- ✅ Per-entity cache configuration (TTL, max size)
- ✅ Automatic cache expiration
- ✅ Pattern-based cache invalidation
- ✅ Cache statistics and monitoring
- ✅ TypeScript type safety
- ✅ Development logging
- ✅ Hit/miss tracking

### Cache Instances

| Cache Name | TTL | Max Size | Use Case |
|------------|-----|----------|----------|
| `customers` | 5 min | 1000 | Customer profiles |
| `opportunities` | 2 min | 500 | Opportunities (frequently updated) |
| `promotions` | 10 min | 200 | Promotions (relatively static) |
| `analytics` | 15 min | 100 | Expensive analytics queries |
| `loyalty` | 5 min | 500 | Loyalty points and tiers |
| `reviews` | 5 min | 300 | Customer reviews |
| `referrals` | 5 min | 300 | Referral data |
| `jobs` | 3 min | 1000 | Job data |
| `invoices` | 5 min | 500 | Invoice data |
| `chatbot` | 1 min | 200 | Chatbot sessions (real-time) |
| `settings` | 30 min | 50 | System settings (rarely changes) |

## Quick Start

### 1. Basic Caching

```typescript
import { getCached } from '@/lib/cache/redis-cache'

// Wrap your database query with caching
const data = await getCached(
  'customers:list:active',
  'customers',
  async () => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('deleted', false)

    return data
  }
)
```

### 2. Cache Key Builders

```typescript
import {
  customerCacheKey,
  promotionCacheKey,
  loyaltyCacheKey,
  analyticsCacheKey,
} from '@/lib/cache/redis-cache'

// Build standardized cache keys
const customerKey = customerCacheKey('customer-123')
// Result: 'customer:customer-123'

const promotionKey = promotionCacheKey('active', 'filter-value')
// Result: 'promotion:active:filter-value'

const analyticsKey = analyticsCacheKey('revenue', '2025', 'Q1')
// Result: 'analytics:revenue:2025:Q1'
```

### 3. Cache Invalidation

```typescript
import { invalidateCache, invalidateCachePattern } from '@/lib/cache/redis-cache'

// Invalidate specific key
invalidateCache('customer:customer-123', 'customers')

// Invalidate all keys matching pattern
invalidateCachePattern('customer-123', 'customers')
// Clears: customer:customer-123, customer:customer-123:profile, etc.
```

## Cache Configuration

### Adjusting TTL

```typescript
import { setCached } from '@/lib/cache/redis-cache'

// Set with custom TTL (1 hour)
setCached(
  'special-key',
  'customers',
  data,
  1000 * 60 * 60 // 1 hour in milliseconds
)
```

### Cache Warming

```typescript
import { warmCache } from '@/lib/cache/redis-cache'

// Pre-populate cache with frequently accessed data
warmCache('customers', [
  ['customer:1', customerData1],
  ['customer:2', customerData2],
  ['customer:3', customerData3],
])
```

## Usage Examples

### API Route with Caching

```typescript
// app/api/customers/route.ts
import { getCached, invalidateCache, customerCacheKey } from '@/lib/cache/redis-cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('id')

  const cacheKey = customerCacheKey(customerId!, 'profile')

  const customer = await getCached(cacheKey, 'customers', async () => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    return data
  })

  return NextResponse.json({ customer })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, ...updates } = body

  // Update customer in database
  const supabase = await createClient()
  await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)

  // Invalidate cache
  invalidateCache(customerCacheKey(id, 'profile'), 'customers')

  return NextResponse.json({ success: true })
}
```

### Complex Query Caching

```typescript
import { getCached, analyticsCacheKey } from '@/lib/cache/redis-cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  const cacheKey = analyticsCacheKey('revenue', startDate!, endDate!)

  const revenueData = await getCached(cacheKey, 'analytics', async () => {
    const supabase = await createClient()

    // Complex analytics query
    const { data } = await supabase
      .from('invoices')
      .select(`
        total_amount,
        paid_date,
        jobs(service_type, customer_id)
      `)
      .eq('status', 'paid')
      .gte('paid_date', startDate)
      .lte('paid_date', endDate)

    // Process data
    const processed = processRevenueData(data)

    return processed
  })

  return NextResponse.json({ data: revenueData })
}
```

### Conditional Caching

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bypassCache = searchParams.get('nocache') === 'true'

  if (bypassCache) {
    // Skip cache, fetch fresh data
    return await fetchFreshData()
  }

  // Use cache
  return await getCached('key', 'customers', fetchFreshData)
}
```

## Cache Invalidation

### Using Invalidation Helpers

```typescript
import {
  invalidateCustomerCaches,
  invalidateLoyaltyCaches,
  invalidatePromotionCaches,
  invalidateAllRelatedCaches,
} from '@/lib/cache/invalidation-helpers'

// After customer update
invalidateCustomerCaches('customer-123')

// After points awarded
invalidateLoyaltyCaches('customer-123')

// After promotion update
invalidatePromotionCaches('promo-456')

// After complex operation affecting multiple entities
invalidateAllRelatedCaches({
  customerId: 'customer-123',
  jobId: 'job-789',
  invoiceId: 'invoice-101',
})
```

### Invalidation Patterns

```typescript
// 1. Specific key
invalidateCache('customer:123', 'customers')

// 2. All keys for a customer
invalidateCachePattern('customer-123', 'customers')

// 3. All customers
clearCache('customers')

// 4. All caches
clearAllCaches()
```

### When to Invalidate

| Operation | Invalidate |
|-----------|------------|
| Customer profile update | Customer caches |
| Points awarded | Loyalty caches |
| Promotion claimed | Promotion + customer caches |
| Job completed | Job + customer + invoice caches |
| Payment received | Invoice + analytics caches |
| Review submitted | Review + customer caches |
| Settings changed | Settings cache |

## Monitoring & Statistics

### View Cache Stats

```bash
# Get all cache statistics
GET /api/admin/cache/stats

# Get specific cache stats
GET /api/admin/cache/stats?cache=customers
```

### Response Format

```json
{
  "summary": {
    "totalCaches": 11,
    "totalHits": 1523,
    "totalMisses": 287,
    "totalRequests": 1810,
    "overallHitRate": "84.14%",
    "totalSize": 342,
    "totalMaxSize": 5150,
    "utilizationRate": "6.64%"
  },
  "caches": {
    "customers": {
      "hits": 456,
      "misses": 89,
      "hitRate": "83.67%",
      "size": 123,
      "maxSize": 1000,
      "utilizationRate": "12.30%"
    }
  }
}
```

### Programmatic Access

```typescript
import {
  getCacheStats,
  getAllCacheStats,
  getCacheHitRate,
  getCacheEfficiency,
} from '@/lib/cache/redis-cache'

// Get stats for specific cache
const stats = getCacheStats('customers')
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`)

// Get hit rate
const hitRate = getCacheHitRate('customers')
console.log(`Hit rate: ${hitRate.toFixed(2)}%`)

// Get efficiency metrics
const efficiency = getCacheEfficiency('customers')
console.log(efficiency)
// {
//   hitRate: "83.67%",
//   totalRequests: 545,
//   hits: 456,
//   misses: 89,
//   size: 123,
//   utilizationRate: "12.30%"
// }
```

### Clear Cache (Admin Only)

```bash
# Clear specific cache
POST /api/admin/cache/stats
{
  "action": "clear",
  "cache": "customers"
}

# Clear all caches
POST /api/admin/cache/stats
{
  "action": "clear"
}

# Reset statistics
POST /api/admin/cache/stats
{
  "action": "reset_stats",
  "cache": "customers"
}
```

## Best Practices

### DO ✅

**1. Cache Expensive Queries**

```typescript
// ✅ Good - Complex join query
const data = await getCached('analytics:revenue:2025', 'analytics', async () => {
  return await supabase
    .from('invoices')
    .select('*, jobs(*, customers(*))')
    .eq('status', 'paid')
})
```

**2. Use Cache Key Builders**

```typescript
// ✅ Good - Standardized keys
const key = customerCacheKey(customerId, 'profile')

// ❌ Bad - Manual key construction
const key = `customer:${customerId}:profile`
```

**3. Invalidate After Mutations**

```typescript
// ✅ Good - Invalidate after update
await updateCustomer(id, updates)
invalidateCustomerCaches(id)

// ❌ Bad - No invalidation
await updateCustomer(id, updates)
// Cache now contains stale data
```

**4. Use Appropriate TTLs**

```typescript
// ✅ Good - Short TTL for frequently changing data
getCached(key, 'opportunities', fetchFn) // 2 min TTL

// ✅ Good - Long TTL for static data
getCached(key, 'settings', fetchFn) // 30 min TTL
```

**5. Handle Cache Misses Gracefully**

```typescript
// ✅ Good - Always provide fetch function
const data = await getCached(key, cache, async () => {
  const { data } = await supabase.from('table').select('*')
  return data || []
})
```

### DON'T ❌

**1. Don't Cache User-Specific Auth Data**

```typescript
// ❌ Bad - Caching auth tokens
const token = await getCached('auth:token', 'customers', fetchToken)

// ✅ Good - Don't cache sensitive auth data
const token = await fetchToken()
```

**2. Don't Use Cache for Real-Time Data**

```typescript
// ❌ Bad - Live chat needs real-time
const messages = await getCached('chat:messages', 'chatbot', fetchMessages)

// ✅ Good - Fetch directly for real-time
const messages = await fetchMessages()
```

**3. Don't Forget to Invalidate**

```typescript
// ❌ Bad - Update without invalidation
await supabase.from('customers').update(data).eq('id', id)

// ✅ Good - Invalidate after update
await supabase.from('customers').update(data).eq('id', id)
invalidateCustomerCaches(id)
```

**4. Don't Cache Errors**

```typescript
// ❌ Bad - Might cache error responses
const data = await getCached(key, cache, async () => {
  const { data, error } = await supabase.from('table').select('*')
  return data // Could be null if error
})

// ✅ Good - Handle errors before caching
const data = await getCached(key, cache, async () => {
  const { data, error } = await supabase.from('table').select('*')
  if (error) throw error
  return data
})
```

**5. Don't Over-Cache**

```typescript
// ❌ Bad - Caching simple lookups
const count = await getCached('count', 'customers', () => 42)

// ✅ Good - Only cache expensive operations
const complexData = await getCached(key, cache, expensiveQuery)
```

## Troubleshooting

### Cache Not Working

**Problem:** Data not being cached

**Solutions:**
1. Check cache key is correct:
   ```typescript
   console.log('Cache key:', cacheKey)
   ```

2. Verify cache name is valid:
   ```typescript
   const validCaches = ['customers', 'promotions', 'analytics', ...]
   ```

3. Check if cache is full:
   ```typescript
   const stats = getCacheStats('customers')
   console.log(`Size: ${stats.size}/${stats.maxSize}`)
   ```

### Stale Data

**Problem:** Seeing outdated data

**Solutions:**
1. Invalidate cache after mutations:
   ```typescript
   await updateData()
   invalidateCache(key, cache)
   ```

2. Reduce TTL:
   ```typescript
   // Change in cache config
   opportunities: { ttl: 1000 * 60 * 1 } // 1 minute
   ```

3. Clear cache manually:
   ```typescript
   clearCache('customers')
   ```

### High Miss Rate

**Problem:** Cache hit rate below 50%

**Solutions:**
1. Increase cache size:
   ```typescript
   customers: { max: 2000 } // Increase from 1000
   ```

2. Increase TTL:
   ```typescript
   customers: { ttl: 1000 * 60 * 10 } // 10 minutes
   ```

3. Review cache key patterns (are keys too specific?)

### Memory Issues

**Problem:** Too much memory used by cache

**Solutions:**
1. Reduce cache sizes:
   ```typescript
   analytics: { max: 50 } // Reduce from 100
   ```

2. Reduce TTLs:
   ```typescript
   promotions: { ttl: 1000 * 60 * 5 } // 5 min instead of 10
   ```

3. Clear unused caches:
   ```typescript
   clearCache('rarely-used-cache')
   ```

## Advanced Usage

### Custom Cache Instance

```typescript
import { LRUCache } from 'lru-cache'

const customCache = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 5,
})

customCache.set('key', data)
const cached = customCache.get('key')
```

### Conditional TTL

```typescript
setCached(
  key,
  cache,
  data,
  isHighPriority ? 1000 * 60 * 30 : 1000 * 60 * 5
)
```

### Cache Preloading

```typescript
// Preload frequently accessed data on startup
async function preloadCache() {
  const customers = await fetchTopCustomers()
  customers.forEach(customer => {
    setCached(
      customerCacheKey(customer.id),
      'customers',
      customer
    )
  })
}
```

## Resources

- **Cache Utility**: `src/lib/cache/redis-cache.ts`
- **Invalidation Helpers**: `src/lib/cache/invalidation-helpers.ts`
- **Monitoring Endpoint**: `src/app/api/admin/cache/stats/route.ts`
- **Example Routes**:
  - `src/app/api/portal/promotions/route.ts`
  - `src/app/api/portal/loyalty/balance/route.ts`

---

**Need Help?** Check the code examples above or review the TypeScript definitions in the cache utility.
