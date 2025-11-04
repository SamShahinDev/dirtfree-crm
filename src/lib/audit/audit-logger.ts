/**
 * Security Audit Logging
 *
 * Comprehensive audit logging system for security events, compliance,
 * and forensic analysis.
 *
 * @module lib/audit/audit-logger
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Audit action types
 *
 * Categorized by domain for easier filtering and reporting.
 */
export type AuditAction =
  // Authentication & Authorization
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'session_expired'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'permission_denied'
  | 'role_escalation_attempt'

  // Customer Management
  | 'customer_created'
  | 'customer_updated'
  | 'customer_deleted'
  | 'customer_viewed'
  | 'customer_searched'
  | 'customer_merged'
  | 'customer_exported'

  // Opportunity Management
  | 'opportunity_created'
  | 'opportunity_updated'
  | 'opportunity_deleted'
  | 'opportunity_converted'
  | 'opportunity_lost'
  | 'opportunity_assigned'

  // Promotion Management
  | 'promotion_created'
  | 'promotion_updated'
  | 'promotion_deleted'
  | 'promotion_delivered'
  | 'promotion_redeemed'

  // Review & Feedback
  | 'review_submitted'
  | 'review_approved'
  | 'review_rejected'
  | 'feedback_received'

  // Loyalty & Rewards
  | 'loyalty_points_awarded'
  | 'loyalty_points_redeemed'
  | 'loyalty_tier_upgraded'
  | 'achievement_unlocked'

  // Referral Program
  | 'referral_created'
  | 'referral_completed'
  | 'referral_rewarded'

  // Settings & Configuration
  | 'settings_changed'
  | 'integration_configured'
  | 'notification_settings_changed'
  | 'api_key_created'
  | 'api_key_revoked'

  // User Management
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_role_changed'
  | 'user_permissions_changed'
  | 'user_suspended'
  | 'user_activated'

  // Data Access & Privacy
  | 'pii_accessed'
  | 'pii_exported'
  | 'pii_deleted'
  | 'data_exported'
  | 'report_generated'
  | 'encryption_key_rotated'

  // Security Events
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'unauthorized_access_attempt'
  | 'csrf_token_invalid'
  | 'webhook_signature_invalid'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'file_upload_rejected'

  // System Events
  | 'backup_created'
  | 'backup_restored'
  | 'migration_executed'
  | 'job_executed'
  | 'job_failed'
  | 'cron_executed'

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  /**
   * Type of action being logged
   */
  action: AuditAction

  /**
   * User who performed the action (if applicable)
   */
  userId?: string

  /**
   * Customer related to the action (if applicable)
   */
  customerId?: string

  /**
   * Type of resource affected
   */
  resourceType?: string

  /**
   * ID of the specific resource affected
   */
  resourceId?: string

  /**
   * Additional context and metadata
   */
  details?: Record<string, any>

  /**
   * IP address of the requester
   */
  ipAddress?: string

  /**
   * User agent string
   */
  userAgent?: string

  /**
   * Status of the action
   */
  status: 'success' | 'failure' | 'warning'

  /**
   * Severity level for alerting
   */
  severity: 'low' | 'medium' | 'high' | 'critical'

  /**
   * Optional error message for failures
   */
  errorMessage?: string

  /**
   * Duration of the operation in milliseconds
   */
  duration?: number
}

/**
 * Log an audit event
 *
 * @param entry - Audit log entry
 * @returns Promise resolving to log entry ID
 *
 * @example
 * ```typescript
 * await logAudit({
 *   action: 'customer_created',
 *   userId: user.id,
 *   resourceType: 'customer',
 *   resourceId: customer.id,
 *   status: 'success',
 *   severity: 'low',
 *   ipAddress: req.headers.get('x-forwarded-for')
 * })
 * ```
 */
export async function logAudit(entry: AuditLogEntry): Promise<string | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        action: entry.action,
        user_id: entry.userId,
        customer_id: entry.customerId,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        details: entry.details || {},
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        status: entry.status,
        severity: entry.severity,
        error_message: entry.errorMessage,
        duration_ms: entry.duration,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to log audit event:', error)
      // Don't throw - we don't want logging failures to break the app
      return null
    }

    // Alert on critical events
    if (entry.severity === 'critical') {
      await alertSecurityTeam(entry).catch((err) => {
        console.error('Failed to alert security team:', err)
      })
    }

    return data?.id || null
  } catch (error) {
    console.error('Error in logAudit:', error)
    return null
  }
}

/**
 * Log a successful action
 *
 * @param action - Audit action type
 * @param context - Additional context
 *
 * @example
 * ```typescript
 * await logSuccess('login', {
 *   userId: user.id,
 *   ipAddress: req.headers.get('x-forwarded-for'),
 *   userAgent: req.headers.get('user-agent')
 * })
 * ```
 */
export async function logSuccess(
  action: AuditAction,
  context: Partial<AuditLogEntry> = {}
): Promise<string | null> {
  return logAudit({
    ...context,
    action,
    status: 'success',
    severity: context.severity || 'low',
  } as AuditLogEntry)
}

/**
 * Log a failed action
 *
 * @param action - Audit action type
 * @param context - Additional context
 *
 * @example
 * ```typescript
 * await logFailure('permission_denied', {
 *   userId: user.id,
 *   resourceType: 'opportunity',
 *   resourceId: oppId,
 *   details: { attemptedAction: 'delete', userRole: user.role },
 *   severity: 'high',
 *   errorMessage: 'User lacks required permission'
 * })
 * ```
 */
export async function logFailure(
  action: AuditAction,
  context: Partial<AuditLogEntry> = {}
): Promise<string | null> {
  return logAudit({
    ...context,
    action,
    status: 'failure',
    severity: context.severity || 'medium',
  } as AuditLogEntry)
}

/**
 * Log suspicious activity
 *
 * Automatically sets severity to critical and status to warning.
 *
 * @param action - Audit action type
 * @param context - Additional context
 *
 * @example
 * ```typescript
 * await logSuspicious('suspicious_activity', {
 *   userId: user.id,
 *   details: {
 *     reason: 'Multiple failed login attempts',
 *     count: 5,
 *     timeWindow: '5 minutes'
 *   },
 *   ipAddress: req.headers.get('x-forwarded-for')
 * })
 * ```
 */
export async function logSuspicious(
  action: AuditAction,
  context: Partial<AuditLogEntry> = {}
): Promise<string | null> {
  return logAudit({
    ...context,
    action,
    status: 'warning',
    severity: 'critical',
  } as AuditLogEntry)
}

/**
 * Helper to extract request metadata
 *
 * @param req - Request object
 * @returns Object with IP and user agent
 */
export function getRequestMetadata(req: Request): {
  ipAddress: string | null
  userAgent: string | null
} {
  return {
    ipAddress:
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      null,
    userAgent: req.headers.get('user-agent'),
  }
}

/**
 * Middleware to automatically log API requests
 *
 * @param handler - Request handler
 * @param options - Logging options
 * @returns Wrapped handler
 *
 * @example
 * ```typescript
 * export const POST = withAuditLogging(
 *   async (req, { user }) => {
 *     // Handler code
 *     return NextResponse.json({ success: true })
 *   },
 *   {
 *     action: 'customer_created',
 *     resourceType: 'customer',
 *     getResourceId: (result) => result.data.id
 *   }
 * )
 * ```
 */
export interface WithAuditLoggingOptions {
  /**
   * Audit action to log
   */
  action: AuditAction

  /**
   * Resource type being acted upon
   */
  resourceType?: string

  /**
   * Function to extract resource ID from result
   */
  getResourceId?: (result: any) => string

  /**
   * Severity level (default: 'low')
   */
  severity?: 'low' | 'medium' | 'high' | 'critical'

  /**
   * Additional details to include
   */
  getDetails?: (req: Request, result: any) => Record<string, any>
}

export function withAuditLogging(
  handler: (req: Request, context: any) => Promise<Response>,
  options: WithAuditLoggingOptions
) {
  return async (req: Request, context: any): Promise<Response> => {
    const startTime = Date.now()
    const metadata = getRequestMetadata(req)

    try {
      // Execute handler
      const response = await handler(req, context)
      const duration = Date.now() - startTime

      // Parse response to get details
      let result: any = null
      try {
        const clonedResponse = response.clone()
        result = await clonedResponse.json()
      } catch {
        // Response is not JSON, skip
      }

      // Log success
      await logSuccess(options.action, {
        userId: context?.user?.id,
        resourceType: options.resourceType,
        resourceId: options.getResourceId?.(result),
        details: options.getDetails?.(req, result),
        severity: options.severity || 'low',
        duration,
        ...metadata,
      })

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      // Log failure
      await logFailure(options.action, {
        userId: context?.user?.id,
        resourceType: options.resourceType,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        severity: options.severity || 'medium',
        duration,
        ...metadata,
      })

      throw error
    }
  }
}

/**
 * Alert security team about critical event
 *
 * This is a placeholder - implement based on your alerting needs.
 */
async function alertSecurityTeam(entry: AuditLogEntry): Promise<void> {
  // Import dynamically to avoid circular dependencies
  const { sendSecurityAlert } = await import('@/lib/security/alerts')
  await sendSecurityAlert(entry)
}

/**
 * Get audit logs with filters
 *
 * @param filters - Filter options
 * @returns Promise resolving to audit logs
 */
export interface AuditLogFilters {
  userId?: string
  customerId?: string
  action?: AuditAction
  status?: 'success' | 'failure' | 'warning'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  startDate?: Date
  endDate?: Date
  limit?: number
}

export async function getAuditLogs(
  filters: AuditLogFilters = {}
): Promise<any[]> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('audit_logs')
      .select(
        `
        *,
        users:user_id (
          email,
          display_name
        ),
        customers:customer_id (
          name
        )
      `
      )
      .order('created_at', { ascending: false })

    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId)
    }

    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.severity) {
      query = query.eq('severity', filters.severity)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString())
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString())
    }

    if (filters.limit) {
      query = query.limit(filters.limit)
    } else {
      query = query.limit(100)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching audit logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return []
  }
}
