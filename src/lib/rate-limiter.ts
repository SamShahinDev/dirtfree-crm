/**
 * Distributed Rate Limiter using Upstash Redis
 *
 * This module provides distributed rate limiting that works in serverless environments.
 * Uses Upstash Redis for persistent, distributed rate limit tracking across all instances.
 *
 * Features:
 * - Sliding window rate limiting
 * - Configurable limits per customer/IP
 * - Graceful fallback if Redis unavailable
 * - Works in Vercel/serverless deployments
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp in seconds
  retryAfter?: number // Seconds until reset (only when limited)
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  requests: number // Max requests
  window: number // Window in seconds
}

/**
 * Default rate limit configurations
 */
const DEFAULT_PORTAL_LIMIT: RateLimitConfig = {
  requests: 100,
  window: 60, // 1 minute
}

const DEFAULT_API_LIMIT: RateLimitConfig = {
  requests: 60,
  window: 60, // 1 minute
}

/**
 * Portal Rate Limiter Class
 * Implements distributed rate limiting for the customer portal API
 */
export class PortalRateLimiter {
  private ratelimiter: Ratelimit | null = null
  private redisAvailable = false
  private config: RateLimitConfig

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      requests: config?.requests || parseInt(process.env.PORTAL_RATE_LIMIT_REQUESTS || '100'),
      window: config?.window || parseInt(process.env.PORTAL_RATE_LIMIT_WINDOW_SECONDS || '60'),
    }

    this.initialize()
  }

  /**
   * Initialize Redis connection and rate limiter
   */
  private initialize(): void {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!redisUrl || !redisToken) {
      console.warn(
        '[PortalRateLimiter] Upstash Redis credentials not configured. ' +
        'Rate limiting will be disabled. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
      )
      this.redisAvailable = false
      return
    }

    try {
      // Create Redis client
      const redis = new Redis({
        url: redisUrl,
        token: redisToken,
      })

      // Create rate limiter with sliding window algorithm
      this.ratelimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(this.config.requests, `${this.config.window} s`),
        analytics: true,
        prefix: 'portal:ratelimit',
      })

      this.redisAvailable = true
    } catch (error) {
      console.error('[PortalRateLimiter] Failed to initialize Redis:', error)
      this.redisAvailable = false
    }
  }

  /**
   * Check and consume rate limit for a customer
   *
   * @param customerId - Customer ID to rate limit
   * @returns Rate limit result
   */
  async limit(customerId: string): Promise<RateLimitResult> {
    // If Redis not available, allow the request with a warning
    if (!this.ratelimiter || !this.redisAvailable) {
      console.warn(`[PortalRateLimiter] Rate limiting bypassed for customer ${customerId} (Redis unavailable)`)

      return {
        success: true,
        limit: this.config.requests,
        remaining: this.config.requests,
        reset: Math.floor(Date.now() / 1000) + this.config.window,
      }
    }

    try {
      const identifier = `customer:${customerId}`
      const result = await this.ratelimiter.limit(identifier)

      if (!result.success) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)

        return {
          success: false,
          limit: result.limit,
          remaining: result.remaining,
          reset: Math.floor(result.reset / 1000),
          retryAfter: Math.max(0, retryAfter),
        }
      }

      // Request allowed
      return {
        success: true,
        limit: result.limit,
        remaining: result.remaining,
        reset: Math.floor(result.reset / 1000),
      }
    } catch (error) {
      // On error, fail open (allow the request) but log the error
      console.error('[PortalRateLimiter] Rate limit check failed:', error)

      return {
        success: true,
        limit: this.config.requests,
        remaining: this.config.requests,
        reset: Math.floor(Date.now() / 1000) + this.config.window,
      }
    }
  }

  /**
   * Check rate limit without consuming
   * Useful for checking status without incrementing counter
   *
   * @param customerId - Customer ID to check
   * @returns Current rate limit status
   */
  async check(customerId: string): Promise<RateLimitResult> {
    if (!this.ratelimiter || !this.redisAvailable) {
      return {
        success: true,
        limit: this.config.requests,
        remaining: this.config.requests,
        reset: Math.floor(Date.now() / 1000) + this.config.window,
      }
    }

    try {
      const identifier = `customer:${customerId}`
      const result = await this.ratelimiter.limit(identifier)

      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: Math.floor(result.reset / 1000),
        retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
      }
    } catch (error) {
      console.error('[PortalRateLimiter] Rate limit check failed:', error)

      return {
        success: true,
        limit: this.config.requests,
        remaining: this.config.requests,
        reset: Math.floor(Date.now() / 1000) + this.config.window,
      }
    }
  }

  /**
   * Reset rate limit for a customer (admin function)
   *
   * @param customerId - Customer ID to reset
   */
  async reset(customerId: string): Promise<void> {
    if (!this.ratelimiter || !this.redisAvailable) {
      console.warn('[PortalRateLimiter] Cannot reset - Redis unavailable')
      return
    }

    try {
      const identifier = `customer:${customerId}`
      const redis = this.ratelimiter as any // Access underlying Redis client

      // Delete the rate limit key
      if (redis.redis) {
        await redis.redis.del(`portal:ratelimit:${identifier}`)
      }
    } catch (error) {
      console.error('[PortalRateLimiter] Failed to reset rate limit:', error)
    }
  }

  /**
   * Get configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config }
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.redisAvailable
  }
}

/**
 * Global portal rate limiter instance (singleton)
 */
let portalRateLimiter: PortalRateLimiter | null = null

/**
 * Get or create portal rate limiter instance
 */
export function getPortalRateLimiter(): PortalRateLimiter {
  if (!portalRateLimiter) {
    portalRateLimiter = new PortalRateLimiter()
  }
  return portalRateLimiter
}

/**
 * API Rate Limiter Class
 * For general API rate limiting (not portal-specific)
 */
export class APIRateLimiter {
  private ratelimiter: Ratelimit | null = null
  private redisAvailable = false
  private config: RateLimitConfig

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      requests: config?.requests || DEFAULT_API_LIMIT.requests,
      window: config?.window || DEFAULT_API_LIMIT.window,
    }

    this.initialize()
  }

  private initialize(): void {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!redisUrl || !redisToken) {
      console.warn('[APIRateLimiter] Redis not configured. Rate limiting disabled.')
      this.redisAvailable = false
      return
    }

    try {
      const redis = new Redis({
        url: redisUrl,
        token: redisToken,
      })

      this.ratelimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(this.config.requests, `${this.config.window} s`),
        analytics: true,
        prefix: 'api:ratelimit',
      })

      this.redisAvailable = true
    } catch (error) {
      console.error('[APIRateLimiter] Failed to initialize Redis:', error)
      this.redisAvailable = false
    }
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    if (!this.ratelimiter || !this.redisAvailable) {
      return {
        success: true,
        limit: this.config.requests,
        remaining: this.config.requests,
        reset: Math.floor(Date.now() / 1000) + this.config.window,
      }
    }

    try {
      const result = await this.ratelimiter.limit(identifier)

      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: Math.floor(result.reset / 1000),
        retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
      }
    } catch (error) {
      console.error('[APIRateLimiter] Rate limit check failed:', error)

      return {
        success: true,
        limit: this.config.requests,
        remaining: this.config.requests,
        reset: Math.floor(Date.now() / 1000) + this.config.window,
      }
    }
  }
}

/**
 * Create standard rate limit headers
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  }

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter)
  }

  return headers
}
