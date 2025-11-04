import { NextRequest, NextResponse } from 'next/server'
import { refreshAccessToken } from '@/lib/auth/portal-tokens'
import { z } from 'zod'

/**
 * Portal Authentication - Refresh Token
 *
 * POST /api/portal/auth/refresh
 * - Validates refresh token
 * - Generates new access token
 * - Returns new token pair
 */

const API_VERSION = 'v1'

/**
 * CORS headers
 */
function getCorsHeaders(origin?: string | null): HeadersInit {
  const envOrigins = process.env.ALLOWED_PORTAL_ORIGINS?.split(',').map(o => o.trim()) || []
  const allowedOrigins = [
    ...envOrigins,
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null,
  ].filter(Boolean) as string[]

  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error, message, version: API_VERSION }, { status, headers })
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, headers?: HeadersInit) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status: 200, headers }
  )
}

/**
 * Refresh request schema
 */
const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

/**
 * POST - Refresh access token
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Parse request body
    const body = await request.json()
    const validation = RefreshSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_error',
        validation.error.errors.map(e => e.message).join(', '),
        400,
        corsHeaders
      )
    }

    const { refreshToken } = validation.data

    // Refresh the access token
    const tokens = await refreshAccessToken(refreshToken)

    // Return new token pair
    return createSuccessResponse(
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        refreshExpiresIn: tokens.refreshExpiresIn,
      },
      corsHeaders
    )

  } catch (error) {
    console.error('[Portal Auth] POST /api/portal/auth/refresh error:', error)

    // Handle specific errors
    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh token'

    if (errorMessage.includes('expired') || errorMessage.includes('Session has expired')) {
      return createErrorResponse(
        'token_expired',
        'Your session has expired. Please log in again.',
        401,
        corsHeaders
      )
    }

    if (errorMessage.includes('not found') || errorMessage.includes('invalid')) {
      return createErrorResponse(
        'invalid_token',
        'Invalid refresh token. Please log in again.',
        401,
        corsHeaders
      )
    }

    return createErrorResponse(
      'server_error',
      'Failed to refresh access token',
      500,
      corsHeaders
    )
  }
}
