/**
 * API Authentication Middleware
 *
 * Provides authentication and authorization middleware for API routes.
 * Integrates with Supabase Auth and the RBAC system.
 *
 * @module middleware/api-auth
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  Permission,
  Role,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getCurrentUser,
  type UserWithRole,
} from '@/lib/auth/rbac'

/**
 * Options for withAuth middleware
 */
export interface WithAuthOptions {
  /**
   * Single permission required to access the route
   */
  requirePermission?: Permission

  /**
   * Multiple permissions - user must have at least one
   */
  requireAnyPermission?: Permission[]

  /**
   * Multiple permissions - user must have all of them
   */
  requireAllPermissions?: Permission[]

  /**
   * Require admin role
   */
  requireAdmin?: boolean

  /**
   * Custom role check function
   */
  customRoleCheck?: (user: UserWithRole) => boolean

  /**
   * Enable audit logging for this route
   */
  enableAuditLog?: boolean

  /**
   * Custom error messages
   */
  errorMessages?: {
    unauthorized?: string
    forbidden?: string
  }
}

/**
 * Type for authenticated request handlers
 */
export type AuthenticatedHandler = (
  req: Request,
  context: { user: UserWithRole; params?: any }
) => Promise<Response> | Response

/**
 * Extended Request type with user context
 */
export interface AuthenticatedRequest extends Request {
  user: UserWithRole
}

/**
 * Main authentication middleware wrapper
 *
 * Wraps API route handlers with authentication and authorization checks.
 *
 * @example
 * ```typescript
 * export const POST = withAuth(
 *   async (req, { user }) => {
 *     // Handler with authenticated user
 *     return NextResponse.json({ userId: user.id })
 *   },
 *   { requirePermission: 'customers:write' }
 * )
 * ```
 *
 * @example Multiple permissions (any)
 * ```typescript
 * export const POST = withAuth(
 *   handler,
 *   {
 *     requireAnyPermission: ['opportunities:write', 'opportunities:approve']
 *   }
 * )
 * ```
 *
 * @example Multiple permissions (all)
 * ```typescript
 * export const POST = withAuth(
 *   handler,
 *   {
 *     requireAllPermissions: ['customers:read', 'analytics:view_all']
 *   }
 * )
 * ```
 */
export function withAuth(
  handler: AuthenticatedHandler,
  options: WithAuthOptions = {}
) {
  return async (req: Request, context?: { params?: any }) => {
    try {
      // Get authenticated user
      const user = await getCurrentUser()

      if (!user) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            message: options.errorMessages?.unauthorized || 'Authentication required',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Check admin requirement
      if (options.requireAdmin && user.role !== 'admin') {
        return new Response(
          JSON.stringify({
            error: 'Forbidden',
            message: 'Admin access required',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Check single permission
      if (options.requirePermission) {
        if (!hasPermission(user.role, options.requirePermission)) {
          return new Response(
            JSON.stringify({
              error: 'Forbidden',
              message:
                options.errorMessages?.forbidden ||
                `Permission required: ${options.requirePermission}`,
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      }

      // Check any permission
      if (options.requireAnyPermission && options.requireAnyPermission.length > 0) {
        if (!hasAnyPermission(user.role, options.requireAnyPermission)) {
          return new Response(
            JSON.stringify({
              error: 'Forbidden',
              message:
                options.errorMessages?.forbidden ||
                `One of these permissions required: ${options.requireAnyPermission.join(', ')}`,
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      }

      // Check all permissions
      if (options.requireAllPermissions && options.requireAllPermissions.length > 0) {
        if (!hasAllPermissions(user.role, options.requireAllPermissions)) {
          return new Response(
            JSON.stringify({
              error: 'Forbidden',
              message:
                options.errorMessages?.forbidden ||
                `All of these permissions required: ${options.requireAllPermissions.join(', ')}`,
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      }

      // Custom role check
      if (options.customRoleCheck && !options.customRoleCheck(user)) {
        return new Response(
          JSON.stringify({
            error: 'Forbidden',
            message: options.errorMessages?.forbidden || 'Access denied',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Audit logging if enabled
      if (options.enableAuditLog) {
        await logAuditEvent({
          userId: user.id,
          action: req.method,
          resource: new URL(req.url).pathname,
          timestamp: new Date(),
        })
      }

      // Call the handler with user context
      return await handler(req, { user, params: context?.params })
    } catch (error) {
      console.error('Error in withAuth middleware:', error)
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
}

/**
 * Simpler auth wrapper for routes that just need authentication (no specific permissions)
 *
 * @example
 * ```typescript
 * export const GET = requireAuth(async (req, { user }) => {
 *   return NextResponse.json({ user })
 * })
 * ```
 */
export function requireAuth(handler: AuthenticatedHandler) {
  return withAuth(handler, {})
}

/**
 * Auth wrapper that requires admin role
 *
 * @example
 * ```typescript
 * export const DELETE = requireAdmin(async (req, { user }) => {
 *   // Only admins can access this
 * })
 * ```
 */
export function requireAdminAuth(handler: AuthenticatedHandler) {
  return withAuth(handler, { requireAdmin: true })
}

/**
 * Get user from request (helper for non-route contexts)
 *
 * Returns null if user is not authenticated.
 */
export async function getUserFromRequest(req: Request): Promise<UserWithRole | null> {
  try {
    return await getCurrentUser()
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}

/**
 * Check if request is from authenticated user
 */
export async function isAuthenticated(req: Request): Promise<boolean> {
  const user = await getUserFromRequest(req)
  return user !== null
}

/**
 * Check if authenticated user has specific permission
 */
export async function requestHasPermission(
  req: Request,
  permission: Permission
): Promise<boolean> {
  const user = await getUserFromRequest(req)
  if (!user) return false
  return hasPermission(user.role, permission)
}

/**
 * Check if authenticated user has any of the specified permissions
 */
export async function requestHasAnyPermission(
  req: Request,
  permissions: Permission[]
): Promise<boolean> {
  const user = await getUserFromRequest(req)
  if (!user) return false
  return hasAnyPermission(user.role, permissions)
}

/**
 * Check if authenticated user has all of the specified permissions
 */
export async function requestHasAllPermissions(
  req: Request,
  permissions: Permission[]
): Promise<boolean> {
  const user = await getUserFromRequest(req)
  if (!user) return false
  return hasAllPermissions(user.role, permissions)
}

/**
 * Get user role from request
 */
export async function getUserRole(req: Request): Promise<Role | null> {
  const user = await getUserFromRequest(req)
  return user?.role || null
}

/**
 * Audit log interface
 */
interface AuditLogEvent {
  userId: string
  action: string
  resource: string
  timestamp: Date
  metadata?: Record<string, any>
}

/**
 * Log audit event to database
 *
 * This is a placeholder - implement based on your audit log requirements
 */
async function logAuditEvent(event: AuditLogEvent): Promise<void> {
  try {
    const supabase = await createClient()

    // Check if audit_logs table exists before attempting to insert
    const { error } = await supabase.from('audit_logs').insert({
      user_id: event.userId,
      action: event.action,
      resource: event.resource,
      timestamp: event.timestamp.toISOString(),
      metadata: event.metadata || {},
    })

    if (error) {
      // Log error but don't throw - audit logging should not break the request
      console.error('Error logging audit event:', error)
    }
  } catch (error) {
    console.error('Error in logAuditEvent:', error)
  }
}

/**
 * Create JSON error response
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  details?: any
): Response {
  return new Response(
    JSON.stringify({
      error: true,
      message,
      ...(details && { details }),
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Create JSON success response
 */
export function createSuccessResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Middleware for API routes that validates CRON_SECRET
 *
 * Use this for cron job endpoints that should only be called by Vercel Cron
 *
 * @example
 * ```typescript
 * export const POST = withCronAuth(async (req) => {
 *   // Process cron job
 * })
 * ```
 */
export function withCronAuth(handler: (req: Request) => Promise<Response> | Response) {
  return async (req: Request) => {
    try {
      const authHeader = req.headers.get('authorization')
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return createErrorResponse('Unauthorized', 401)
      }

      return await handler(req)
    } catch (error) {
      console.error('Error in withCronAuth:', error)
      return createErrorResponse(
        error instanceof Error ? error.message : 'Unknown error',
        500
      )
    }
  }
}

/**
 * Rate limiting helper (placeholder)
 *
 * Implement based on your rate limiting strategy (e.g., Redis, Upstash)
 */
export async function checkRateLimit(
  userId: string,
  resource: string,
  limit: number = 100
): Promise<{ allowed: boolean; remaining: number }> {
  // TODO: Implement rate limiting logic
  // This is a placeholder that always allows requests
  return { allowed: true, remaining: limit }
}

/**
 * Middleware with rate limiting
 *
 * @example
 * ```typescript
 * export const POST = withRateLimit(
 *   handler,
 *   { requirePermission: 'customers:write', rateLimit: 50 }
 * )
 * ```
 */
export function withRateLimit(
  handler: AuthenticatedHandler,
  options: WithAuthOptions & { rateLimit?: number } = {}
) {
  return withAuth(async (req, context) => {
    const { user } = context

    // Check rate limit
    const rateLimit = options.rateLimit || 100
    const { allowed, remaining } = await checkRateLimit(
      user.id,
      new URL(req.url).pathname,
      rateLimit
    )

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': remaining.toString(),
          },
        }
      )
    }

    // Add rate limit headers to response
    const response = await handler(req, context)

    // Clone response to add headers
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('X-RateLimit-Remaining', remaining.toString())

    return newResponse
  }, options)
}
