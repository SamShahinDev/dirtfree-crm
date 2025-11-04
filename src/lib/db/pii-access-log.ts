/**
 * PII Access Logging
 *
 * Logs all access to Personally Identifiable Information (PII)
 * for compliance and audit purposes.
 *
 * @module lib/db/pii-access-log
 */

import { createClient } from '@/lib/supabase/server'

/**
 * PII access action types
 */
export type PiiAccessAction = 'view' | 'edit' | 'export' | 'delete' | 'create'

/**
 * PII field types that can be accessed
 */
export type PiiFieldType =
  | 'phone'
  | 'email'
  | 'address'
  | 'ssn'
  | 'credit_card'
  | 'payment_method'
  | 'notes'
  | 'full_profile'
  | 'custom'

/**
 * Parameters for logging PII access
 */
export interface LogPiiAccessParams {
  /**
   * ID of user accessing the PII
   */
  userId: string

  /**
   * ID of customer whose PII is being accessed
   */
  customerId: string

  /**
   * Field(s) being accessed
   */
  fieldAccessed: string | string[]

  /**
   * Type of access action
   */
  action: PiiAccessAction

  /**
   * IP address of the accessor
   */
  ipAddress: string | null

  /**
   * User agent of the accessor
   */
  userAgent: string | null

  /**
   * Optional additional context
   */
  metadata?: Record<string, any>

  /**
   * Optional reason for access (for high-sensitivity fields)
   */
  accessReason?: string
}

/**
 * Log PII access to database
 *
 * This creates an immutable audit trail of all PII access.
 *
 * @param params - Access log parameters
 * @returns Promise resolving to log entry ID
 *
 * @example
 * ```typescript
 * await logPiiAccess({
 *   userId: user.id,
 *   customerId: '123',
 *   fieldAccessed: ['phone', 'email'],
 *   action: 'view',
 *   ipAddress: req.headers.get('x-forwarded-for'),
 *   userAgent: req.headers.get('user-agent')
 * })
 * ```
 */
export async function logPiiAccess(params: LogPiiAccessParams): Promise<string> {
  try {
    const supabase = await createClient()

    // Convert array of fields to comma-separated string
    const fieldAccessed = Array.isArray(params.fieldAccessed)
      ? params.fieldAccessed.join(', ')
      : params.fieldAccessed

    const { data, error } = await supabase
      .from('pii_access_log')
      .insert({
        user_id: params.userId,
        customer_id: params.customerId,
        field_accessed: fieldAccessed,
        action: params.action,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        metadata: params.metadata || {},
        access_reason: params.accessReason,
        accessed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error logging PII access:', error)
      // Don't throw - we don't want logging failures to break the app
      // But we should alert monitoring
      return ''
    }

    return data.id
  } catch (error) {
    console.error('Failed to log PII access:', error)
    return ''
  }
}

/**
 * Get PII access logs for a customer
 *
 * @param customerId - Customer ID
 * @param limit - Maximum number of logs to return
 * @returns Promise resolving to access logs
 *
 * @example
 * ```typescript
 * const logs = await getPiiAccessLogs('customer-id', 50)
 * ```
 */
export async function getPiiAccessLogs(
  customerId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('pii_access_log')
      .select(
        `
        *,
        users:user_id (
          email,
          display_name
        )
      `
      )
      .eq('customer_id', customerId)
      .order('accessed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching PII access logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Failed to fetch PII access logs:', error)
    return []
  }
}

/**
 * Get PII access logs for a user
 *
 * @param userId - User ID
 * @param limit - Maximum number of logs to return
 * @returns Promise resolving to access logs
 *
 * @example
 * ```typescript
 * const logs = await getPiiAccessLogsByUser('user-id')
 * ```
 */
export async function getPiiAccessLogsByUser(
  userId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('pii_access_log')
      .select(
        `
        *,
        customers:customer_id (
          name
        )
      `
      )
      .eq('user_id', userId)
      .order('accessed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching user PII access logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Failed to fetch user PII access logs:', error)
    return []
  }
}

/**
 * Get recent PII access logs (for monitoring)
 *
 * @param limit - Number of logs to return
 * @returns Promise resolving to recent logs
 */
export async function getRecentPiiAccessLogs(limit: number = 50): Promise<any[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('pii_access_log')
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
      .order('accessed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent PII access logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Failed to fetch recent PII access logs:', error)
    return []
  }
}

/**
 * Get suspicious PII access patterns
 *
 * Detects unusual access patterns like:
 * - Multiple rapid accesses
 * - Access at unusual hours
 * - Bulk exports
 *
 * @param hours - Time window in hours (default: 24)
 * @returns Promise resolving to suspicious activity
 */
export async function getSuspiciousPiiAccess(hours: number = 24): Promise<any[]> {
  try {
    const supabase = await createClient()

    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // Get users with high access counts
    const { data, error } = await supabase.rpc('get_suspicious_pii_access', {
      since_date: sinceDate,
      min_access_count: 50, // Flag if > 50 accesses in time window
    })

    if (error) {
      console.error('Error fetching suspicious PII access:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Failed to fetch suspicious PII access:', error)
    return []
  }
}

/**
 * Middleware wrapper for automatic PII access logging
 *
 * Automatically logs PII access when specific fields are accessed.
 *
 * @param handler - Request handler
 * @param options - Logging options
 * @returns Wrapped handler
 *
 * @example
 * ```typescript
 * export const GET = withPiiLogging(
 *   async (req, { user, params }) => {
 *     const customer = await getCustomer(params.id)
 *     return NextResponse.json(customer)
 *   },
 *   {
 *     fields: ['phone', 'email', 'address'],
 *     action: 'view',
 *     getCustomerId: (req, params) => params.id
 *   }
 * )
 * ```
 */
export interface WithPiiLoggingOptions {
  /**
   * PII fields being accessed
   */
  fields: string[]

  /**
   * Type of access action
   */
  action: PiiAccessAction

  /**
   * Function to extract customer ID from request
   */
  getCustomerId: (req: Request, params?: any) => string | Promise<string>

  /**
   * Optional access reason
   */
  accessReason?: string
}

export function withPiiLogging(
  handler: (req: Request, context: any) => Promise<Response> | Response,
  options: WithPiiLoggingOptions
) {
  return async (req: Request, context: any): Promise<Response> => {
    try {
      // Get customer ID
      const customerId = await options.getCustomerId(req, context?.params)

      // Get IP and user agent
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      const userAgent = req.headers.get('user-agent')

      // Log PII access (don't await - do it async)
      if (context?.user?.id) {
        logPiiAccess({
          userId: context.user.id,
          customerId,
          fieldAccessed: options.fields,
          action: options.action,
          ipAddress,
          userAgent,
          accessReason: options.accessReason,
        }).catch((error) => {
          console.error('PII logging failed:', error)
        })
      }

      // Call handler
      return await handler(req, context)
    } catch (error) {
      console.error('Error in PII logging middleware:', error)
      return await handler(req, context)
    }
  }
}

/**
 * Generate PII access report
 *
 * @param params - Report parameters
 * @returns Promise resolving to report data
 */
export interface PiiAccessReportParams {
  startDate: Date
  endDate: Date
  customerId?: string
  userId?: string
  action?: PiiAccessAction
}

export async function generatePiiAccessReport(
  params: PiiAccessReportParams
): Promise<{
  totalAccesses: number
  byAction: Record<PiiAccessAction, number>
  byField: Record<string, number>
  byUser: Record<string, number>
  accessesByHour: Record<number, number>
}> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('pii_access_log')
      .select('*')
      .gte('accessed_at', params.startDate.toISOString())
      .lte('accessed_at', params.endDate.toISOString())

    if (params.customerId) {
      query = query.eq('customer_id', params.customerId)
    }

    if (params.userId) {
      query = query.eq('user_id', params.userId)
    }

    if (params.action) {
      query = query.eq('action', params.action)
    }

    const { data, error } = await query

    if (error || !data) {
      throw error || new Error('No data returned')
    }

    // Aggregate data
    const report = {
      totalAccesses: data.length,
      byAction: {} as Record<PiiAccessAction, number>,
      byField: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      accessesByHour: {} as Record<number, number>,
    }

    for (const log of data) {
      // By action
      report.byAction[log.action] = (report.byAction[log.action] || 0) + 1

      // By field
      const fields = log.field_accessed.split(', ')
      for (const field of fields) {
        report.byField[field] = (report.byField[field] || 0) + 1
      }

      // By user
      report.byUser[log.user_id] = (report.byUser[log.user_id] || 0) + 1

      // By hour
      const hour = new Date(log.accessed_at).getHours()
      report.accessesByHour[hour] = (report.accessesByHour[hour] || 0) + 1
    }

    return report
  } catch (error) {
    console.error('Failed to generate PII access report:', error)
    throw error
  }
}
