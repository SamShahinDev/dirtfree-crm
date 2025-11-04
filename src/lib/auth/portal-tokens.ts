/**
 * Portal Token Management
 *
 * JWT-based authentication for customer portal.
 * Provides access tokens (7 days) and refresh tokens (30 days).
 * Integrates with portal_sessions table for session tracking.
 */

import * as jose from 'jose'
import { getServiceSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

/**
 * Token types
 */
export type TokenType = 'access' | 'refresh'

/**
 * JWT payload for portal tokens
 */
export interface PortalTokenPayload {
  sub: string // customer_id
  email: string
  type: TokenType
  sessionId: string
  iat?: number // issued at
  exp?: number // expires at
}

/**
 * Token pair (access + refresh)
 */
export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number // seconds until access token expires
  refreshExpiresIn: number // seconds until refresh token expires
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean
  payload?: PortalTokenPayload
  error?: string
  expired?: boolean
}

/**
 * Token expiry durations (in seconds)
 */
const TOKEN_EXPIRY = {
  access: 7 * 24 * 60 * 60, // 7 days
  refresh: 30 * 24 * 60 * 60, // 30 days
} as const

/**
 * Get JWT secret from environment
 */
function getJWTSecret(): Uint8Array {
  const secret = process.env.PORTAL_JWT_SECRET
  if (!secret) {
    throw new Error('PORTAL_JWT_SECRET environment variable is not set')
  }
  return new TextEncoder().encode(secret)
}

/**
 * Generate portal JWT token
 */
export async function generateToken(
  payload: Omit<PortalTokenPayload, 'iat' | 'exp' | 'type'>,
  type: TokenType
): Promise<string> {
  const secret = getJWTSecret()

  const expiresIn = type === 'access' ? TOKEN_EXPIRY.access : TOKEN_EXPIRY.refresh

  const token = await new jose.SignJWT({
    ...payload,
    type,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .setSubject(payload.sub)
    .sign(secret)

  return token
}

/**
 * Verify and decode portal JWT token
 */
export async function verifyToken(
  token: string,
  expectedType?: TokenType
): Promise<TokenValidationResult> {
  try {
    const secret = getJWTSecret()

    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    })

    const tokenPayload = payload as PortalTokenPayload

    // Verify token type if specified
    if (expectedType && tokenPayload.type !== expectedType) {
      return {
        valid: false,
        error: `Invalid token type. Expected ${expectedType}, got ${tokenPayload.type}`,
      }
    }

    return {
      valid: true,
      payload: tokenPayload,
    }
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return {
        valid: false,
        expired: true,
        error: 'Token has expired',
      }
    }

    if (error instanceof jose.errors.JWTInvalid) {
      return {
        valid: false,
        error: 'Invalid token signature or format',
      }
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token verification failed',
    }
  }
}

/**
 * Create SHA-256 hash of token for storage
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Generate access and refresh token pair
 */
export async function generateTokenPair(params: {
  customerId: string
  email: string
  ipAddress?: string
  userAgent?: string
}): Promise<{ tokens: TokenPair; sessionId: string }> {
  const { customerId, email, ipAddress, userAgent } = params

  // Create session in database
  const supabase = getServiceSupabase()

  const sessionId = crypto.randomUUID()

  const accessToken = await generateToken(
    {
      sub: customerId,
      email,
      sessionId,
    },
    'access'
  )

  const refreshToken = await generateToken(
    {
      sub: customerId,
      email,
      sessionId,
    },
    'refresh'
  )

  // Hash the access token for storage
  const tokenHash = await hashToken(accessToken)

  // Store session in database
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.access * 1000)

  const { error } = await supabase.from('portal_sessions').insert({
    id: sessionId,
    customer_id: customerId,
    token_hash: tokenHash,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error('[Portal Tokens] Failed to create session:', error)
    throw new Error('Failed to create portal session')
  }

  return {
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: TOKEN_EXPIRY.access,
      refreshExpiresIn: TOKEN_EXPIRY.refresh,
    },
    sessionId,
  }
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  // Verify refresh token
  const validation = await verifyToken(refreshToken, 'refresh')

  if (!validation.valid || !validation.payload) {
    throw new Error(validation.error || 'Invalid refresh token')
  }

  const { sub: customerId, email, sessionId } = validation.payload

  // Verify session exists and is valid
  const supabase = getServiceSupabase()

  const { data: session, error: sessionError } = await supabase
    .from('portal_sessions')
    .select('id, customer_id, expires_at')
    .eq('id', sessionId)
    .eq('customer_id', customerId)
    .single()

  if (sessionError || !session) {
    throw new Error('Session not found or invalid')
  }

  // Check if session is expired
  const now = new Date()
  const expiresAt = new Date(session.expires_at)

  if (expiresAt < now) {
    // Clean up expired session
    await supabase.from('portal_sessions').delete().eq('id', sessionId)
    throw new Error('Session has expired. Please log in again.')
  }

  // Generate new access token
  const newAccessToken = await generateToken(
    {
      sub: customerId,
      email,
      sessionId,
    },
    'access'
  )

  // Update session with new token hash
  const newTokenHash = await hashToken(newAccessToken)
  const newExpiresAt = new Date(Date.now() + TOKEN_EXPIRY.access * 1000)

  await supabase
    .from('portal_sessions')
    .update({
      token_hash: newTokenHash,
      expires_at: newExpiresAt.toISOString(),
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  // Return new token pair (same refresh token, new access token)
  return {
    accessToken: newAccessToken,
    refreshToken, // Keep same refresh token
    expiresIn: TOKEN_EXPIRY.access,
    refreshExpiresIn: TOKEN_EXPIRY.refresh,
  }
}

/**
 * Validate access token and return payload
 */
export async function validateAccessToken(
  token: string
): Promise<{ valid: boolean; payload?: PortalTokenPayload; error?: string }> {
  // Verify JWT
  const validation = await verifyToken(token, 'access')

  if (!validation.valid || !validation.payload) {
    return {
      valid: false,
      error: validation.error,
    }
  }

  const { sessionId, sub: customerId } = validation.payload

  // Verify session exists in database
  const supabase = getServiceSupabase()

  const tokenHash = await hashToken(token)

  const { data: session, error } = await supabase
    .from('portal_sessions')
    .select('id, expires_at')
    .eq('id', sessionId)
    .eq('customer_id', customerId)
    .eq('token_hash', tokenHash)
    .single()

  if (error || !session) {
    return {
      valid: false,
      error: 'Session not found or token mismatch',
    }
  }

  // Check expiration
  const now = new Date()
  const expiresAt = new Date(session.expires_at)

  if (expiresAt < now) {
    // Clean up expired session
    await supabase.from('portal_sessions').delete().eq('id', sessionId)

    return {
      valid: false,
      error: 'Session has expired',
    }
  }

  // Update last accessed
  await supabase
    .from('portal_sessions')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', sessionId)

  return {
    valid: true,
    payload: validation.payload,
  }
}

/**
 * Revoke session (logout)
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const supabase = getServiceSupabase()

  const { error } = await supabase
    .from('portal_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    console.error('[Portal Tokens] Failed to revoke session:', error)
    return false
  }

  return true
}

/**
 * Revoke all sessions for a customer
 */
export async function revokeAllSessions(customerId: string): Promise<number> {
  const supabase = getServiceSupabase()

  const { data: sessions, error: fetchError } = await supabase
    .from('portal_sessions')
    .select('id')
    .eq('customer_id', customerId)

  if (fetchError || !sessions) {
    console.error('[Portal Tokens] Failed to fetch sessions:', fetchError)
    return 0
  }

  const { error: deleteError } = await supabase
    .from('portal_sessions')
    .delete()
    .eq('customer_id', customerId)

  if (deleteError) {
    console.error('[Portal Tokens] Failed to revoke sessions:', deleteError)
    return 0
  }

  return sessions.length
}

/**
 * Get active sessions for a customer
 */
export async function getActiveSessions(customerId: string): Promise<
  Array<{
    id: string
    ipAddress: string | null
    userAgent: string | null
    createdAt: string
    lastAccessedAt: string
    expiresAt: string
  }>
> {
  const supabase = getServiceSupabase()

  const { data: sessions, error } = await supabase
    .from('portal_sessions')
    .select('id, ip_address, user_agent, created_at, last_accessed_at, expires_at')
    .eq('customer_id', customerId)
    .gt('expires_at', new Date().toISOString())
    .order('last_accessed_at', { ascending: false })

  if (error || !sessions) {
    console.error('[Portal Tokens] Failed to fetch active sessions:', error)
    return []
  }

  return sessions.map(s => ({
    id: s.id,
    ipAddress: s.ip_address,
    userAgent: s.user_agent,
    createdAt: s.created_at,
    lastAccessedAt: s.last_accessed_at,
    expiresAt: s.expires_at,
  }))
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = getServiceSupabase()

  const { data: expired, error: fetchError } = await supabase
    .from('portal_sessions')
    .select('id')
    .lt('expires_at', new Date().toISOString())

  if (fetchError || !expired) {
    console.error('[Portal Tokens] Failed to fetch expired sessions:', fetchError)
    return 0
  }

  if (expired.length === 0) {
    return 0
  }

  const { error: deleteError } = await supabase
    .from('portal_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())

  if (deleteError) {
    console.error('[Portal Tokens] Failed to delete expired sessions:', deleteError)
    return 0
  }

  return expired.length
}

/**
 * Decode token without verification (for debugging/logging)
 */
export function decodeTokenUnsafe(token: string): PortalTokenPayload | null {
  try {
    const decoded = jose.decodeJwt(token)
    return decoded as PortalTokenPayload
  } catch (error) {
    return null
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiry(type: TokenType): number {
  return TOKEN_EXPIRY[type]
}

/**
 * Check if token is close to expiring (within 1 hour)
 */
export function isTokenExpiringSoon(payload: PortalTokenPayload): boolean {
  if (!payload.exp) return false

  const now = Math.floor(Date.now() / 1000)
  const oneHour = 60 * 60
  const timeUntilExpiry = payload.exp - now

  return timeUntilExpiry < oneHour && timeUntilExpiry > 0
}
