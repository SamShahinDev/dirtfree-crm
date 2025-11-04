import { NextRequest, NextResponse } from 'next/server'

import { limitByIp, getClientIp, createRateLimitHeaders, getRateLimitInfo } from '@/lib/rate-limit/limiter'
import { requireAdmin } from '@/lib/auth/guards'
import { RateLimiterMemory } from 'rate-limiter-flexible'

// Development-only rate limiter for testing
const testLimiter = new RateLimiterMemory({
  keyGenerator: (ip: string) => `test:${ip}`,
  points: 5, // Allow 5 requests
  duration: 60, // Per 60 seconds
})

export async function GET(request: NextRequest) {
  try {
    // Only allow in development or for admin users in production
    if (process.env.NODE_ENV === 'production') {
      try {
        await requireAdmin()
      } catch {
        return NextResponse.json(
          { error: 'Access denied - admin required in production' },
          { status: 403 }
        )
      }
    }

    const clientIp = getClientIp(request)

    try {
      // Try to consume from the test rate limiter
      await testLimiter.consume(clientIp, 1)

      // Get current rate limit status
      const result = await testLimiter.get(clientIp)
      const remaining = result ? Math.max(0, testLimiter.points - result.totalHits) : testLimiter.points

      const rateLimitInfo = {
        limit: testLimiter.points,
        remaining,
        resetTime: result
          ? new Date(Date.now() + result.msBeforeNext)
          : new Date(Date.now() + testLimiter.duration * 1000),
        retryAfterSec: 0
      }

      const headers = createRateLimitHeaders(rateLimitInfo)

      return NextResponse.json(
        {
          message: 'Rate limit test endpoint',
          status: 'success',
          clientIp: clientIp.replace(/\d+\.\d+\.\d+\./, 'xxx.xxx.xxx.'), // Partially mask IP for logs
          rateLimit: {
            limit: rateLimitInfo.limit,
            remaining: rateLimitInfo.remaining,
            resetTime: rateLimitInfo.resetTime.toISOString()
          },
          instructions: {
            purpose: 'This endpoint tests rate limiting and headers',
            usage: 'Make multiple requests to trigger 429 response',
            verification: 'Check for X-RateLimit-* and Retry-After headers',
            reset: 'Rate limit resets automatically after 60 seconds'
          }
        },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        }
      )

    } catch (rejRes) {
      // Rate limit exceeded
      const rateLimitInfo = {
        limit: testLimiter.points,
        remaining: 0,
        resetTime: new Date(Date.now() + rejRes.msBeforeNext),
        retryAfterSec: Math.ceil(rejRes.msBeforeNext / 1000)
      }

      const headers = createRateLimitHeaders(rateLimitInfo)

      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'Rate limit exceeded for testing endpoint',
          retryAfter: rateLimitInfo.retryAfterSec,
          rateLimit: {
            limit: rateLimitInfo.limit,
            remaining: rateLimitInfo.remaining,
            resetTime: rateLimitInfo.resetTime.toISOString()
          },
          instructions: {
            note: 'This is expected behavior for rate limit testing',
            nextStep: 'Wait for reset time or use different IP',
            headers: 'Check response headers for rate limit information'
          }
        },
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          }
        }
      )
    }

  } catch (error) {
    console.error('Rate limit test endpoint error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Same logic as GET but for POST requests
  return GET(request)
}

export async function DELETE(request: NextRequest) {
  try {
    // Only allow in development or for admin users in production
    if (process.env.NODE_ENV === 'production') {
      try {
        await requireAdmin()
      } catch {
        return NextResponse.json(
          { error: 'Access denied - admin required in production' },
          { status: 403 }
        )
      }
    }

    const clientIp = getClientIp(request)

    // Reset rate limit for the current IP (development helper)
    await testLimiter.delete(clientIp)

    return NextResponse.json(
      {
        message: 'Rate limit reset successfully',
        clientIp: clientIp.replace(/\d+\.\d+\.\d+\./, 'xxx.xxx.xxx.'), // Partially mask IP
        status: 'reset',
        note: 'You can now make requests again without waiting'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Rate limit reset error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}