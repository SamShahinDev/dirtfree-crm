/**
 * Rate limiting utilities using rate-limiter-flexible
 * Server-side only
 */

// Server-only guard
if (typeof window !== 'undefined') {
  throw new Error('This module must only be used on the server side')
}

import { RateLimiterMemory } from 'rate-limiter-flexible'

// Types for rate limit info
export interface RateLimitInfo {
  limit: number
  remaining: number
  resetTime: Date
  retryAfterSec: number
}

// Rate limit headers helper
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string
  'X-RateLimit-Reset': string
  'Retry-After': string
}

// Global rate limiters - in-memory for now
// TODO: Migrate to Redis for production scaling across multiple instances
const ipLimiter = new RateLimiterMemory({
  keyGenerator: (ip: string) => `ip:${ip}`,
  points: 60, // Number of requests
  duration: 60, // Per 60 seconds
})

const phoneLimiter = new RateLimiterMemory({
  keyGenerator: (phone: string) => `phone:${phone}`,
  points: 10, // Number of messages
  duration: 300, // Per 300 seconds (5 minutes)
})

/**
 * Rate limit by IP address
 *
 * @param ip - IP address to rate limit
 * @param points - Number of points to consume (default: 1)
 * @param durationSec - Duration in seconds for the limit window
 * @throws Response with 429 status when rate limit exceeded
 */
export async function limitByIp(
  ip: string,
  points: number = 1,
  durationSec: number = 60
): Promise<void> {
  try {
    // Create a temporary limiter if custom duration is needed
    const limiter = durationSec === 60 ? ipLimiter : new RateLimiterMemory({
      keyGenerator: (key: string) => `ip:${key}`,
      points: 60,
      duration: durationSec,
    })

    await limiter.consume(ip, points)
  } catch (rejRes) {
    // Rate limit exceeded - create comprehensive response
    const rateLimitInfo = await getRateLimitInfo(ipLimiter, ip, rejRes)
    const headers = createRateLimitHeaders(rateLimitInfo)

    throw new Response(
      JSON.stringify({
        error: 'rate_limited',
        message: 'Too many requests from this IP address',
        retryAfter: rateLimitInfo.retryAfterSec
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }
    )
  }
}

/**
 * Rate limit by phone number (E.164 format)
 *
 * @param e164 - Phone number in E.164 format to rate limit
 * @param points - Number of points to consume (default: 1)
 * @param durationSec - Duration in seconds for the limit window
 * @throws Response with 429 status when rate limit exceeded
 */
export async function limitByPhone(
  e164: string,
  points: number = 1,
  durationSec: number = 300
): Promise<void> {
  try {
    // Create a temporary limiter if custom duration is needed
    const limiter = durationSec === 300 ? phoneLimiter : new RateLimiterMemory({
      keyGenerator: (key: string) => `phone:${key}`,
      points: 10,
      duration: durationSec,
    })

    await limiter.consume(e164, points)
  } catch (rejRes) {
    // Rate limit exceeded - create comprehensive response
    const rateLimitInfo = await getRateLimitInfo(phoneLimiter, e164, rejRes)
    const headers = createRateLimitHeaders(rateLimitInfo)

    throw new Response(
      JSON.stringify({
        error: 'rate_limited',
        message: 'Too many messages from this phone number',
        retryAfter: rateLimitInfo.retryAfterSec
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }
    )
  }
}

/**
 * Get client IP from request headers
 * Handles various proxy scenarios (Vercel, Cloudflare, etc.)
 */
export function getClientIp(req: Request): string {
  // Try various headers that might contain the real IP
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'x-vercel-forwarded-for', // Vercel
    'x-client-ip',
  ]

  for (const header of headers) {
    const value = req.headers.get(header)
    if (value) {
      // x-forwarded-for can be a comma-separated list, take the first one
      const ip = value.split(',')[0].trim()
      if (ip && ip !== '::1' && ip !== '127.0.0.1') {
        return ip
      }
    }
  }

  // Fallback to a default IP if none found
  return '127.0.0.1'
}

/**
 * Create rate limit headers for responses
 *
 * @param rateLimitInfo - Rate limit information
 * @returns Headers object with rate limit information
 */
export function createRateLimitHeaders(rateLimitInfo: RateLimitInfo): RateLimitHeaders {
  return {
    'X-RateLimit-Limit': String(rateLimitInfo.limit),
    'X-RateLimit-Remaining': String(rateLimitInfo.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rateLimitInfo.resetTime.getTime() / 1000)),
    'Retry-After': String(rateLimitInfo.retryAfterSec)
  }
}

/**
 * Apply rate limit headers to a Response
 *
 * @param response - Response to modify
 * @param rateLimitInfo - Rate limit information
 * @returns Modified response with rate limit headers
 */
export function applyRateLimitHeaders(response: Response, rateLimitInfo: RateLimitInfo): Response {
  const headers = createRateLimitHeaders(rateLimitInfo)

  // Create new response with existing body and status, but with additional headers
  const newHeaders = new Headers(response.headers)

  Object.entries(headers).forEach(([key, value]) => {
    newHeaders.set(key, value)
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  })
}

/**
 * Get rate limit information from rate limiter result
 *
 * @param limiter - The rate limiter instance
 * @param key - The key being limited
 * @param rejRes - Rate limiter rejection result (optional)
 * @returns Rate limit information
 */
export async function getRateLimitInfo(
  limiter: RateLimiterMemory,
  key: string,
  rejRes?: any
): Promise<RateLimitInfo> {
  const limit = limiter.points
  const now = new Date()

  if (rejRes) {
    // Rate limit exceeded
    return {
      limit,
      remaining: 0,
      resetTime: new Date(now.getTime() + rejRes.msBeforeNext),
      retryAfterSec: Math.ceil(rejRes.msBeforeNext / 1000)
    }
  } else {
    // Check current state
    const result = await limiter.get(key)
    const remaining = result ? Math.max(0, limit - result.totalHits) : limit
    const resetTime = result
      ? new Date(result.msBeforeNext + now.getTime())
      : new Date(now.getTime() + limiter.duration * 1000)

    return {
      limit,
      remaining,
      resetTime,
      retryAfterSec: 0
    }
  }
}