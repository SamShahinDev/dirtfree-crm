/**
 * Customer Portal API Utilities
 *
 * This module provides utilities for the customer portal API, including:
 * - Token validation for portal sessions
 * - API client for portal requests
 * - Request/response typing
 * - Error parsing and handling
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Portal authentication payload
 * Contains customer information extracted from validated portal token
 */
export interface PortalAuthPayload {
  customerId: string
  email: string
  userId: string // Supabase auth user ID
  sessionId?: string
  expiresAt?: number
}

/**
 * Portal API error types
 */
export type PortalErrorCode =
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN'
  | 'MISSING_TOKEN'
  | 'CUSTOMER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'

/**
 * Portal API error class
 */
export class PortalAPIError extends Error {
  constructor(
    public code: PortalErrorCode,
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'PortalAPIError'
  }
}

/**
 * Create SHA-256 hash of token for secure storage
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Validate portal session token
 *
 * Validates a portal session token and checks the portal_sessions table.
 * The token should be a valid Supabase JWT from a customer's session.
 *
 * @param token - Portal session token (Supabase JWT)
 * @returns Portal authentication payload with customer information
 * @throws PortalAPIError if token is invalid or customer not found
 */
export async function validatePortalToken(token: string): Promise<PortalAuthPayload> {
  if (!token || token.trim() === '') {
    throw new PortalAPIError('MISSING_TOKEN', 'Portal token is required', 401)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new PortalAPIError(
      'SERVER_ERROR',
      'Supabase configuration is missing',
      500
    )
  }

  // Create a Supabase client to validate the token
  const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

  try {
    // Validate the token by getting the user
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new PortalAPIError(
        'INVALID_TOKEN',
        error?.message || 'Invalid portal session token',
        401
      )
    }

    // Extract email
    const email = user.email
    if (!email) {
      throw new PortalAPIError(
        'INVALID_TOKEN',
        'Token does not contain customer email',
        401
      )
    }

    // Look up customer by email
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, email, name')
      .eq('email', email)
      .single()

    if (customerError || !customer) {
      throw new PortalAPIError(
        'CUSTOMER_NOT_FOUND',
        'Customer account not found',
        404,
        { email }
      )
    }

    // Create hash of token for session lookup
    const tokenHash = await hashToken(token)

    // Look up session in portal_sessions table
    const { data: session, error: sessionError } = await supabase
      .from('portal_sessions')
      .select('id, expires_at, last_accessed_at')
      .eq('token_hash', tokenHash)
      .eq('customer_id', customer.id)
      .single()

    if (sessionError || !session) {
      throw new PortalAPIError(
        'INVALID_TOKEN',
        'Session not found or invalid',
        401
      )
    }

    // Check if session is expired
    const now = new Date()
    const expiresAt = new Date(session.expires_at)

    if (expiresAt < now) {
      // Session expired - clean it up
      await supabase
        .from('portal_sessions')
        .delete()
        .eq('id', session.id)

      throw new PortalAPIError('EXPIRED_TOKEN', 'Portal session has expired', 401)
    }

    // Update last_accessed_at timestamp
    await supabase
      .from('portal_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', session.id)

    // Return validated auth payload
    return {
      customerId: customer.id,
      email: customer.email || email,
      userId: user.id,
      sessionId: session.id,
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
    }
  } catch (error) {
    if (error instanceof PortalAPIError) {
      throw error
    }

    // Handle unexpected errors
    throw new PortalAPIError(
      'SERVER_ERROR',
      error instanceof Error ? error.message : 'Failed to validate portal token',
      500,
      error
    )
  }
}

/**
 * Portal API request options
 */
export interface PortalRequestOptions {
  token: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: HeadersInit
}

/**
 * Portal API response
 */
export interface PortalResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
  version?: string
  timestamp?: string
}

/**
 * Make authenticated request to portal API
 *
 * @param endpoint - API endpoint (e.g., '/api/portal/customer')
 * @param options - Request options including token
 * @returns Parsed response data
 * @throws PortalAPIError on request failure
 */
export async function portalRequest<T = unknown>(
  endpoint: string,
  options: PortalRequestOptions
): Promise<T> {
  const { token, method = 'GET', body, headers = {} } = options

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const url = `${baseUrl}${endpoint}`

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Portal-Token': token,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data: PortalResponse<T> = await response.json()

    // Handle error responses
    if (!response.ok || !data.success) {
      const errorCode = (data.code as PortalErrorCode) || 'SERVER_ERROR'
      const errorMessage = data.message || data.error || 'Request failed'

      throw new PortalAPIError(errorCode, errorMessage, response.status, data)
    }

    // Return the data payload
    return data.data as T
  } catch (error) {
    if (error instanceof PortalAPIError) {
      throw error
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new PortalAPIError(
        'NETWORK_ERROR',
        'Network request failed. Please check your connection.',
        0,
        error
      )
    }

    // Handle unexpected errors
    throw new PortalAPIError(
      'SERVER_ERROR',
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500,
      error
    )
  }
}

/**
 * Parse portal API error
 *
 * Extracts a user-friendly error message from various error types
 *
 * @param error - Error object
 * @returns User-friendly error message
 */
export function parsePortalError(error: unknown): string {
  if (error instanceof PortalAPIError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error
    }
  }

  return 'An unexpected error occurred'
}

/**
 * Check if error is a portal API error
 */
export function isPortalAPIError(error: unknown): error is PortalAPIError {
  return error instanceof PortalAPIError
}

/**
 * Check if error is a specific portal error code
 */
export function isPortalErrorCode(error: unknown, code: PortalErrorCode): boolean {
  return isPortalAPIError(error) && error.code === code
}

/**
 * Get user-friendly error message for portal error codes
 */
export function getPortalErrorMessage(code: PortalErrorCode): string {
  const messages: Record<PortalErrorCode, string> = {
    INVALID_TOKEN: 'Your session is invalid. Please log in again.',
    EXPIRED_TOKEN: 'Your session has expired. Please log in again.',
    MISSING_TOKEN: 'Authentication required. Please log in.',
    CUSTOMER_NOT_FOUND: 'Customer account not found.',
    RATE_LIMITED: 'Too many requests. Please try again later.',
    UNAUTHORIZED: 'You do not have permission to access this resource.',
    VALIDATION_ERROR: 'Invalid request data. Please check your input.',
    SERVER_ERROR: 'A server error occurred. Please try again later.',
    NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  }

  return messages[code] || 'An unexpected error occurred'
}

/**
 * Portal API client
 *
 * Provides typed methods for common portal API operations
 */
export class PortalAPIClient {
  constructor(private token: string) {}

  /**
   * Update authentication token
   */
  setToken(token: string): void {
    this.token = token
  }

  /**
   * Make GET request
   */
  async get<T = unknown>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return portalRequest<T>(endpoint, {
      token: this.token,
      method: 'GET',
      headers,
    })
  }

  /**
   * Make POST request
   */
  async post<T = unknown>(endpoint: string, body?: unknown, headers?: HeadersInit): Promise<T> {
    return portalRequest<T>(endpoint, {
      token: this.token,
      method: 'POST',
      body,
      headers,
    })
  }

  /**
   * Make PUT request
   */
  async put<T = unknown>(endpoint: string, body?: unknown, headers?: HeadersInit): Promise<T> {
    return portalRequest<T>(endpoint, {
      token: this.token,
      method: 'PUT',
      body,
      headers,
    })
  }

  /**
   * Make DELETE request
   */
  async delete<T = unknown>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return portalRequest<T>(endpoint, {
      token: this.token,
      method: 'DELETE',
      headers,
    })
  }

  /**
   * Validate current token
   */
  async validateToken(): Promise<PortalAuthPayload> {
    return validatePortalToken(this.token)
  }
}

/**
 * Create a new portal API client instance
 */
export function createPortalClient(token: string): PortalAPIClient {
  return new PortalAPIClient(token)
}
