import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Customer Communication Preferences API
 *
 * GET /api/customers/[id]/preferences
 * - Get customer communication preferences
 * - Returns preferences, communication history, and violation stats
 *
 * PATCH /api/customers/[id]/preferences
 * - Update customer communication preferences
 *
 * Authentication: Required (customer can view/update own, staff can view/update all)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for preference updates
 */
const UpdatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  portalNotificationsEnabled: z.boolean().optional(),
  phoneCallsEnabled: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  appointmentReminders: z.boolean().optional(),
  serviceUpdates: z.boolean().optional(),
  promotionalMessages: z.boolean().optional(),
  billingNotifications: z.boolean().optional(),
  surveyRequests: z.boolean().optional(),
  preferredContactMethod: z.enum(['email', 'sms', 'phone', 'portal']).nullable().optional(),
  preferredContactTime: z.string().nullable().optional(),
  languagePreference: z.string().optional(),
  timezone: z.string().nullable().optional(),
  doNotContact: z.boolean().optional(),
  optOutReason: z.string().nullable().optional(),
  maxMessagesPerWeek: z.number().min(0).max(100).optional(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
})

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
  )
}

/**
 * Check if user has required role
 */
async function checkUserRole(
  userId: string,
  requiredRoles: string[]
): Promise<boolean> {
  const supabase = getServiceSupabase()

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', requiredRoles)
    .single()

  return !error && !!data
}

/**
 * Check if user can access customer
 */
async function canAccessCustomer(
  userId: string,
  customerId: string
): Promise<boolean> {
  const supabase = getServiceSupabase()

  // Check if user is staff
  const isStaff = await checkUserRole(userId, [
    'admin',
    'manager',
    'dispatcher',
    'technician',
  ])

  if (isStaff) return true

  // Check if user owns the customer account
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('user_id', userId)
    .single()

  return !error && !!data
}

/**
 * GET - Get customer communication preferences
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const customerId = params.id

    // Check if user can access this customer
    const hasAccess = await canAccessCustomer(user.id, customerId)

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    const serviceSupabase = getServiceSupabase()

    // Get preferences
    const { data: preferences, error: preferencesError } = await serviceSupabase
      .from('customer_communication_preferences')
      .select('*')
      .eq('customer_id', customerId)
      .single()

    if (preferencesError) {
      console.error('[Preferences] Error fetching preferences:', preferencesError)
      return createErrorResponse(
        'database_error',
        'Failed to fetch preferences',
        500
      )
    }

    // Get communication history
    const { data: history, error: historyError } = await (serviceSupabase as any).rpc(
      'get_customer_communication_history',
      {
        p_customer_id: customerId,
        p_limit: 50,
      }
    )

    // Get violation stats
    const { data: violationStats, error: violationError } = await (serviceSupabase as any).rpc(
      'get_preference_violation_stats',
      {
        p_customer_id: customerId,
        p_days: 30,
      }
    )

    // Transform preferences to camelCase
    const transformedPreferences = preferences ? {
      id: (preferences as any).id,
      customerId: (preferences as any).customer_id,
      emailEnabled: (preferences as any).email_enabled,
      smsEnabled: (preferences as any).sms_enabled,
      portalNotificationsEnabled: (preferences as any).portal_notifications_enabled,
      phoneCallsEnabled: (preferences as any).phone_calls_enabled,
      marketingEmails: (preferences as any).marketing_emails,
      appointmentReminders: (preferences as any).appointment_reminders,
      serviceUpdates: (preferences as any).service_updates,
      promotionalMessages: (preferences as any).promotional_messages,
      billingNotifications: (preferences as any).billing_notifications,
      surveyRequests: (preferences as any).survey_requests,
      preferredContactMethod: (preferences as any).preferred_contact_method,
      preferredContactTime: (preferences as any).preferred_contact_time,
      languagePreference: (preferences as any).language_preference,
      timezone: (preferences as any).timezone,
      doNotContact: (preferences as any).do_not_contact,
      optedOutAt: (preferences as any).opted_out_at,
      optOutReason: (preferences as any).opt_out_reason,
      maxMessagesPerWeek: (preferences as any).max_messages_per_week,
      quietHoursStart: (preferences as any).quiet_hours_start,
      quietHoursEnd: (preferences as any).quiet_hours_end,
      createdAt: (preferences as any).created_at,
      updatedAt: (preferences as any).updated_at,
    } : null

    // Transform history
    const historyArray: any[] = (history as any) || []
    const transformedHistory = historyArray.map((item) => ({
      id: item.id,
      communicationType: item.communication_type,
      channel: item.channel,
      subject: item.subject,
      sentAt: item.sent_at,
      delivered: item.delivered,
      read: item.read,
    }))

    // Transform violation stats
    const statsArray: any[] = (violationStats as any) || []
    const stats = statsArray.length > 0 ? statsArray[0] : {
      total_violations: 0,
      blocked_violations: 0,
      by_type: {},
      by_channel: {},
    }

    return createSuccessResponse({
      preferences: transformedPreferences,
      communicationHistory: transformedHistory,
      violationStats: {
        totalViolations: parseInt(stats.total_violations || '0'),
        blockedViolations: parseInt(stats.blocked_violations || '0'),
        byType: stats.by_type || {},
        byChannel: stats.by_channel || {},
      },
    })
  } catch (error) {
    console.error('[Preferences] GET /api/customers/[id]/preferences error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * PATCH - Update customer communication preferences
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const customerId = params.id

    // Check if user can access this customer
    const hasAccess = await canAccessCustomer(user.id, customerId)

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdatePreferencesSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid preference data: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const updates = validation.data

    // Build update object with snake_case
    const updateData: any = {}

    if (updates.emailEnabled !== undefined) updateData.email_enabled = updates.emailEnabled
    if (updates.smsEnabled !== undefined) updateData.sms_enabled = updates.smsEnabled
    if (updates.portalNotificationsEnabled !== undefined) updateData.portal_notifications_enabled = updates.portalNotificationsEnabled
    if (updates.phoneCallsEnabled !== undefined) updateData.phone_calls_enabled = updates.phoneCallsEnabled
    if (updates.marketingEmails !== undefined) updateData.marketing_emails = updates.marketingEmails
    if (updates.appointmentReminders !== undefined) updateData.appointment_reminders = updates.appointmentReminders
    if (updates.serviceUpdates !== undefined) updateData.service_updates = updates.serviceUpdates
    if (updates.promotionalMessages !== undefined) updateData.promotional_messages = updates.promotionalMessages
    if (updates.billingNotifications !== undefined) updateData.billing_notifications = updates.billingNotifications
    if (updates.surveyRequests !== undefined) updateData.survey_requests = updates.surveyRequests
    if (updates.preferredContactMethod !== undefined) updateData.preferred_contact_method = updates.preferredContactMethod
    if (updates.preferredContactTime !== undefined) updateData.preferred_contact_time = updates.preferredContactTime
    if (updates.languagePreference !== undefined) updateData.language_preference = updates.languagePreference
    if (updates.timezone !== undefined) updateData.timezone = updates.timezone
    if (updates.doNotContact !== undefined) updateData.do_not_contact = updates.doNotContact
    if (updates.optOutReason !== undefined) updateData.opt_out_reason = updates.optOutReason
    if (updates.maxMessagesPerWeek !== undefined) updateData.max_messages_per_week = updates.maxMessagesPerWeek
    if (updates.quietHoursStart !== undefined) updateData.quiet_hours_start = updates.quietHoursStart
    if (updates.quietHoursEnd !== undefined) updateData.quiet_hours_end = updates.quietHoursEnd

    const serviceSupabase = getServiceSupabase()

    // Update preferences
    const { data: updated, error: updateError } = await (serviceSupabase as any)
      .from('customer_communication_preferences')
      .update(updateData)
      .eq('customer_id', customerId)
      .select()
      .single()

    if (updateError) {
      console.error('[Preferences] Error updating preferences:', updateError)
      return createErrorResponse(
        'update_failed',
        'Failed to update preferences',
        500
      )
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'customer_preferences_updated',
      resource_type: 'customer_communication_preferences',
      resource_id: (updated as any).id,
      metadata: {
        customerId,
        updates,
      },
    } as any)

    return createSuccessResponse({
      message: 'Preferences updated successfully',
      preferences: {
        id: (updated as any).id,
        customerId: (updated as any).customer_id,
        emailEnabled: (updated as any).email_enabled,
        smsEnabled: (updated as any).sms_enabled,
        portalNotificationsEnabled: (updated as any).portal_notifications_enabled,
        phoneCallsEnabled: (updated as any).phone_calls_enabled,
        marketingEmails: (updated as any).marketing_emails,
        appointmentReminders: (updated as any).appointment_reminders,
        serviceUpdates: (updated as any).service_updates,
        promotionalMessages: (updated as any).promotional_messages,
        billingNotifications: (updated as any).billing_notifications,
        surveyRequests: (updated as any).survey_requests,
        preferredContactMethod: (updated as any).preferred_contact_method,
        preferredContactTime: (updated as any).preferred_contact_time,
        languagePreference: (updated as any).language_preference,
        timezone: (updated as any).timezone,
        doNotContact: (updated as any).do_not_contact,
        optedOutAt: (updated as any).opted_out_at,
        optOutReason: (updated as any).opt_out_reason,
        maxMessagesPerWeek: (updated as any).max_messages_per_week,
        quietHoursStart: (updated as any).quiet_hours_start,
        quietHoursEnd: (updated as any).quiet_hours_end,
        updatedAt: (updated as any).updated_at,
      },
    })
  } catch (error) {
    console.error('[Preferences] PATCH /api/customers/[id]/preferences error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
