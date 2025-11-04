# Caching Quick Reference

Quick reference for API response caching in Dirt Free CRM.

## Basic Usage

### 1. Cache a Query

```typescript
import { getCached, customerCacheKey } from '@/lib/cache/redis-cache'

const data = await getCached(
  customerCacheKey('123'),
  'customers',
  async () => fetchFromDatabase()
)
```

### 2. Invalidate Cache

```typescript
import { invalidateCache } from '@/lib/cache/redis-cache'

invalidateCache(customerCacheKey('123'), 'customers')
```

### 3. Invalidate Pattern

```typescript
import { invalidateCachePattern } from '@/lib/cache/redis-cache'

invalidateCachePattern('customer-123', 'customers')
```

## Cache Names

| Name | TTL | Max | Use Case |
|------|-----|-----|----------|
| `customers` | 5m | 1000 | Customer data |
| `opportunities` | 2m | 500 | Opportunities |
| `promotions` | 10m | 200 | Promotions |
| `analytics` | 15m | 100 | Analytics |
| `loyalty` | 5m | 500 | Loyalty data |
| `reviews` | 5m | 300 | Reviews |
| `referrals` | 5m | 300 | Referrals |
| `jobs` | 3m | 1000 | Jobs |
| `invoices` | 5m | 500 | Invoices |
| `chatbot` | 1m | 200 | Chatbot |
| `settings` | 30m | 50 | Settings |

## Key Builders

```typescript
import {
  customerCacheKey,
  promotionCacheKey,
  loyaltyCacheKey,
  analyticsCacheKey,
  buildCacheKey,
} from '@/lib/cache/redis-cache'

customerCacheKey('123')                    // 'customer:123'
customerCacheKey('123', 'profile')         // 'customer:123:profile'
promotionCacheKey('active', '456')         // 'promotion:active:456'
loyaltyCacheKey('123', 'balance')          // 'loyalty:123:balance'
analyticsCacheKey('revenue', '2025', 'Q1') // 'analytics:revenue:2025:Q1'
buildCacheKey('custom', 'key', '123')      // 'custom:key:123'
```

## Invalidation Helpers

```typescript
import {
  invalidateCustomerCaches,
  invalidateLoyaltyCaches,
  invalidatePromotionCaches,
  invalidateAllRelatedCaches,
} from '@/lib/cache/invalidation-helpers'

// After customer update
invalidateCustomerCaches('customer-123')

// After points update
invalidateLoyaltyCaches('customer-123')

// After promotion update
invalidatePromotionCaches('promo-456')

// Complex operation
invalidateAllRelatedCaches({
  customerId: '123',
  jobId: '456',
  invoiceId: '789',
})
```

## API Route Pattern

```typescript
import { getCached, invalidateCache, customerCacheKey } from '@/lib/cache/redis-cache'

// GET - Use cache
export async function GET(request: NextRequest) {
  const id = searchParams.get('id')
  const key = customerCacheKey(id!)

  const data = await getCached(key, 'customers', async () => {
    return await fetchFromDatabase(id)
  })

  return NextResponse.json({ data })
}

// POST/PUT - Invalidate cache
export async function PUT(request: NextRequest) {
  const { id, ...updates } = await request.json()

  await updateDatabase(id, updates)

  // Invalidate cache
  invalidateCache(customerCacheKey(id), 'customers')

  return NextResponse.json({ success: true })
}
```

## Monitoring

```bash
# View cache stats
GET /api/admin/cache/stats

# View specific cache
GET /api/admin/cache/stats?cache=customers

# Clear cache
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
```

## Programmatic Stats

```typescript
import {
  getCacheStats,
  getCacheHitRate,
  getCacheEfficiency,
} from '@/lib/cache/redis-cache'

const stats = getCacheStats('customers')
// { hits: 456, misses: 89, size: 123, maxSize: 1000, ... }

const hitRate = getCacheHitRate('customers')
// 83.67

const efficiency = getCacheEfficiency('customers')
// { hitRate: "83.67%", totalRequests: 545, ... }
```

## Common Operations

### Cache with Custom TTL

```typescript
import { setCached } from '@/lib/cache/redis-cache'

setCached(
  'key',
  'customers',
  data,
  1000 * 60 * 30 // 30 minutes
)
```

### Check if Cached

```typescript
import { hasCached } from '@/lib/cache/redis-cache'

if (hasCached('key', 'customers')) {
  // Data is cached
}
```

### Clear Specific Cache

```typescript
import { clearCache } from '@/lib/cache/redis-cache'

clearCache('customers')
```

### Clear All Caches

```typescript
import { clearAllCaches } from '@/lib/cache/redis-cache'

clearAllCaches()
```

## When to Invalidate

| Operation | Invalidate |
|-----------|------------|
| Customer update | Customer caches |
| Points awarded | Loyalty caches |
| Promotion claimed | Promotion + customer caches |
| Job completed | Job + customer + invoice caches |
| Payment received | Invoice + analytics caches |
| Review submitted | Review + customer caches |

## Best Practices

### DO ✅
- Cache expensive queries
- Use key builders
- Invalidate after mutations
- Use appropriate TTLs
- Handle cache misses

### DON'T ❌
- Cache auth tokens
- Cache real-time data
- Forget to invalidate
- Cache errors
- Over-cache simple queries

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Not caching | Check cache key & name |
| Stale data | Invalidate after mutations |
| High miss rate | Increase size or TTL |
| Memory issues | Reduce size or TTL |

## Resources

- Full guide: `CACHING-GUIDE.md`
- Cache utility: `src/lib/cache/redis-cache.ts`
- Invalidation helpers: `src/lib/cache/invalidation-helpers.ts`
- Examples: `src/app/api/portal/promotions/route.ts`

---

**Need more details?** See `CACHING-GUIDE.md`
