import { NextRequest, NextResponse } from 'next/server'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken, type PortalAuthPayload } from '@/lib/portal-api'

/**
 * Portal API v1 - Customer-facing API
 *
 * This API serves as the bridge between the CRM and customer portal,
 * handling all customer-facing data requests.
 *
 * Features:
 * - API versioning (v1)
 * - Portal token authentication
 * - Distributed rate limiting via Upstash Redis (100 requests/minute per customer)
 * - CORS configuration for portal domain
 * - Standardized error handling
 */

// Get portal rate limiter instance (singleton)
const rateLimiter = getPortalRateLimiter()

// API version
const API_VERSION = 'v1'

/**
 * CORS configuration for portal domain
 * Reads allowed origins from ALLOWED_PORTAL_ORIGINS environment variable
 */
function getCorsHeaders(origin?: string | null): HeadersInit {
  // Read allowed origins from environment (comma-separated list)
  const envOrigins = process.env.ALLOWED_PORTAL_ORIGINS
    ? process.env.ALLOWED_PORTAL_ORIGINS.split(',').map(o => o.trim())
    : []

  const allowedOrigins = [
    ...envOrigins,
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    // Development origins
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null,
  ].filter(Boolean) as string[]

  const isAllowedOrigin = origin && allowedOrigins.includes(origin)

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : (allowedOrigins[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
}

/**
 * Standard error response format
 */
interface ErrorResponse {
  success: false
  error: string
  message: string
  code?: string
  details?: unknown
  version: string
}

/**
 * Standard success response format
 */
interface SuccessResponse<T = unknown> {
  success: true
  data: T
  version: string
  timestamp: string
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  error: string,
  message: string,
  status: number,
  options?: {
    code?: string
    details?: unknown
    headers?: HeadersInit
  }
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      message,
      code: options?.code,
      details: options?.details,
      version: API_VERSION,
    },
    {
      status,
      headers: options?.headers,
    }
  )
}

/**
 * Create standardized success response
 */
function createSuccessResponse<T>(
  data: T,
  options?: {
    status?: number
    headers?: HeadersInit
  }
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      version: API_VERSION,
      timestamp: new Date().toISOString(),
    },
    {
      status: options?.status || 200,
      headers: options?.headers,
    }
  )
}

/**
 * Authenticate portal request and apply rate limiting
 */
async function authenticatePortalRequest(
  request: NextRequest
): Promise<{ auth: PortalAuthPayload; customerId: string } | NextResponse> {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Extract portal token from header
  const portalToken = request.headers.get('X-Portal-Token') ||
                      request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!portalToken) {
    return createErrorResponse(
      'authentication_required',
      'Portal authentication token is required',
      401,
      {
        code: 'MISSING_TOKEN',
        headers: corsHeaders,
      }
    )
  }

  // Validate portal token
  let auth: PortalAuthPayload
  try {
    auth = await validatePortalToken(portalToken)
  } catch (error) {
    return createErrorResponse(
      'authentication_failed',
      error instanceof Error ? error.message : 'Invalid portal token',
      401,
      {
        code: 'INVALID_TOKEN',
        headers: corsHeaders,
      }
    )
  }

  const customerId = auth.customerId

  // Apply rate limiting per customer using distributed Redis rate limiter
  try {
    const rateLimitResult = await rateLimiter.limit(customerId)

    if (!rateLimitResult.success) {
      // Rate limit exceeded
      const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)

      return createErrorResponse(
        'rate_limit_exceeded',
        'Too many requests from this customer account',
        429,
        {
          code: 'RATE_LIMITED',
          details: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            retryAfter: rateLimitResult.retryAfter,
            resetTime: new Date(rateLimitResult.reset * 1000).toISOString(),
          },
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
          },
        }
      )
    }

    // Store rate limit info for use in response headers
    ;(request as any).__rateLimitInfo = rateLimitResult
  } catch (error) {
    // On rate limiter error, log and continue (fail open)
    console.error('[Portal API] Rate limiter error:', error)

    // Create default rate limit info
    const config = rateLimiter.getConfig()
    ;(request as any).__rateLimitInfo = {
      limit: config.requests,
      remaining: config.requests,
      reset: Math.floor(Date.now() / 1000) + config.window,
    }
  }

  return { auth, customerId }
}

/**
 * OPTIONS - Handle CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

/**
 * GET - Portal API info and health check
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // This endpoint doesn't require authentication - it's a health check
  const config = rateLimiter.getConfig()

  return createSuccessResponse(
    {
      name: 'Dirt Free Customer Portal API',
      version: API_VERSION,
      status: 'operational',
      redisAvailable: rateLimiter.isRedisAvailable(),
      endpoints: {
        auth: '/api/portal/auth',
        customer: '/api/portal/customer',
        jobs: '/api/portal/jobs',
        invoices: '/api/portal/invoices',
        loyalty: '/api/portal/loyalty',
        messages: '/api/portal/messages',
      },
      rateLimit: {
        requests: config.requests,
        window: `${config.window}s`,
        perCustomer: true,
      },
    },
    {
      headers: corsHeaders,
    }
  )
}

/**
 * POST - Example authenticated endpoint
 * (This is a placeholder - actual endpoints will be in subdirectories)
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Authenticate and rate limit
  const authResult = await authenticatePortalRequest(request)
  if (authResult instanceof NextResponse) {
    return authResult // Return error response
  }

  const { auth } = authResult
  const rateLimitInfo = (request as any).__rateLimitInfo
  const rateLimitHeaders = rateLimitInfo ? createRateLimitHeaders(rateLimitInfo) : {}

  // Example response
  return createSuccessResponse(
    {
      message: 'Portal API endpoint',
      customer: {
        id: auth.customerId,
        email: auth.email,
      },
    },
    {
      headers: {
        ...corsHeaders,
        ...rateLimitHeaders,
      },
    }
  )
}
