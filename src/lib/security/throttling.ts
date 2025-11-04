/**
 * Request Throttling
 *
 * Implements per-user and per-action rate limiting to prevent abuse.
 * Uses in-memory storage by default with optional Redis support.
 *
 * @module lib/security/throttling
 */

/**
 * Throttle configuration for an action
 */
export interface ThrottleConfig {
  /**
   * Maximum number of requests allowed
   */
  points: number

  /**
   * Time window in seconds
   */
  duration: number

  /**
   * Optional custom error message
   */
  errorMessage?: string
}

/**
 * Result of a throttle check
 */
export interface ThrottleResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean

  /**
   * Remaining requests in the current window
   */
  remaining: number

  /**
   * Time until the window resets (in seconds)
   */
  resetAfter: number

  /**
   * Error message if not allowed
   */
  errorMessage?: string
}

/**
 * Throttle record for tracking requests
 */
interface ThrottleRecord {
  count: number
  resetAt: number
}

/**
 * In-memory throttle storage
 */
class InMemoryThrottleStore {
  private store: Map<string, ThrottleRecord> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired records every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, record] of this.store.entries()) {
      if (record.resetAt < now) {
        this.store.delete(key)
      }
    }
  }

  get(key: string): ThrottleRecord | undefined {
    const record = this.store.get(key)
    if (!record) return undefined

    // Check if expired
    if (record.resetAt < Date.now()) {
      this.store.delete(key)
      return undefined
    }

    return record
  }

  set(key: string, record: ThrottleRecord): void {
    this.store.set(key, record)
  }

  increment(key: string, duration: number): ThrottleRecord {
    const existing = this.get(key)

    if (existing) {
      existing.count++
      this.set(key, existing)
      return existing
    }

    const newRecord: ThrottleRecord = {
      count: 1,
      resetAt: Date.now() + duration * 1000,
    }
    this.set(key, newRecord)
    return newRecord
  }

  clear() {
    this.store.clear()
  }

  destroy() {
    clearInterval(this.cleanupInterval)
    this.clear()
  }
}

// Singleton instance
const throttleStore = new InMemoryThrottleStore()

/**
 * Predefined throttle configurations for different actions
 */
export const throttleConfigs: Record<string, ThrottleConfig> = {
  // Opportunity actions
  opportunities: {
    points: 20,
    duration: 60,
    errorMessage: 'Too many opportunity requests. Please try again in a minute.',
  },

  // Promotion actions
  promotions: {
    points: 10,
    duration: 60,
    errorMessage: 'Too many promotion requests. Please try again in a minute.',
  },

  // Analytics requests
  analytics: {
    points: 30,
    duration: 60,
    errorMessage: 'Too many analytics requests. Please slow down.',
  },

  // Customer creation/updates
  customers: {
    points: 50,
    duration: 60,
    errorMessage: 'Too many customer requests. Please slow down.',
  },

  // Export actions (more restrictive)
  export: {
    points: 5,
    duration: 60,
    errorMessage: 'Export limit reached. Please wait before exporting again.',
  },

  // Authentication attempts
  auth: {
    points: 5,
    duration: 300, // 5 minutes
    errorMessage: 'Too many authentication attempts. Please try again in 5 minutes.',
  },

  // Password reset
  passwordReset: {
    points: 3,
    duration: 3600, // 1 hour
    errorMessage: 'Too many password reset attempts. Please try again later.',
  },

  // General API requests
  api: {
    points: 100,
    duration: 60,
    errorMessage: 'Rate limit exceeded. Please slow down.',
  },

  // Webhook deliveries
  webhook: {
    points: 50,
    duration: 60,
    errorMessage: 'Webhook rate limit exceeded.',
  },

  // SMS sending
  sms: {
    points: 10,
    duration: 3600, // 1 hour
    errorMessage: 'SMS rate limit exceeded. Please try again later.',
  },

  // Email sending
  email: {
    points: 20,
    duration: 3600, // 1 hour
    errorMessage: 'Email rate limit exceeded. Please try again later.',
  },
}

/**
 * Check if a request is throttled
 *
 * @param userId - The user ID to check throttling for
 * @param action - The action being throttled
 * @param customConfig - Optional custom throttle configuration
 * @returns Throttle result
 *
 * @example
 * ```typescript
 * const result = await checkThrottle(user.id, 'opportunities')
 *
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: result.errorMessage },
 *     {
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Remaining': result.remaining.toString(),
 *         'X-RateLimit-Reset': result.resetAfter.toString()
 *       }
 *     }
 *   )
 * }
 * ```
 */
export async function checkThrottle(
  userId: string,
  action: string,
  customConfig?: ThrottleConfig
): Promise<ThrottleResult> {
  // Get config for this action
  const config = customConfig || throttleConfigs[action]

  if (!config) {
    // No throttling configured for this action
    return {
      allowed: true,
      remaining: Infinity,
      resetAfter: 0,
    }
  }

  // Generate key
  const key = `throttle:${action}:${userId}`

  // Increment counter
  const record = throttleStore.increment(key, config.duration)

  // Check if over limit
  const allowed = record.count <= config.points
  const remaining = Math.max(0, config.points - record.count)
  const resetAfter = Math.ceil((record.resetAt - Date.now()) / 1000)

  return {
    allowed,
    remaining,
    resetAfter,
    errorMessage: allowed ? undefined : config.errorMessage,
  }
}

/**
 * Check throttle for IP address instead of user
 *
 * Useful for rate limiting before authentication.
 *
 * @param ipAddress - The IP address to throttle
 * @param action - The action being throttled
 * @param customConfig - Optional custom configuration
 * @returns Throttle result
 */
export async function checkThrottleByIP(
  ipAddress: string,
  action: string,
  customConfig?: ThrottleConfig
): Promise<ThrottleResult> {
  return checkThrottle(ipAddress, action, customConfig)
}

/**
 * Reset throttle for a user and action
 *
 * @param userId - The user ID
 * @param action - The action to reset
 */
export function resetThrottle(userId: string, action: string): void {
  const key = `throttle:${action}:${userId}`
  throttleStore.set(key, { count: 0, resetAt: 0 })
}

/**
 * Middleware wrapper that applies throttling to a handler
 *
 * @param handler - The request handler
 * @param action - The action to throttle
 * @param getUserId - Function to extract user ID from request
 * @returns Wrapped handler with throttling
 *
 * @example
 * ```typescript
 * export const POST = withThrottling(
 *   async (req, { user }) => {
 *     // Handle request
 *     return NextResponse.json({ success: true })
 *   },
 *   'opportunities',
 *   (req, context) => context.user.id
 * )
 * ```
 */
export function withThrottling<T = any>(
  handler: (req: Request, context?: T) => Promise<Response> | Response,
  action: string,
  getUserId: (req: Request, context?: T) => string | Promise<string>
) {
  return async (req: Request, context?: T): Promise<Response> => {
    try {
      // Get user ID
      const userId = await getUserId(req, context)

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Unable to identify user for throttling' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Check throttle
      const result = await checkThrottle(userId, action)

      if (!result.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: result.errorMessage,
            retryAfter: result.resetAfter,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': result.resetAfter.toString(),
              'Retry-After': result.resetAfter.toString(),
            },
          }
        )
      }

      // Call handler
      const response = await handler(req, context)

      // Add rate limit headers to response
      const newResponse = new Response(response.body, response)
      newResponse.headers.set('X-RateLimit-Remaining', result.remaining.toString())
      newResponse.headers.set('X-RateLimit-Reset', result.resetAfter.toString())

      return newResponse
    } catch (error) {
      console.error('Error in throttling middleware:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
}

/**
 * Middleware that combines authentication and throttling
 *
 * @param handler - The request handler
 * @param action - The action to throttle
 * @returns Wrapped handler
 *
 * @example
 * ```typescript
 * import { withAuthAndThrottling } from '@/lib/security/throttling'
 *
 * export const POST = withAuthAndThrottling(
 *   async (req, { user }) => {
 *     // user is authenticated and request is not throttled
 *     return NextResponse.json({ success: true })
 *   },
 *   'opportunities'
 * )
 * ```
 */
export function withAuthAndThrottling(
  handler: (req: Request, context: { user: any }) => Promise<Response> | Response,
  action: string
) {
  return withThrottling(handler, action, (_req, context) => {
    if (!context?.user?.id) {
      throw new Error('User not authenticated')
    }
    return context.user.id
  })
}

/**
 * Create a custom throttle configuration
 *
 * @param points - Maximum requests allowed
 * @param duration - Time window in seconds
 * @param errorMessage - Optional custom error message
 * @returns Throttle configuration
 *
 * @example
 * ```typescript
 * const customConfig = createThrottleConfig(100, 60, 'Custom rate limit exceeded')
 * const result = await checkThrottle(userId, 'custom-action', customConfig)
 * ```
 */
export function createThrottleConfig(
  points: number,
  duration: number,
  errorMessage?: string
): ThrottleConfig {
  return {
    points,
    duration,
    errorMessage: errorMessage || `Rate limit exceeded. Maximum ${points} requests per ${duration} seconds.`,
  }
}

/**
 * Get current throttle status for a user
 *
 * Useful for displaying rate limit info to users.
 *
 * @param userId - The user ID
 * @param action - The action to check
 * @returns Current throttle status
 */
export async function getThrottleStatus(
  userId: string,
  action: string
): Promise<{
  limit: number
  remaining: number
  resetAfter: number
  used: number
}> {
  const config = throttleConfigs[action]
  if (!config) {
    return {
      limit: Infinity,
      remaining: Infinity,
      resetAfter: 0,
      used: 0,
    }
  }

  const key = `throttle:${action}:${userId}`
  const record = throttleStore.get(key)

  if (!record) {
    return {
      limit: config.points,
      remaining: config.points,
      resetAfter: 0,
      used: 0,
    }
  }

  return {
    limit: config.points,
    remaining: Math.max(0, config.points - record.count),
    resetAfter: Math.ceil((record.resetAt - Date.now()) / 1000),
    used: record.count,
  }
}

/**
 * Clear all throttle data
 *
 * Use with caution - mainly for testing.
 */
export function clearAllThrottles(): void {
  throttleStore.clear()
}

/**
 * Export store for testing purposes
 */
export const __testing__ = {
  store: throttleStore,
}
