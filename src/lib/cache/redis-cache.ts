/**
 * API Response Caching Layer
 *
 * Implements LRU (Least Recently Used) caching for API responses
 * to improve performance and reduce database load.
 *
 * Features:
 * - Per-entity cache configuration (TTL, max size)
 * - Automatic cache invalidation
 * - Pattern-based cache clearing
 * - Cache statistics and monitoring
 * - TypeScript type safety
 */

import { LRUCache } from 'lru-cache'

// =====================================================
// Cache Configuration
// =====================================================

interface CacheConfig {
  ttl: number // Time to live in milliseconds
  max: number // Maximum number of items in cache
  updateAgeOnGet?: boolean // Update age on cache hit
  updateAgeOnHas?: boolean // Update age on cache check
}

// Cache configurations by entity type
const cacheConfigs: Record<string, CacheConfig> = {
  customers: {
    ttl: 1000 * 60 * 5, // 5 minutes
    max: 1000,
    updateAgeOnGet: true,
  },
  opportunities: {
    ttl: 1000 * 60 * 2, // 2 minutes (frequently updated)
    max: 500,
    updateAgeOnGet: true,
  },
  promotions: {
    ttl: 1000 * 60 * 10, // 10 minutes (relatively static)
    max: 200,
    updateAgeOnGet: true,
  },
  analytics: {
    ttl: 1000 * 60 * 15, // 15 minutes (expensive queries)
    max: 100,
    updateAgeOnGet: false, // Don't extend on reads
  },
  loyalty: {
    ttl: 1000 * 60 * 5, // 5 minutes
    max: 500,
    updateAgeOnGet: true,
  },
  reviews: {
    ttl: 1000 * 60 * 5, // 5 minutes
    max: 300,
    updateAgeOnGet: true,
  },
  referrals: {
    ttl: 1000 * 60 * 5, // 5 minutes
    max: 300,
    updateAgeOnGet: true,
  },
  jobs: {
    ttl: 1000 * 60 * 3, // 3 minutes
    max: 1000,
    updateAgeOnGet: true,
  },
  invoices: {
    ttl: 1000 * 60 * 5, // 5 minutes
    max: 500,
    updateAgeOnGet: true,
  },
  chatbot: {
    ttl: 1000 * 60 * 1, // 1 minute (real-time)
    max: 200,
    updateAgeOnGet: false,
  },
  settings: {
    ttl: 1000 * 60 * 30, // 30 minutes (rarely changes)
    max: 50,
    updateAgeOnGet: false,
  },
}

// =====================================================
// Cache Instances
// =====================================================

type CacheName = keyof typeof cacheConfigs

const caches: Record<CacheName, LRUCache<string, any>> = {} as any

// Initialize cache instances
Object.entries(cacheConfigs).forEach(([name, config]) => {
  caches[name as CacheName] = new LRUCache<string, any>({
    max: config.max,
    ttl: config.ttl,
    updateAgeOnGet: config.updateAgeOnGet ?? true,
    updateAgeOnHas: config.updateAgeOnHas ?? false,
    allowStale: false, // Don't return stale data
  })
})

// =====================================================
// Cache Statistics
// =====================================================

interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  size: number
  maxSize: number
  ttl: number
}

const stats: Record<CacheName, CacheStats> = {} as any

// Initialize stats
Object.keys(cacheConfigs).forEach((name) => {
  stats[name as CacheName] = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
    maxSize: cacheConfigs[name].max,
    ttl: cacheConfigs[name].ttl,
  }
})

// =====================================================
// Core Cache Functions
// =====================================================

/**
 * Get data from cache or fetch fresh data
 *
 * @param cacheKey - Unique identifier for cached data
 * @param cacheName - Cache instance to use
 * @param fetchFn - Function to fetch fresh data if cache miss
 * @returns Cached or fresh data
 */
export async function getCached<T>(
  cacheKey: string,
  cacheName: CacheName,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cache = caches[cacheName]

  // Check cache
  const cached = cache.get(cacheKey)

  if (cached !== undefined) {
    // Cache hit
    stats[cacheName].hits++
    stats[cacheName].size = cache.size

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache HIT] ${cacheName}:${cacheKey}`)
    }

    return cached as T
  }

  // Cache miss
  stats[cacheName].misses++

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Cache MISS] ${cacheName}:${cacheKey}`)
  }

  // Fetch fresh data
  const data = await fetchFn()

  // Store in cache
  cache.set(cacheKey, data)
  stats[cacheName].sets++
  stats[cacheName].size = cache.size

  return data
}

/**
 * Get data from cache synchronously (no fetch fallback)
 *
 * @param cacheKey - Unique identifier for cached data
 * @param cacheName - Cache instance to use
 * @returns Cached data or undefined
 */
export function getCachedSync<T>(cacheKey: string, cacheName: CacheName): T | undefined {
  const cache = caches[cacheName]
  const cached = cache.get(cacheKey)

  if (cached !== undefined) {
    stats[cacheName].hits++
  } else {
    stats[cacheName].misses++
  }

  stats[cacheName].size = cache.size

  return cached as T | undefined
}

/**
 * Set data in cache
 *
 * @param cacheKey - Unique identifier for cached data
 * @param cacheName - Cache instance to use
 * @param data - Data to cache
 * @param customTTL - Optional custom TTL in milliseconds
 */
export function setCached<T>(
  cacheKey: string,
  cacheName: CacheName,
  data: T,
  customTTL?: number
): void {
  const cache = caches[cacheName]

  cache.set(cacheKey, data, {
    ttl: customTTL,
  })

  stats[cacheName].sets++
  stats[cacheName].size = cache.size

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Cache SET] ${cacheName}:${cacheKey}`)
  }
}

/**
 * Check if key exists in cache
 *
 * @param cacheKey - Unique identifier for cached data
 * @param cacheName - Cache instance to use
 * @returns True if key exists in cache
 */
export function hasCached(cacheKey: string, cacheName: CacheName): boolean {
  const cache = caches[cacheName]
  return cache.has(cacheKey)
}

// =====================================================
// Cache Invalidation
// =====================================================

/**
 * Invalidate (delete) a specific cache key
 *
 * @param cacheKey - Cache key to invalidate
 * @param cacheName - Cache instance to use
 */
export function invalidateCache(cacheKey: string, cacheName: CacheName): void {
  const cache = caches[cacheName]
  const deleted = cache.delete(cacheKey)

  if (deleted) {
    stats[cacheName].deletes++
    stats[cacheName].size = cache.size

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache DELETE] ${cacheName}:${cacheKey}`)
    }
  }
}

/**
 * Invalidate all cache keys matching a pattern
 *
 * @param pattern - String pattern to match
 * @param cacheName - Cache instance to use
 * @returns Number of keys deleted
 */
export function invalidateCachePattern(pattern: string, cacheName: CacheName): number {
  const cache = caches[cacheName]
  const keys = Array.from(cache.keys())
  let deletedCount = 0

  keys.forEach((key) => {
    if (key.includes(pattern)) {
      cache.delete(key)
      deletedCount++
      stats[cacheName].deletes++
    }
  })

  stats[cacheName].size = cache.size

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Cache DELETE PATTERN] ${cacheName}:${pattern} (${deletedCount} keys)`)
  }

  return deletedCount
}

/**
 * Clear all cache entries for a specific cache
 *
 * @param cacheName - Cache instance to clear
 */
export function clearCache(cacheName: CacheName): void {
  const cache = caches[cacheName]
  const sizeBeforeClear = cache.size

  cache.clear()
  stats[cacheName].deletes += sizeBeforeClear
  stats[cacheName].size = 0

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Cache CLEAR] ${cacheName} (${sizeBeforeClear} keys)`)
  }
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  Object.keys(caches).forEach((name) => {
    clearCache(name as CacheName)
  })

  if (process.env.NODE_ENV === 'development') {
    console.log('[Cache CLEAR ALL]')
  }
}

// =====================================================
// Cache Statistics and Monitoring
// =====================================================

/**
 * Get statistics for a specific cache
 *
 * @param cacheName - Cache instance to get stats for
 * @returns Cache statistics
 */
export function getCacheStats(cacheName: CacheName): CacheStats {
  return {
    ...stats[cacheName],
    size: caches[cacheName].size,
  }
}

/**
 * Get statistics for all caches
 *
 * @returns Statistics for all cache instances
 */
export function getAllCacheStats(): Record<CacheName, CacheStats> {
  const allStats: Record<string, CacheStats> = {}

  Object.keys(caches).forEach((name) => {
    allStats[name] = getCacheStats(name as CacheName)
  })

  return allStats as Record<CacheName, CacheStats>
}

/**
 * Calculate cache hit rate
 *
 * @param cacheName - Cache instance to calculate for
 * @returns Hit rate as percentage (0-100)
 */
export function getCacheHitRate(cacheName: CacheName): number {
  const { hits, misses } = stats[cacheName]
  const total = hits + misses

  if (total === 0) return 0

  return (hits / total) * 100
}

/**
 * Get cache efficiency metrics
 *
 * @param cacheName - Cache instance to analyze
 * @returns Efficiency metrics
 */
export function getCacheEfficiency(cacheName: CacheName) {
  const cacheStats = stats[cacheName]
  const hitRate = getCacheHitRate(cacheName)
  const total = cacheStats.hits + cacheStats.misses

  return {
    hitRate: hitRate.toFixed(2) + '%',
    totalRequests: total,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    size: cacheStats.size,
    maxSize: cacheStats.maxSize,
    utilizationRate: ((cacheStats.size / cacheStats.maxSize) * 100).toFixed(2) + '%',
    sets: cacheStats.sets,
    deletes: cacheStats.deletes,
    ttl: cacheStats.ttl,
  }
}

/**
 * Reset statistics for a cache
 *
 * @param cacheName - Cache instance to reset stats for
 */
export function resetCacheStats(cacheName: CacheName): void {
  stats[cacheName] = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: caches[cacheName].size,
    maxSize: cacheConfigs[cacheName].max,
    ttl: cacheConfigs[cacheName].ttl,
  }
}

/**
 * Reset all cache statistics
 */
export function resetAllCacheStats(): void {
  Object.keys(caches).forEach((name) => {
    resetCacheStats(name as CacheName)
  })
}

// =====================================================
// Cache Key Builders
// =====================================================

/**
 * Build a standardized cache key
 *
 * @param parts - Key components
 * @returns Formatted cache key
 */
export function buildCacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter((p) => p !== undefined && p !== null).join(':')
}

/**
 * Build cache key for customer data
 */
export function customerCacheKey(customerId: string, suffix?: string): string {
  return buildCacheKey('customer', customerId, suffix)
}

/**
 * Build cache key for opportunities
 */
export function opportunityCacheKey(
  identifier: string | 'all' | 'list',
  filter?: string
): string {
  return buildCacheKey('opportunity', identifier, filter)
}

/**
 * Build cache key for promotions
 */
export function promotionCacheKey(identifier: string | 'active' | 'all', filter?: string): string {
  return buildCacheKey('promotion', identifier, filter)
}

/**
 * Build cache key for analytics
 */
export function analyticsCacheKey(type: string, ...params: (string | number)[]): string {
  return buildCacheKey('analytics', type, ...params)
}

/**
 * Build cache key for loyalty data
 */
export function loyaltyCacheKey(customerId: string, type?: string): string {
  return buildCacheKey('loyalty', customerId, type)
}

// =====================================================
// Cache Warming
// =====================================================

/**
 * Warm up cache with frequently accessed data
 *
 * @param cacheName - Cache to warm
 * @param data - Array of [key, value] pairs
 */
export function warmCache<T>(cacheName: CacheName, data: Array<[string, T]>): void {
  const cache = caches[cacheName]

  data.forEach(([key, value]) => {
    cache.set(key, value)
    stats[cacheName].sets++
  })

  stats[cacheName].size = cache.size

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Cache WARM] ${cacheName} (${data.length} entries)`)
  }
}

// =====================================================
// Export Types
// =====================================================

export type { CacheName, CacheStats, CacheConfig }

// Export cache instances for advanced use cases
export { caches }
