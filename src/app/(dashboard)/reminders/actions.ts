'use server'

import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { makeAction, makeDispatcherAction, makeTechnicianAction, ActionResult } from '@/lib/actions'
import { sendSms } from '@/lib/sms/twilio'
import { isOptedOut } from '@/lib/sms/optout'
import { getTemplates } from '@/app/(comms)/templates'
import { normalizeToE164 } from '@/lib/utils/phone'
import {
  ReminderCreateZ,
  ReminderUpdateZ,
  ReminderFilterZ,
  SnoozeZ,
  ReassignZ,
  CommentZ,
  CompleteZ,
  CancelZ,
  CreateFollowUpZ,
  isValidStatusTransition,
  type ReminderCreate,
  type ReminderUpdate,
  type ReminderFilter,
  type SnoozeInput,
  type ReassignInput,
  type CommentInput,
  type CompleteInput,
  type CancelInput,
  type CreateFollowUpInput,
  type ReminderStatus
} from './schema'

// Types for hydrated reminder data
export interface ReminderRow {
  id: string
  type: string
  title: string
  body: string | null
  status: ReminderStatus
  origin: string | null
  scheduled_date: string
  snoozed_until: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  customer_id: string | null
  job_id: string | null
  assigned_to: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  job_description: string | null
  job_date: string | null
  job_time_start: string | null
  job_time_end: string | null
  assigned_to_name: string | null
  technician_name: string | null // Alias for assigned_to_name for consistency
  last_activity: string | null
}

export interface ReminderDetail extends ReminderRow {
  technician_name: string | null
  customer_address: string | null
  attempt_count: number
  communication_logs: Array<{
    id: string
    direction: 'inbound' | 'outbound'
    status: string
    created_at: string
    body: { text?: string; provider?: string }
  }>
  comments: Array<{
    id: string
    body: string
    created_at: string
    created_by: string
    author_name: string
  }>
}

export interface ListRemindersResult {
  rows: ReminderRow[]
  total: number
  page: number
  size: number
}

// Audit logging helper
async function auditLog(action: string, entityId: string, meta?: Record<string, any>) {
  const supabase = await getServerSupabase()
  try {
    await supabase
      .from('audit_logs')
      .insert({
        action,
        entity: 'reminder',
        entity_id: entityId,
        meta: meta || {}
      })
  } catch (error) {
    console.error('Audit log failed:', { action, entityId, error })
  }
}

/**
 * List reminders with search and filtering - Phase 8 spec
 */
export const listReminders = makeTechnicianAction(
  ReminderFilterZ,
  async (filters: ReminderFilter, { user, role }): Promise<ListRemindersResult> => {
    const supabase = await getServerSupabase()
    const { search, types, statuses, assigneeId, from, to, showSnoozed, page = 1, size = 25 } = filters

    let query = supabase
      .from('reminders')
      .select(`
        id,
        type,
        origin,
        title,
        body,
        status,
        scheduled_date,
        snoozed_until,
        completed_at,
        created_at,
        updated_at,
        customer_id,
        job_id,
        assigned_to,
        customers(
          name,
          phone_e164,
          email
        ),
        jobs(
          description,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end
        )
      `, { count: 'exact' })

    // Apply RLS-aware filtering based on role
    if (role === 'technician') {
      // Technicians can only see reminders assigned to them or unassigned reminders they have access to
      query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`)
    }

    // Hide snoozed reminders unless explicitly showing them
    if (!showSnoozed) {
      query = query.or('snoozed_until.is.null,snoozed_until.lt.now()')
    }

    // Search functionality
    if (search) {
      const trimmedSearch = search.trim()

      // Check if search looks like a phone number
      const normalizedPhone = normalizeToE164(trimmedSearch)
      if (normalizedPhone) {
        query = query.eq('customers.phone_e164', normalizedPhone)
      } else {
        // Text search on customer name, title, and job description
        query = query.or(`customers.name.ilike.%${trimmedSearch}%,title.ilike.%${trimmedSearch}%,jobs.description.ilike.%${trimmedSearch}%`)
      }
    }

    // Status filter
    if (statuses && statuses.length > 0) {
      query = query.in('status', statuses)
    }

    // Type filter
    if (types && types.length > 0) {
      query = query.in('type', types)
    }

    // Assignee filter (dispatcher/admin only)
    if (assigneeId && (role === 'dispatcher' || role === 'admin')) {
      query = query.eq('assigned_to', assigneeId)
    }

    // Date range filters
    if (from) {
      query = query.gte('scheduled_date', from)
    }
    if (to) {
      query = query.lte('scheduled_date', to)
    }

    // Pagination
    const offset = (page - 1) * size
    query = query
      .order('scheduled_date', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch reminders: ${error.message}`)
    }

    // Transform the data
    const rows: ReminderRow[] = (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      origin: row.origin,
      title: row.title,
      body: row.body,
      status: row.status,
      scheduled_date: row.scheduled_date,
      snoozed_until: row.snoozed_until,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      customer_id: row.customer_id,
      job_id: row.job_id,
      assigned_to: row.assigned_to,
      customer_name: row.customers?.name || null,
      customer_phone: row.customers?.phone_e164 || null,
      customer_email: row.customers?.email || null,
      job_description: row.jobs?.description || null,
      job_date: row.jobs?.scheduled_date || null,
      job_time_start: row.jobs?.scheduled_time_start || null,
      job_time_end: row.jobs?.scheduled_time_end || null,
      assigned_to_name: null, // Removed users join - fetch separately if needed
      technician_name: null, // Removed users join - fetch separately if needed
      last_activity: row.updated_at // For now, use updated_at as last activity
    }))

    return {
      rows,
      total: count || 0,
      page,
      size
    }
  }
)

/**
 * Get a single reminder with full details
 */
export const getReminder = makeTechnicianAction(
  z.object({ id: z.string().uuid() }),
  async ({ id }, { user, role }): Promise<ReminderDetail> => {
    const supabase = await getServerSupabase()

    let query = supabase
      .from('reminders')
      .select(`
        id,
        type,
        title,
        body,
        status,
        scheduled_date,
        snoozed_until,
        created_at,
        updated_at,
        attempt_count,
        customer_id,
        job_id,
        assigned_to,
        customers!inner(
          name,
          phone_e164,
          email,
          address
        ),
        jobs(
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end
        )
      `)
      .eq('id', id)

    // Apply RLS-aware filtering
    if (role === 'technician') {
      query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`)
    }

    const { data: reminderData, error: reminderError } = await query.single()

    if (reminderError) {
      throw new Error(`Failed to fetch reminder: ${reminderError.message}`)
    }

    // Get communication logs for this customer
    const { data: communicationLogs } = await supabase
      .from('communication_logs')
      .select('id, direction, status, created_at, body')
      .eq('customer_id', reminderData.customer_id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get comments for this reminder
    const { data: comments } = await supabase
      .from('reminder_comments')
      .select(`
        id,
        body,
        created_at,
        created_by,
        users:created_by(name)
      `)
      .eq('reminder_id', id)
      .order('created_at', { ascending: true })

    // Transform the reminder data
    const reminder: ReminderDetail = {
      id: reminderData.id,
      type: reminderData.type,
      title: reminderData.title,
      body: reminderData.body,
      status: reminderData.status,
      scheduled_date: reminderData.scheduled_date,
      snoozed_until: reminderData.snoozed_until,
      created_at: reminderData.created_at,
      updated_at: reminderData.updated_at,
      attempt_count: reminderData.attempt_count,
      customer_id: reminderData.customer_id,
      job_id: reminderData.job_id,
      assigned_to: reminderData.assigned_to,
      customer_name: reminderData.customers.name,
      customer_phone: reminderData.customers.phone_e164,
      customer_email: reminderData.customers.email,
      customer_address: reminderData.customers.address,
      job_date: reminderData.jobs?.scheduled_date || null,
      job_time_start: reminderData.jobs?.scheduled_time_start || null,
      job_time_end: reminderData.jobs?.scheduled_time_end || null,
      technician_name: null, // Removed users join - fetch separately if needed
      communication_logs: communicationLogs || [],
      comments: (comments || []).map((comment: any) => ({
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        created_by: comment.created_by,
        author_name: comment.users?.name || 'Unknown User'
      }))
    }

    return reminder
  }
)

/**
 * Create a new reminder (dispatcher/admin only)
 */
export const createReminder = makeDispatcherAction(
  ReminderCreateZ,
  async (input: ReminderCreate, { user }): Promise<{ id: string }> => {
    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('reminders')
      .insert({
        customer_id: input.customerId,
        job_id: input.jobId,
        assigned_to: input.assignedTo,
        type: input.type,
        title: input.title,
        body: input.body,
        scheduled_date: input.scheduledDate,
        status: 'pending',
        attempt_count: 0
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to create reminder: ${error.message}`)
    }

    await auditLog('create_reminder', data.id, {
      type: input.type,
      customer_id: input.customerId,
      job_id: input.jobId,
      technician_id: input.technicianId
    })

    return { id: data.id }
  }
)

/**
 * Update a reminder (dispatcher/admin only)
 */
export const updateReminder = makeDispatcherAction(
  z.object({
    id: z.string().uuid(),
    input: ReminderUpdateZ
  }),
  async ({ id, input }, { user }): Promise<void> => {
    const supabase = await getServerSupabase()

    // If status is being changed, validate the transition
    if (input.status) {
      const { data: currentReminder } = await supabase
        .from('reminders')
        .select('status')
        .eq('id', id)
        .single()

      if (currentReminder && !isValidStatusTransition(currentReminder.status, input.status)) {
        throw new Error(`Invalid status transition from ${currentReminder.status} to ${input.status}`)
      }
    }

    const updateData: any = {}
    if (input.customerId !== undefined) updateData.customer_id = input.customerId
    if (input.jobId !== undefined) updateData.job_id = input.jobId
    if (input.assignedTo !== undefined) updateData.assigned_to = input.assignedTo
    if (input.type !== undefined) updateData.type = input.type
    if (input.title !== undefined) updateData.title = input.title
    if (input.body !== undefined) updateData.body = input.body
    if (input.scheduledDate !== undefined) updateData.scheduled_date = input.scheduledDate
    if (input.status !== undefined) updateData.status = input.status

    const { error } = await supabase
      .from('reminders')
      .update(updateData)
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to update reminder: ${error.message}`)
    }

    await auditLog('update_reminder', id, input)
  }
)

/**
 * Reassign a reminder to a user (dispatcher/admin only) - Phase 8
 */
export const reassignReminder = makeDispatcherAction(
  ReassignZ,
  async ({ id, userId }, { user }): Promise<void> => {
    const supabase = await getServerSupabase()

    // Get current assignment for audit
    const { data: currentReminder } = await supabase
      .from('reminders')
      .select('assigned_to')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('reminders')
      .update({
        assigned_to: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to reassign reminder: ${error.message}`)
    }

    await auditLog('reassign_reminder', id, {
      from_user_id: currentReminder?.assigned_to,
      to_user_id: userId
    })
  }
)

/**
 * Snooze a reminder (dispatcher/admin or assigned technician) - Phase 8
 */
export const snoozeReminder = makeAction(
  SnoozeZ,
  async ({ id, snoozedUntil }, { user, role }): Promise<void> => {
    const supabase = await getServerSupabase()

    // Check permissions: dispatcher/admin can snooze any, technicians only their assigned
    if (role === 'technician') {
      const { data: reminder } = await supabase
        .from('reminders')
        .select('assigned_to')
        .eq('id', id)
        .single()

      if (!reminder || reminder.assigned_to !== user.id) {
        throw new Error('Not authorized to snooze this reminder')
      }
    }

    // Get current status for audit
    const { data: currentReminder } = await supabase
      .from('reminders')
      .select('status, snoozed_until')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('reminders')
      .update({
        status: 'snoozed',
        snoozed_until: snoozedUntil,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to snooze reminder: ${error.message}`)
    }

    await auditLog('snooze_reminder', id, {
      from_status: currentReminder?.status,
      to_status: 'snoozed',
      snoozed_until: snoozedUntil
    })
  }
)

/**
 * Complete a reminder (dispatcher/admin or assigned technician) - Phase 8
 */
export const completeReminder = makeAction(
  CompleteZ,
  async ({ id }, { user, role }): Promise<void> => {
    const supabase = await getServerSupabase()

    // Check permissions: dispatcher/admin can complete any, technicians only their assigned
    if (role === 'technician') {
      const { data: reminder } = await supabase
        .from('reminders')
        .select('assigned_to')
        .eq('id', id)
        .single()

      if (!reminder || reminder.assigned_to !== user.id) {
        throw new Error('Not authorized to complete this reminder')
      }
    }

    // Get current status for audit
    const { data: currentReminder } = await supabase
      .from('reminders')
      .select('status')
      .eq('id', id)
      .single()

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('reminders')
      .update({
        status: 'complete',
        completed_at: now,
        updated_at: now
      })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to complete reminder: ${error.message}`)
    }

    await auditLog('complete_reminder', id, {
      from_status: currentReminder?.status,
      to_status: 'complete',
      completed_at: now
    })
  }
)

/**
 * Cancel a reminder (dispatcher/admin only) - Phase 8
 */
export const cancelReminder = makeDispatcherAction(
  CancelZ,
  async ({ id }, { user }): Promise<void> => {
    const supabase = await getServerSupabase()

    // Get current status for audit
    const { data: currentReminder } = await supabase
      .from('reminders')
      .select('status')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('reminders')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to cancel reminder: ${error.message}`)
    }

    await auditLog('cancel_reminder', id, {
      from_status: currentReminder?.status,
      to_status: 'canceled'
    })
  }
)

/**
 * Add a comment to a reminder - Phase 8
 */
export const addReminderComment = makeTechnicianAction(
  CommentZ,
  async ({ id, body }, { user }): Promise<{ commentId: string }> => {
    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('reminder_comments')
      .insert({
        reminder_id: id,
        content: body, // Updated to match schema
        author_id: user.id
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to add comment: ${error.message}`)
    }

    // Update reminder's updated_at to reflect activity
    await supabase
      .from('reminders')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)

    await auditLog('add_reminder_comment', id, { comment_id: data.id })

    return { commentId: data.id }
  }
)

/**
 * Create follow-up reminder from job completion - Phase 8 critical feature
 */
export const createFollowUpReminder = makeTechnicianAction(
  CreateFollowUpZ,
  async (input: CreateFollowUpInput, { user }): Promise<{ id: string }> => {
    const supabase = await getServerSupabase()

    try {
      // Check if follow-up already exists for this job (idempotency)
      const { data: existingFollowUp } = await supabase
        .from('reminders')
        .select('id')
        .eq('job_id', input.jobId)
        .eq('origin', 'tech_post_complete')
        .eq('type', 'follow_up')
        .neq('status', 'canceled')
        .single()

      if (existingFollowUp) {
        throw new Error('A follow-up reminder already exists for this job')
      }

      // Create the follow-up reminder
      const { data, error } = await supabase
        .from('reminders')
        .insert({
          customer_id: input.customerId,
          job_id: input.jobId,
          type: 'follow_up',
          origin: 'tech_post_complete',
          title: input.title,
          body: input.body,
          scheduled_date: input.scheduledDate,
          status: 'pending',
          assigned_to: null // Can be assigned later by dispatcher
        })
        .select('id')
        .single()

      if (error) {
        throw new Error(`Failed to create follow-up reminder: ${error.message}`)
      }

      await auditLog('create_followup_reminder', data.id, {
        job_id: input.jobId,
        customer_id: input.customerId,
        scheduled_date: input.scheduledDate,
        origin: 'tech_post_complete'
      })

      return { id: data.id }

    } catch (error) {
      // If it's a unique constraint violation, return existing ID
      if (error instanceof Error && error.message.includes('already exists')) {
        const { data: existing } = await supabase
          .from('reminders')
          .select('id')
          .eq('job_id', input.jobId)
          .eq('origin', 'tech_post_complete')
          .eq('type', 'follow_up')
          .neq('status', 'canceled')
          .single()

        if (existing) {
          return { id: existing.id }
        }
      }
      throw error
    }
  }
)

/**
 * Send reminder SMS immediately (dispatcher/admin only)
 */
export const sendReminderNow = makeDispatcherAction(
  z.object({ id: z.string().uuid() }),
  async ({ id }): Promise<{ ok: boolean; error?: string }> => {
    const supabase = await getServerSupabase()

    // Load reminder with customer data
    const { data: reminder, error: reminderError } = await supabase
      .from('reminders')
      .select(`
        id,
        type,
        title,
        body,
        customer_id,
        job_id,
        scheduled_date,
        customers!inner(
          name,
          phone_e164
        ),
        jobs(
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end
        )
      `)
      .eq('id', id)
      .single()

    if (reminderError || !reminder) {
      return { ok: false, error: 'Reminder not found' }
    }

    const customerPhone = reminder.customers.phone_e164
    if (!customerPhone) {
      return { ok: false, error: 'Customer has no phone number' }
    }

    // Check if customer is opted out
    if (await isOptedOut(customerPhone)) {
      return { ok: false, error: 'Customer has opted out of SMS' }
    }

    // Load templates
    const templates = await getTemplates()

    // Choose appropriate template based on type and timing
    let templateKey: string
    let messageBody: string

    if (reminder.body) {
      // Use explicit body if provided
      messageBody = reminder.body
      templateKey = reminder.type === 'follow_up' ? 'followup' : 'reminder24h'
    } else {
      // Choose template based on type and timing
      const scheduledDate = new Date(reminder.scheduled_date)
      const now = new Date()
      const daysDiff = Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (reminder.type === 'follow_up') {
        templateKey = 'followup'
      } else if (daysDiff <= 1) {
        templateKey = 'reminder24h'
      } else {
        templateKey = 'reminder48h'
      }

      // Generate message from template
      const template = templates[templateKey as keyof typeof templates]
      if (!template) {
        return { ok: false, error: 'Template not found' }
      }

      const arrivalWindow = reminder.jobs?.scheduled_time_start && reminder.jobs?.scheduled_time_end
        ? `${reminder.jobs.scheduled_time_start}-${reminder.jobs.scheduled_time_end}`
        : undefined

      messageBody = template({
        customerName: reminder.customers.name,
        jobDate: reminder.jobs?.scheduled_date || reminder.scheduled_date,
        arrivalWindow,
        company: 'Dirt Free Carpet'
      })
    }

    // Send SMS
    const smsResult = await sendSms({
      toE164: customerPhone,
      body: messageBody,
      customerId: reminder.customer_id,
      jobId: reminder.job_id,
      templateKey: templateKey as any
    })

    await auditLog('send_reminder_now', id, {
      template_key: templateKey,
      message_length: messageBody.length,
      sms_result: smsResult
    })

    if (!smsResult.ok) {
      return { ok: false, error: smsResult.error || 'SMS send failed' }
    }

    return { ok: true }
  }
)