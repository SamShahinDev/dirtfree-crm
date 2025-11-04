/**
 * Request Deduplication Utility
 *
 * Prevents duplicate concurrent API requests by tracking pending requests
 * and returning the same Promise for identical concurrent requests.
 *
 * Benefits:
 * - Reduces redundant API calls
 * - Saves bandwidth and reduces server load
 * - Improves response time for duplicate requests
 * - Prevents race conditions
 *
 * Usage:
 * ```typescript
 * const data = await dedupeRequest('customer-123', () => fetchCustomer('123'))
 * ```
 */

// Map to track pending requests
const pendingRequests = new Map<string, Promise<any>>()

// Map to track request statistics
interface RequestStats {
  total: number
  deduplicated: number
  failed: number
}

const requestStats = new Map<string, RequestStats>()

/**
 * Deduplicate concurrent requests
 *
 * If a request with the same key is already pending, returns that Promise.
 * Otherwise, creates a new request.
 *
 * @param key - Unique identifier for the request
 * @param fetcher - Function that returns a Promise
 * @returns Promise with the result
 *
 * @example
 * ```typescript
 * // Multiple concurrent calls with same key will share one request
 * const [data1, data2, data3] = await Promise.all([
 *   dedupeRequest('user-123', () => fetchUser('123')),
 *   dedupeRequest('user-123', () => fetchUser('123')),
 *   dedupeRequest('user-123', () => fetchUser('123')),
 * ])
 * // Only ONE actual fetch happens, result is shared
 * ```
 */
export async function dedupeRequest<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check if request is already pending
  if (pendingRequests.has(key)) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Dedupe HIT] Request already pending: ${key}`)
    }

    // Update stats
    updateStats(key, 'deduplicated')

    // Return existing Promise
    return pendingRequests.get(key) as Promise<T>
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Dedupe NEW] Creating new request: ${key}`)
  }

  // Update stats
  updateStats(key, 'total')

  // Create new request
  const promise = fetcher()
    .then((result) => {
      // Clean up after successful completion
      pendingRequests.delete(key)
      return result
    })
    .catch((error) => {
      // Clean up after error
      pendingRequests.delete(key)
      updateStats(key, 'failed')
      throw error
    })

  // Store the pending request
  pendingRequests.set(key, promise)

  return promise
}

/**
 * Create a deduplicated fetcher function
 *
 * @param keyBuilder - Function to build cache key from arguments
 * @param fetcher - Function that fetches data
 * @returns Deduplicated version of fetcher
 *
 * @example
 * ```typescript
 * const fetchCustomer = createDedupedFetcher(
 *   (id: string) => `customer-${id}`,
 *   async (id: string) => {
 *     const res = await fetch(`/api/customers/${id}`)
 *     return res.json()
 *   }
 * )
 *
 * // Use like a normal function
 * const customer = await fetchCustomer('123')
 * ```
 */
export function createDedupedFetcher<TArgs extends any[], TResult>(
  keyBuilder: (...args: TArgs) => string,
  fetcher: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => {
    const key = keyBuilder(...args)
    return dedupeRequest(key, () => fetcher(...args))
  }
}

/**
 * Clear a specific pending request
 *
 * @param key - Request key to clear
 */
export function clearPendingRequest(key: string): void {
  pendingRequests.delete(key)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Dedupe CLEAR] Cleared pending request: ${key}`)
  }
}

/**
 * Clear all pending requests
 */
export function clearAllPendingRequests(): void {
  const count = pendingRequests.size
  pendingRequests.clear()
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Dedupe CLEAR ALL] Cleared ${count} pending requests`)
  }
}

/**
 * Get number of pending requests
 */
export function getPendingRequestCount(): number {
  return pendingRequests.size
}

/**
 * Check if a request is pending
 */
export function isPending(key: string): boolean {
  return pendingRequests.has(key)
}

/**
 * Get all pending request keys
 */
export function getPendingRequestKeys(): string[] {
  return Array.from(pendingRequests.keys())
}

/**
 * Update request statistics
 */
function updateStats(key: string, type: 'total' | 'deduplicated' | 'failed'): void {
  if (!requestStats.has(key)) {
    requestStats.set(key, { total: 0, deduplicated: 0, failed: 0 })
  }

  const stats = requestStats.get(key)!
  stats[type]++
}

/**
 * Get statistics for a specific request key
 */
export function getRequestStats(key: string): RequestStats | undefined {
  return requestStats.get(key)
}

/**
 * Get all request statistics
 */
export function getAllRequestStats(): Map<string, RequestStats> {
  return new Map(requestStats)
}

/**
 * Calculate deduplication efficiency for a key
 */
export function getDedupeEfficiency(key: string): number {
  const stats = requestStats.get(key)
  if (!stats || stats.total === 0) return 0

  return (stats.deduplicated / stats.total) * 100
}

/**
 * Reset statistics
 */
export function resetStats(): void {
  requestStats.clear()
}

/**
 * Get summary of all stats
 */
export function getStatsSummary(): {
  totalRequests: number
  totalDeduplicated: number
  totalFailed: number
  efficiency: number
  activePending: number
} {
  let totalRequests = 0
  let totalDeduplicated = 0
  let totalFailed = 0

  for (const stats of requestStats.values()) {
    totalRequests += stats.total
    totalDeduplicated += stats.deduplicated
    totalFailed += stats.failed
  }

  const efficiency = totalRequests > 0 ? (totalDeduplicated / totalRequests) * 100 : 0

  return {
    totalRequests,
    totalDeduplicated,
    totalFailed,
    efficiency,
    activePending: pendingRequests.size,
  }
}

// =====================================================
// Pre-configured Deduped Fetchers
// =====================================================

/**
 * Example: Deduplicated customer fetcher
 */
export const fetchCustomerDeduped = createDedupedFetcher(
  (customerId: string) => `customer-${customerId}`,
  async (customerId: string) => {
    const response = await fetch(`/api/customers/${customerId}`)
    return response.json()
  }
)

/**
 * Example: Deduplicated opportunities fetcher
 */
export const fetchOpportunitiesDeduped = createDedupedFetcher(
  (filters?: Record<string, any>) => `opportunities-${JSON.stringify(filters || {})}`,
  async (filters?: Record<string, any>) => {
    const params = new URLSearchParams(filters)
    const response = await fetch(`/api/opportunities?${params}`)
    return response.json()
  }
)

/**
 * Example: Deduplicated analytics fetcher
 */
export const fetchAnalyticsDeduped = createDedupedFetcher(
  (startDate: string, endDate: string, metric: string) =>
    `analytics-${metric}-${startDate}-${endDate}`,
  async (startDate: string, endDate: string, metric: string) => {
    const response = await fetch(
      `/api/analytics/${metric}?start=${startDate}&end=${endDate}`
    )
    return response.json()
  }
)
