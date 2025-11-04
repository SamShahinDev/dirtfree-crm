/**
 * Vercel Cron endpoint for sending due reminder SMS messages
 *
 * This endpoint:
 * - Requires CRON_SECRET authentication
 * - Excludes opted-out numbers at selection time
 * - Snoozes during quiet hours (9PM-8AM CT) instead of skipping
 * - Uses row-level locking for concurrency safety
 * - Processes reminders in batches
 * - Provides idempotent logging
 * - Audits all attempts
 */

import { NextRequest, NextResponse } from 'next/server'

import { getServerSupabase } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms/twilio'
import { getTemplates } from '@/app/(comms)/templates'
import { isQuietHours, getQuietHoursDebugInfo, getNowCT, getNextQuietHoursEnd } from '@/lib/time/ct'
import { log, createRequestContext } from '@/lib/obs/log'

// Types
interface ProcessingSummary {
  ok: boolean
  processed: number
  sent: number
  skipped: number
  failures: number
  snoozed?: number
  reason?: string
  debug?: {
    quietHours: ReturnType<typeof getQuietHoursDebugInfo>
    batchSize: number
    timeInfo: {
      startTime: string
      endTime: string
      durationMs: number
    }
  }
}

interface ReminderRow {
  id: string
  type: string
  scheduled_date: string
  customer_id: string
  job_id: string | null
  title: string | null
  body: string | null
  attempt_count: number
  customer_name: string
  customer_phone: string | null
  job_date: string | null
  job_time_start: string | null
  job_time_end: string | null
}

// Configuration
const BATCH_SIZE = 50
const MAX_ATTEMPTS = 3

/**
 * POST /api/cron/send-reminders
 *
 * Vercel cron endpoint for processing due reminders
 */
export async function POST(request: NextRequest) {
  const startTime = new Date()
  const requestContext = createRequestContext(request)
  const logger = log.child(requestContext)

  let summary: ProcessingSummary = {
    ok: false,
    processed: 0,
    sent: 0,
    skipped: 0,
    failures: 0
  }

  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
      console.error('Unauthorized cron request:', {
        hasSecret: !!process.env.CRON_SECRET,
        hasAuth: !!authHeader,
        authMatch: authHeader === expectedAuth
      })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Get Supabase client
    const supabase = getServerSupabase()

    // 3. Load templates
    const templates = await getTemplates()

    // 4. Select and lock due reminders (excluding opted-out numbers)
    const nowCT = getNowCT()
    const today = nowCT.toISOString().split('T')[0]

    const { data: reminders, error: selectError } = await supabase
      .from('reminders')
      .select(`
        id,
        type,
        scheduled_date,
        customer_id,
        job_id,
        title,
        body,
        attempt_count,
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
      .eq('status', 'pending')
      .lte('scheduled_date', today)
      .or('snoozed_until.is.null,snoozed_until.lte.' + nowCT.toISOString())
      .lt('attempt_count', MAX_ATTEMPTS)
      .is('locked_at', null)
      // Exclude opted-out numbers by ensuring no matching opt-out record exists
      .not('customers.phone_e164', 'in', `(
        SELECT phone_e164 FROM sms_opt_outs WHERE phone_e164 IS NOT NULL
      )`)
      .limit(BATCH_SIZE)

    if (selectError) {
      throw new Error(`Failed to select reminders: ${selectError.message}`)
    }

    if (!reminders || reminders.length === 0) {
      const quietHoursInfo = getQuietHoursDebugInfo()
      summary = {
        ok: true,
        processed: 0,
        sent: 0,
        skipped: 0,
        failures: 0,
        reason: 'no_due_reminders',
        debug: {
          quietHours: quietHoursInfo,
          batchSize: BATCH_SIZE,
          timeInfo: {
            startTime: startTime.toISOString(),
            endTime: new Date().toISOString(),
            durationMs: Date.now() - startTime.getTime()
          }
        }
      }

      return NextResponse.json(summary)
    }

    console.log(`Processing ${reminders.length} due reminders`)

    // 5. Check quiet hours and handle accordingly
    const quietHoursInfo = getQuietHoursDebugInfo()
    if (isQuietHours()) {
      console.log('Snoozing reminders during quiet hours:', quietHoursInfo)

      // Lock reminders first
      const reminderIds = reminders.map(r => r.id)
      const lockTime = new Date().toISOString()

      const { error: lockError } = await supabase
        .from('reminders')
        .update({
          locked_at: lockTime,
          last_attempt_at: lockTime,
          attempt_count: supabase.sql`attempt_count + 1`
        })
        .in('id', reminderIds)
        .is('locked_at', null) // Double-check lock safety

      if (lockError) {
        throw new Error(`Failed to lock reminders: ${lockError.message}`)
      }

      // Snooze until next 8AM CT
      const nextQuietHoursEnd = getNextQuietHoursEnd()
      const { error: snoozeError } = await supabase
        .from('reminders')
        .update({
          snoozed_until: nextQuietHoursEnd.toISOString(),
          locked_at: null // Release the lock
        })
        .in('id', reminderIds)

      if (snoozeError) {
        throw new Error(`Failed to snooze reminders: ${snoozeError.message}`)
      }

      summary = {
        ok: true,
        processed: 0,
        sent: 0,
        skipped: 0,
        failures: 0,
        snoozed: reminders.length,
        reason: 'quiet_hours',
        debug: {
          quietHours: quietHoursInfo,
          batchSize: BATCH_SIZE,
          timeInfo: {
            startTime: startTime.toISOString(),
            endTime: new Date().toISOString(),
            durationMs: Date.now() - startTime.getTime()
          }
        }
      }

      return NextResponse.json(summary)
    }

    // 6. Lock reminders for processing (not quiet hours)
    const reminderIds = reminders.map(r => r.id)
    const lockTime = new Date().toISOString()

    const { error: lockError } = await supabase
      .from('reminders')
      .update({
        locked_at: lockTime,
        last_attempt_at: lockTime,
        attempt_count: supabase.sql`attempt_count + 1`
      })
      .in('id', reminderIds)
      .is('locked_at', null) // Double-check lock safety

    if (lockError) {
      throw new Error(`Failed to lock reminders: ${lockError.message}`)
    }

    // 7. Process each reminder
    let sent = 0
    let skipped = 0
    let failures = 0

    for (const reminder of reminders) {
      try {
        const reminderData = reminder as any as ReminderRow
        const result = await processReminder(supabase, templates, reminderData)

        if (result.sent) {
          sent++
        } else if (result.skipped) {
          skipped++
        } else {
          failures++
        }

        // Audit log
        await supabase
          .from('audit_logs')
          .insert({
            action: 'send_reminder',
            entity: 'reminder',
            entity_id: reminderData.id,
            meta: {
              result: result.status,
              attempt_count: reminderData.attempt_count + 1,
              error: result.error,
              phone_number_present: !!reminderData.customer_phone,
              message_length: result.messageLength
            }
          })

      } catch (error) {
        failures++
        console.error(`Failed to process reminder ${reminder.id}:`, error)

        // Audit failure
        await supabase
          .from('audit_logs')
          .insert({
            action: 'send_reminder',
            entity: 'reminder',
            entity_id: reminder.id,
            meta: {
              result: 'processing_error',
              attempt_count: reminder.attempt_count + 1,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
      }
    }

    const endTime = new Date()

    summary = {
      ok: true,
      processed: reminders.length,
      sent,
      skipped,
      failures,
      debug: {
        quietHours: quietHoursInfo,
        batchSize: BATCH_SIZE,
        timeInfo: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMs: endTime.getTime() - startTime.getTime()
        }
      }
    }

    logger.info('Reminder processing completed successfully', summary)

    // Audit successful cron run for SLO tracking
    await supabase
      .from('audit_log')
      .insert({
        ts: new Date().toISOString(),
        actor_id: null,
        actor_email: null,
        action: 'cron_reminders',
        entity: 'reminder_cron',
        entity_id: null,
        outcome: 'ok',
        meta: {
          processed: summary.processed,
          sent: summary.sent,
          skipped: summary.skipped,
          failures: summary.failures,
          snoozed: summary.snoozed,
          durationMs: summary.debug?.timeInfo.durationMs,
          batchSize: BATCH_SIZE
        },
        before: null,
        after: null
      })

    return NextResponse.json(summary)

  } catch (error) {
    logger.error('Cron reminder processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      summary
    })

    const endTime = new Date()
    const errorSummary = {
      ok: false,
      processed: summary.processed,
      sent: summary.sent,
      skipped: summary.skipped,
      failures: summary.failures,
      snoozed: summary.snoozed,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        quietHours: getQuietHoursDebugInfo(),
        batchSize: BATCH_SIZE,
        timeInfo: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMs: endTime.getTime() - startTime.getTime()
        }
      }
    }

    // Audit failed cron run for SLO tracking
    try {
      const supabase = getServerSupabase()
      await supabase
        .from('audit_log')
        .insert({
          ts: new Date().toISOString(),
          actor_id: null,
          actor_email: null,
          action: 'cron_reminders',
          entity: 'reminder_cron',
          entity_id: null,
          outcome: 'error',
          meta: {
            error: error instanceof Error ? error.message : 'Unknown error',
            processed: summary.processed,
            sent: summary.sent,
            skipped: summary.skipped,
            failures: summary.failures,
            snoozed: summary.snoozed,
            durationMs: errorSummary.debug.timeInfo.durationMs,
            batchSize: BATCH_SIZE
          },
          before: null,
          after: null
        })
    } catch (auditError) {
      logger.error('Failed to audit cron error', {
        error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
      })
    }

    return NextResponse.json(errorSummary, { status: 500 })
  }
}

/**
 * Process a single reminder
 */
async function processReminder(
  supabase: any,
  templates: any,
  reminder: ReminderRow
): Promise<{
  status: 'sent' | 'skipped' | 'failed'
  sent: boolean
  skipped: boolean
  error?: string
  messageLength?: number
}> {
  // Check if customer has a phone number
  if (!reminder.customer_phone) {
    // Mark as completed since we can't send without phone
    await supabase
      .from('reminders')
      .update({
        status: 'completed',
        locked_at: null
      })
      .eq('id', reminder.id)

    return {
      status: 'skipped',
      sent: false,
      skipped: true,
      error: 'No phone number'
    }
  }

  // Generate message body
  let messageBody: string

  if (reminder.body) {
    // Use explicit body if provided
    messageBody = reminder.body
  } else if (reminder.type === 'job_reminder' && templates.job_reminder) {
    // Use template for job reminders
    const context = {
      customerName: reminder.customer_name,
      company: 'Dirt Free Carpet',
      jobDate: reminder.job_date || reminder.scheduled_date,
      arrivalWindow: reminder.job_time_start && reminder.job_time_end
        ? `${reminder.job_time_start}-${reminder.job_time_end}`
        : 'during your scheduled window'
    }
    messageBody = templates.job_reminder(context)
  } else {
    // Fallback to title or generic message
    messageBody = reminder.title || 'You have a scheduled appointment. Reply STOP to opt out.'
  }

  // Create deterministic provider_message_id for idempotency
  const providerMessageId = `reminder:${reminder.id}:${reminder.attempt_count + 1}`

  // Check if we already have a communication log for this attempt
  const { data: existingLog } = await supabase
    .from('communication_logs')
    .select('id, status')
    .eq('provider_message_id', providerMessageId)
    .single()

  if (existingLog) {
    // Already processed this attempt
    if (existingLog.status === 'delivered' || existingLog.status === 'sent') {
      // Mark reminder as completed
      await supabase
        .from('reminders')
        .update({
          status: 'completed',
          locked_at: null
        })
        .eq('id', reminder.id)

      return {
        status: 'sent',
        sent: true,
        skipped: false,
        messageLength: messageBody.length
      }
    } else {
      // Previous attempt failed, continue with retry
    }
  }

  // Send SMS
  try {
    const smsResult = await sendSms({
      toE164: reminder.customer_phone,
      body: messageBody,
      customerId: reminder.customer_id,
      jobId: reminder.job_id,
      templateKey: reminder.type === 'job_reminder' ? 'job_reminder' : null
    })

    if (smsResult.ok) {
      // Success - mark reminder as completed
      await supabase
        .from('reminders')
        .update({
          status: 'completed',
          locked_at: null
        })
        .eq('id', reminder.id)

      // Upsert communication log with actual SID
      await supabase
        .from('communication_logs')
        .upsert({
          direction: 'outbound',
          to_e164: reminder.customer_phone,
          from_e164: process.env.TWILIO_PHONE_NUMBER,
          template_key: reminder.type === 'job_reminder' ? 'job_reminder' : null,
          status: 'sent',
          provider_message_id: smsResult.sid || providerMessageId,
          job_id: reminder.job_id,
          customer_id: reminder.customer_id,
          body: {
            text: messageBody,
            provider: 'twilio',
            reminder_id: reminder.id,
            attempt_count: reminder.attempt_count + 1
          }
        }, {
          onConflict: 'provider_message_id'
        })

      return {
        status: 'sent',
        sent: true,
        skipped: false,
        messageLength: messageBody.length
      }

    } else {
      // SMS failed
      await supabase
        .from('reminders')
        .update({
          locked_at: null
          // Keep status as 'pending' for retry (unless max attempts reached)
        })
        .eq('id', reminder.id)

      // Log the failure
      await supabase
        .from('communication_logs')
        .upsert({
          direction: 'outbound',
          to_e164: reminder.customer_phone,
          from_e164: process.env.TWILIO_PHONE_NUMBER,
          template_key: reminder.type === 'job_reminder' ? 'job_reminder' : null,
          status: 'failed',
          provider_message_id: providerMessageId,
          job_id: reminder.job_id,
          customer_id: reminder.customer_id,
          body: {
            text: messageBody,
            provider: 'twilio',
            reminder_id: reminder.id,
            attempt_count: reminder.attempt_count + 1,
            error: smsResult.error
          }
        }, {
          onConflict: 'provider_message_id'
        })

      return {
        status: 'failed',
        sent: false,
        skipped: false,
        error: smsResult.error,
        messageLength: messageBody.length
      }
    }

  } catch (error) {
    // Unlock reminder for retry
    await supabase
      .from('reminders')
      .update({
        locked_at: null
      })
      .eq('id', reminder.id)

    return {
      status: 'failed',
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'Unknown SMS error',
      messageLength: messageBody.length
    }
  }
}

// Only allow POST
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}