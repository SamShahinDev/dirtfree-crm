import { NextRequest, NextResponse } from 'next/server'
import { validateAccessToken, revokeSession, revokeAllSessions } from '@/lib/auth/portal-tokens'
import { createPortalAuditLog } from '@/lib/audit/portal-audit'
import { z } from 'zod'

/**
 * Portal Authentication - Logout
 *
 * POST /api/portal/auth/logout
 * - Validates access token
 * - Revokes session(s)
 * - Logs logout event
 * - Optionally revokes all sessions (logout everywhere)
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token',
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
 * Logout request schema
 */
const LogoutSchema = z.object({
  allSessions: z.boolean().optional().default(false),
})

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

/**
 * POST - Logout (revoke session)
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Extract access token
    const accessToken = request.headers.get('X-Portal-Token') ||
                        request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!accessToken) {
      return createErrorResponse(
        'authentication_required',
        'Access token required',
        401,
        corsHeaders
      )
    }

    // Validate access token
    const validation = await validateAccessToken(accessToken)

    if (!validation.valid || !validation.payload) {
      return createErrorResponse(
        'invalid_token',
        validation.error || 'Invalid access token',
        401,
        corsHeaders
      )
    }

    const { sessionId, sub: customerId, email } = validation.payload

    // Parse request body for options
    const body = await request.json().catch(() => ({}))
    const { allSessions } = LogoutSchema.parse(body)

    let revokedCount = 0

    if (allSessions) {
      // Revoke all sessions for this customer
      revokedCount = await revokeAllSessions(customerId)

      // Create audit log for logout all
      await createPortalAuditLog({
        actorId: customerId, // Using customerId as actorId since it's a customer action
        action: 'LOGOUT',
        entity: 'customer',
        entityId: customerId,
        meta: {
          action: 'portal_logout_all',
          sessionsRevoked: revokedCount,
        },
      }).catch(err => {
        console.error('[Portal Auth] Failed to create audit log:', err)
      })

    } else {
      // Revoke only the current session
      const success = await revokeSession(sessionId)
      revokedCount = success ? 1 : 0

      // Create audit log for logout
      await createPortalAuditLog({
        actorId: customerId,
        action: 'LOGOUT',
        entity: 'customer',
        entityId: customerId,
        meta: {
          action: 'portal_logout',
          sessionId,
        },
      }).catch(err => {
        console.error('[Portal Auth] Failed to create audit log:', err)
      })
    }

    return createSuccessResponse(
      {
        message: allSessions
          ? `Logged out from ${revokedCount} session${revokedCount !== 1 ? 's' : ''}`
          : 'Logged out successfully',
        sessionsRevoked: revokedCount,
      },
      corsHeaders
    )

  } catch (error) {
    console.error('[Portal Auth] POST /api/portal/auth/logout error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Failed to logout',
      500,
      corsHeaders
    )
  }
}
