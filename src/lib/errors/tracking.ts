/**
 * Error Tracking Utilities
 *
 * Comprehensive error tracking with Sentry integration.
 *
 * @module lib/errors/tracking
 */

import * as Sentry from '@sentry/nextjs'

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
    Object.setPrototypeOf(this, AppError.prototype)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack,
    }
  }
}

/**
 * Severity levels for error tracking
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Error context for tracking
 */
export interface ErrorContext {
  /**
   * User ID associated with the error
   */
  userId?: string

  /**
   * Customer ID associated with the error
   */
  customerId?: string

  /**
   * Action being performed when error occurred
   */
  action?: string

  /**
   * Severity level of the error
   */
  severity?: ErrorSeverity

  /**
   * Additional context data
   */
  extra?: Record<string, any>

  /**
   * Tags for categorization
   */
  tags?: Record<string, string>

  /**
   * Fingerprint for grouping similar errors
   */
  fingerprint?: string[]
}

/**
 * Capture an error with Sentry
 *
 * @param error - Error to capture
 * @param context - Additional context
 * @returns Event ID from Sentry
 *
 * @example
 * ```typescript
 * try {
 *   await processOpportunity(opportunityId)
 * } catch (error) {
 *   captureError(error as Error, {
 *     userId: user.id,
 *     action: 'process_opportunity',
 *     severity: 'high',
 *   })
 *   throw error
 * }
 * ```
 */
export function captureError(
  error: Error | AppError,
  context?: ErrorContext
): string {
  return Sentry.withScope((scope) => {
    // Set severity
    if (context?.severity) {
      const sentryLevel =
        context.severity === 'critical'
          ? 'fatal'
          : context.severity === 'high'
          ? 'error'
          : context.severity === 'medium'
          ? 'warning'
          : 'info'
      scope.setLevel(sentryLevel)
    }

    // Add user context
    if (context?.userId) {
      scope.setUser({ id: context.userId })
    }

    // Add custom tags
    if (context?.customerId) {
      scope.setTag('customer_id', context.customerId)
    }

    if (context?.action) {
      scope.setTag('action', context.action)
    }

    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value)
      })
    }

    // Add error context if AppError
    if (error instanceof AppError) {
      scope.setContext('app_error', {
        code: error.code,
        statusCode: error.statusCode,
        context: error.context,
      })

      scope.setTag('error_code', error.code)
      scope.setTag('status_code', error.statusCode.toString())

      if (error.context) {
        scope.setContext('error_context', error.context)
      }
    }

    // Add extra context
    if (context?.extra) {
      scope.setContext('additional_context', context.extra)
    }

    // Set fingerprint for grouping
    if (context?.fingerprint) {
      scope.setFingerprint(context.fingerprint)
    } else if (error instanceof AppError) {
      // Group AppErrors by code
      scope.setFingerprint([error.code, error.message])
    }

    const eventId = Sentry.captureException(error)

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured:', {
        error,
        context,
        eventId,
      })
    }

    return eventId
  })
}

/**
 * Capture a message with Sentry
 *
 * @param message - Message to capture
 * @param level - Severity level
 * @param context - Additional context
 *
 * @example
 * ```typescript
 * captureMessage('User completed onboarding', 'info', {
 *   userId: user.id,
 *   extra: { source: 'web_app' }
 * })
 * ```
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Omit<ErrorContext, 'severity'>
): string {
  return Sentry.withScope((scope) => {
    // Add user context
    if (context?.userId) {
      scope.setUser({ id: context.userId })
    }

    // Add tags
    if (context?.customerId) {
      scope.setTag('customer_id', context.customerId)
    }

    if (context?.action) {
      scope.setTag('action', context.action)
    }

    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value)
      })
    }

    // Add extra context
    if (context?.extra) {
      scope.setContext('message_context', context.extra)
    }

    const eventId = Sentry.captureMessage(message, level)

    if (process.env.NODE_ENV === 'development') {
      console.log('Message captured:', {
        message,
        level,
        context,
        eventId,
      })
    }

    return eventId
  })
}

/**
 * Set user context for Sentry
 *
 * @param user - User information
 *
 * @example
 * ```typescript
 * setUser({
 *   id: user.id,
 *   email: user.email,
 *   username: user.name,
 * })
 * ```
 */
export function setUser(user: {
  id: string
  email?: string
  username?: string
  [key: string]: any
}): void {
  Sentry.setUser(user)
}

/**
 * Clear user context from Sentry
 */
export function clearUser(): void {
  Sentry.setUser(null)
}

/**
 * Add breadcrumb for debugging
 *
 * @param message - Breadcrumb message
 * @param category - Category for filtering
 * @param level - Severity level
 * @param data - Additional data
 *
 * @example
 * ```typescript
 * addBreadcrumb('User clicked submit button', 'user.action', 'info', {
 *   formId: 'customer-form',
 *   buttonText: 'Submit'
 * })
 * ```
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Wrap an async function with error tracking
 *
 * @param fn - Function to wrap
 * @param context - Error context
 * @returns Wrapped function
 *
 * @example
 * ```typescript
 * const processWithTracking = withErrorTracking(
 *   processOpportunity,
 *   { action: 'process_opportunity', severity: 'high' }
 * )
 *
 * await processWithTracking(opportunityId)
 * ```
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args)
    } catch (error) {
      captureError(error as Error, context)
      throw error
    }
  }) as T
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: 'auth.invalid_credentials',
  AUTH_SESSION_EXPIRED: 'auth.session_expired',
  AUTH_UNAUTHORIZED: 'auth.unauthorized',
  AUTH_FORBIDDEN: 'auth.forbidden',

  // Validation errors
  VALIDATION_FAILED: 'validation.failed',
  VALIDATION_INVALID_INPUT: 'validation.invalid_input',
  VALIDATION_MISSING_FIELD: 'validation.missing_field',

  // Database errors
  DB_QUERY_FAILED: 'db.query_failed',
  DB_CONNECTION_FAILED: 'db.connection_failed',
  DB_CONSTRAINT_VIOLATION: 'db.constraint_violation',
  DB_NOT_FOUND: 'db.not_found',

  // Business logic errors
  BUSINESS_INVALID_STATE: 'business.invalid_state',
  BUSINESS_DUPLICATE: 'business.duplicate',
  BUSINESS_CONFLICT: 'business.conflict',

  // External service errors
  EXTERNAL_SERVICE_ERROR: 'external.service_error',
  EXTERNAL_TIMEOUT: 'external.timeout',
  EXTERNAL_RATE_LIMIT: 'external.rate_limit',

  // System errors
  SYSTEM_ERROR: 'system.error',
  SYSTEM_UNAVAILABLE: 'system.unavailable',
} as const

/**
 * Create a new AppError
 *
 * @param code - Error code
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @param context - Additional context
 * @returns AppError instance
 *
 * @example
 * ```typescript
 * throw createError(
 *   ErrorCodes.DB_NOT_FOUND,
 *   'Customer not found',
 *   404,
 *   { customerId }
 * )
 * ```
 */
export function createError(
  code: string,
  message: string,
  statusCode: number = 500,
  context?: Record<string, any>
): AppError {
  return new AppError(message, code, statusCode, context)
}

/**
 * Check if error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError
}

/**
 * Handle error and return appropriate response
 *
 * @param error - Error to handle
 * @returns Error response object
 *
 * @example
 * ```typescript
 * try {
 *   await processData()
 * } catch (error) {
 *   return NextResponse.json(
 *     handleError(error),
 *     { status: error.statusCode || 500 }
 *   )
 * }
 * ```
 */
export function handleError(error: any): {
  error: string
  code?: string
  statusCode: number
  details?: any
} {
  if (isAppError(error)) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: process.env.NODE_ENV === 'development' ? error.context : undefined,
    }
  }

  // Unknown error
  const statusCode = error.statusCode || error.status || 500
  return {
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    statusCode,
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  }
}
