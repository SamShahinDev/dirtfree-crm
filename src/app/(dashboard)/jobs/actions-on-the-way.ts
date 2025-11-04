'use server'

import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { makeAction } from '@/lib/actions'
import { sendSms } from '@/lib/sms/twilio'
import { isOptedOut } from '@/lib/sms/optout'
import { getTemplates } from '@/app/(comms)/templates'
import { formatArrivalWindow } from '@/lib/jobs/arrival-window'

export interface OnTheWayResponse {
  ok: boolean
  error?: 'no_permission' | 'terminal_status' | 'no_phone' | 'opted_out' | 'job_not_found' | 'send_failed'
  message?: string
}

/**
 * Send "On The Way" SMS to customer for a job
 */
export const sendOnTheWay = makeAction(
  z.object({
    jobId: z.string().uuid()
  }),
  async (input, { user, role }): Promise<OnTheWayResponse> => {
    const supabase = getServerSupabase()

    try {
      // 1. Load job with customer and technician data
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select(`
          id,
          customer_id,
          technician_id,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          status,
          zone,
          customers!inner(
            id,
            name,
            phone_e164
          )
        `)
        .eq('id', input.jobId)
        .single()

      if (jobError || !job) {
        return { ok: false, error: 'job_not_found' }
      }

      // 2. RBAC: Check permissions
      const canSend = (
        // Technician can only send for their own jobs
        (role === 'technician' && job.technician_id === user.id) ||
        // Dispatcher and admin can send for any job
        role === 'dispatcher' ||
        role === 'admin'
      )

      if (!canSend) {
        return { ok: false, error: 'no_permission' }
      }

      // 3. Check job status - disallow terminal statuses
      if (['completed', 'cancelled'].includes(job.status)) {
        return { ok: false, error: 'terminal_status' }
      }

      // 4. Check customer phone
      const customer = job.customers
      if (!customer.phone_e164) {
        return { ok: false, error: 'no_phone' }
      }

      // 5. Check opt-out status
      const optedOut = await isOptedOut(customer.phone_e164)
      if (optedOut) {
        return { ok: false, error: 'opted_out' }
      }

      // 6. Format arrival window
      const arrivalWindow = formatArrivalWindow(
        job.scheduled_time_start,
        job.scheduled_time_end
      )

      // 7. Generate message body using template
      const templates = await getTemplates()
      const messageBody = templates.on_the_way({
        customerName: customer.name || undefined,
        arrivalWindow,
        company: 'Dirt Free Carpet'
      })

      // 8. Send SMS
      const smsResult = await sendSms({
        toE164: customer.phone_e164,
        body: messageBody,
        customerId: customer.id,
        jobId: job.id,
        templateKey: 'on_the_way'
      })

      if (!smsResult.ok) {
        return {
          ok: false,
          error: 'send_failed',
          message: smsResult.error || 'Failed to send SMS'
        }
      }

      // 9. Audit logging
      await supabase
        .from('audit_logs')
        .insert({
          action: 'send_on_the_way',
          entity: 'job',
          entity_id: job.id,
          user_id: user.id,
          meta: {
            technician_id: job.technician_id,
            customer_id: customer.id,
            message_length: messageBody.length,
            arrival_window: arrivalWindow,
            triggered_by_role: role
          }
        })

      return { ok: true }

    } catch (error) {
      console.error('Send on the way error:', error)
      return {
        ok: false,
        error: 'send_failed',
        message: 'An unexpected error occurred'
      }
    }
  },
  { minimumRole: 'technician' }
)