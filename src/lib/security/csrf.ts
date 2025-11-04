/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * Provides CSRF token generation and verification to prevent
 * cross-site request forgery attacks.
 *
 * @module lib/security/csrf
 */

import { nanoid } from 'nanoid'
import crypto from 'crypto'

/**
 * CSRF token storage
 *
 * In production, you should use Redis or a database
 * for distributed systems.
 */
interface CsrfToken {
  token: string
  expiresAt: number
  sessionId: string
}

class CsrfTokenStore {
  private tokens: Map<string, CsrfToken> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired tokens every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, token] of this.tokens.entries()) {
      if (token.expiresAt < now) {
        this.tokens.delete(key)
      }
    }
  }

  set(sessionId: string, token: string, ttl: number = 3600000): void {
    this.tokens.set(sessionId, {
      token,
      sessionId,
      expiresAt: Date.now() + ttl,
    })
  }

  get(sessionId: string): string | undefined {
    const token = this.tokens.get(sessionId)
    if (!token) return undefined

    // Check if expired
    if (token.expiresAt < Date.now()) {
      this.tokens.delete(sessionId)
      return undefined
    }

    return token.token
  }

  delete(sessionId: string): void {
    this.tokens.delete(sessionId)
  }

  clear(): void {
    this.tokens.clear()
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.clear()
  }
}

// Singleton instance
const csrfTokenStore = new CsrfTokenStore()

/**
 * Generate a CSRF token for a session
 *
 * @param sessionId - The session ID to associate with the token
 * @param ttl - Time to live in milliseconds (default: 1 hour)
 * @returns The generated CSRF token
 *
 * @example
 * ```typescript
 * const sessionId = await getSessionId(req)
 * const csrfToken = generateCsrfToken(sessionId)
 *
 * // Return token to client
 * return NextResponse.json({ csrfToken })
 * ```
 */
export function generateCsrfToken(sessionId: string, ttl: number = 3600000): string {
  const token = nanoid(32)
  csrfTokenStore.set(sessionId, token, ttl)
  return token
}

/**
 * Verify a CSRF token
 *
 * @param sessionId - The session ID
 * @param token - The token to verify
 * @returns true if token is valid, false otherwise
 *
 * @example
 * ```typescript
 * const csrfToken = req.headers.get('x-csrf-token')
 * const sessionId = await getSessionId(req)
 *
 * if (!verifyCsrfToken(sessionId, csrfToken)) {
 *   return new Response('Invalid CSRF token', { status: 403 })
 * }
 * ```
 */
export function verifyCsrfToken(sessionId: string, token: string | null): boolean {
  if (!token) {
    return false
  }

  const expectedToken = csrfTokenStore.get(sessionId)
  if (!expectedToken) {
    return false
  }

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))
  } catch {
    return false
  }
}

/**
 * Invalidate a CSRF token
 *
 * @param sessionId - The session ID
 *
 * @example
 * ```typescript
 * // After logout or session end
 * invalidateCsrfToken(sessionId)
 * ```
 */
export function invalidateCsrfToken(sessionId: string): void {
  csrfTokenStore.delete(sessionId)
}

/**
 * Get session ID from request
 *
 * Extracts session ID from cookies or creates a new one.
 *
 * @param req - The request object
 * @returns The session ID
 */
export async function getSessionId(req: Request): Promise<string> {
  // Try to get from cookie
  const cookies = req.headers.get('cookie')
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/)
    if (match) {
      return match[1]
    }
  }

  // Try to get from Supabase auth
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      // Use token as session ID (or extract user ID from token)
      const hash = crypto.createHash('sha256').update(token).digest('hex')
      return hash
    }
  } catch {
    // Fall through to generate new session ID
  }

  // Generate new session ID
  return nanoid(32)
}

/**
 * Middleware to protect API routes from CSRF attacks
 *
 * @param handler - The request handler
 * @param options - CSRF protection options
 * @returns Wrapped handler with CSRF protection
 *
 * @example
 * ```typescript
 * export const POST = withCsrfProtection(
 *   async (req) => {
 *     // Request has valid CSRF token
 *     return NextResponse.json({ success: true })
 *   },
 *   {
 *     tokenHeader: 'x-csrf-token',
 *     errorMessage: 'Invalid CSRF token'
 *   }
 * )
 * ```
 */
export interface CsrfProtectionOptions {
  /**
   * The header name containing the CSRF token (default: 'x-csrf-token')
   */
  tokenHeader?: string

  /**
   * Custom error message
   */
  errorMessage?: string

  /**
   * Skip CSRF check for GET, HEAD, OPTIONS methods (default: true)
   */
  skipSafeMethods?: boolean
}

export function withCsrfProtection(
  handler: (req: Request) => Promise<Response> | Response,
  options: CsrfProtectionOptions = {}
) {
  return async (req: Request): Promise<Response> => {
    const {
      tokenHeader = 'x-csrf-token',
      errorMessage = 'Invalid CSRF token',
      skipSafeMethods = true,
    } = options

    // Skip CSRF check for safe methods
    if (skipSafeMethods && ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return await handler(req)
    }

    try {
      // Get CSRF token from header
      const csrfToken = req.headers.get(tokenHeader)

      if (!csrfToken) {
        return new Response(
          JSON.stringify({
            error: 'CSRF token required',
            message: 'Missing CSRF token in request headers',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Get session ID
      const sessionId = await getSessionId(req)

      // Verify token
      if (!verifyCsrfToken(sessionId, csrfToken)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid CSRF token',
            message: errorMessage,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Token is valid - call handler
      return await handler(req)
    } catch (error) {
      console.error('Error in CSRF protection:', error)
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
 * Generate a CSRF token endpoint handler
 *
 * @returns Handler that generates and returns a CSRF token
 *
 * @example
 * ```typescript
 * // In /api/csrf-token/route.ts
 * export const GET = createCsrfTokenEndpoint()
 *
 * // Client side:
 * const response = await fetch('/api/csrf-token')
 * const { csrfToken } = await response.json()
 * ```
 */
export function createCsrfTokenEndpoint() {
  return async (req: Request): Promise<Response> => {
    try {
      const sessionId = await getSessionId(req)
      const csrfToken = generateCsrfToken(sessionId)

      return new Response(
        JSON.stringify({
          csrfToken,
          expiresIn: 3600, // 1 hour in seconds
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      console.error('Error generating CSRF token:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate CSRF token' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
}

/**
 * Double submit cookie pattern for CSRF protection
 *
 * Alternative to synchronizer token pattern.
 *
 * @param handler - The request handler
 * @returns Wrapped handler
 *
 * @example
 * ```typescript
 * export const POST = withDoubleSubmitCookie(async (req) => {
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function withDoubleSubmitCookie(handler: (req: Request) => Promise<Response> | Response) {
  return async (req: Request): Promise<Response> => {
    // Skip for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return await handler(req)
    }

    try {
      // Get token from cookie
      const cookies = req.headers.get('cookie')
      const cookieMatch = cookies?.match(/csrf_token=([^;]+)/)
      const cookieToken = cookieMatch?.[1]

      // Get token from header
      const headerToken = req.headers.get('x-csrf-token')

      if (!cookieToken || !headerToken) {
        return new Response(
          JSON.stringify({
            error: 'CSRF token required',
            message: 'Missing CSRF token in cookie or header',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Verify they match
      try {
        const match = crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))

        if (!match) {
          return new Response(
            JSON.stringify({
              error: 'Invalid CSRF token',
              message: 'CSRF token mismatch',
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      } catch {
        return new Response(
          JSON.stringify({
            error: 'Invalid CSRF token',
            message: 'CSRF token mismatch',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // Tokens match - call handler
      return await handler(req)
    } catch (error) {
      console.error('Error in double submit cookie CSRF protection:', error)
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
 * Clear all CSRF tokens
 *
 * Use with caution - mainly for testing.
 */
export function clearAllCsrfTokens(): void {
  csrfTokenStore.clear()
}

/**
 * Export store for testing purposes
 */
export const __testing__ = {
  store: csrfTokenStore,
}
