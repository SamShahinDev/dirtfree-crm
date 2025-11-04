import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { generateTokenPair } from '@/lib/auth/portal-tokens'
import { createPortalAuditLog } from '@/lib/audit/portal-audit'
import { z } from 'zod'

/**
 * Portal Authentication - Login
 *
 * POST /api/portal/auth/login
 * - Validates customer credentials
 * - Generates JWT access & refresh tokens
 * - Creates portal session
 * - Returns tokens + customer info
 * - Logs authentication event
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
 * Login request schema
 */
const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

/**
 * Extract IP address from request
 */
function getClientIP(request: NextRequest): string | undefined {
  // Try various headers in order of preference
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // Vercel-specific
  const vercelIp = request.headers.get('x-vercel-forwarded-for')
  if (vercelIp) {
    return vercelIp.split(',')[0].trim()
  }

  return undefined
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

/**
 * POST - Customer login
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Parse request body
    const body = await request.json()
    const validation = LoginSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_error',
        validation.error.errors.map(e => e.message).join(', '),
        400,
        corsHeaders
      )
    }

    const { email, password } = validation.data

    // Create Supabase client for authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      console.error('[Portal Auth] Login failed:', authError?.message)

      // Generic error message to prevent user enumeration
      return createErrorResponse(
        'authentication_failed',
        'Invalid email or password',
        401,
        corsHeaders
      )
    }

    // Look up customer by email
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, email, name, phone, status')
      .eq('email', email)
      .single()

    if (customerError || !customer) {
      console.error('[Portal Auth] Customer not found:', customerError?.message)
      return createErrorResponse(
        'customer_not_found',
        'Customer account not found. Please contact support.',
        404,
        corsHeaders
      )
    }

    // Check if customer account is active
    if (customer.status && customer.status !== 'active') {
      return createErrorResponse(
        'account_inactive',
        'Your account is not active. Please contact support.',
        403,
        corsHeaders
      )
    }

    // Extract request metadata
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || undefined

    // Generate JWT token pair
    const { tokens, sessionId } = await generateTokenPair({
      customerId: customer.id,
      email: customer.email || email,
      ipAddress,
      userAgent,
    })

    // Create audit log entry
    await createPortalAuditLog({
      actorId: authData.user.id,
      action: 'LOGIN',
      entity: 'customer',
      entityId: customer.id,
      meta: {
        action: 'portal_login',
        sessionId,
        ipAddress,
        userAgent,
      },
    }).catch(err => {
      console.error('[Portal Auth] Failed to create audit log:', err)
      // Don't fail the request if audit logging fails
    })

    // Return success response with tokens
    return createSuccessResponse(
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        refreshExpiresIn: tokens.refreshExpiresIn,
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
        },
        sessionId,
      },
      corsHeaders
    )

  } catch (error) {
    console.error('[Portal Auth] POST /api/portal/auth/login error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}
