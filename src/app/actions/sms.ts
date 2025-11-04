'use server'

import { sendSms, getSmsConversation, sendSmsTemplate } from '@/lib/sms/service'
import { getServerSupabase } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SendSmsPayload {
  to: string
  message: string
  customerId?: string
  jobId?: string
  technicianId?: string
  metadata?: Record<string, any>
}

/**
 * Server action to send SMS
 */
export async function sendSmsAction(payload: SendSmsPayload) {
  try {
    const result = await sendSms(payload)

    if (result.success) {
      revalidatePath(`/customers/${payload.customerId}`)
      revalidatePath('/sms')
    }

    return result
  } catch (error) {
    console.error('[SMS Action] Failed to send SMS:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS'
    }
  }
}

/**
 * Server action to get SMS conversation
 */
export async function getSmsConversationAction(customerId: string, limit: number = 50) {
  try {
    const messages = await getSmsConversation(customerId, limit)
    return messages
  } catch (error) {
    console.error('[SMS Action] Failed to get conversation:', error)
    return []
  }
}

/**
 * Server action to send appointment reminder
 */
export async function sendAppointmentReminderAction(jobId: string) {
  try {
    const supabase = await getServerSupabase()

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
        services:job_services(service:services(*))
      `)
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return { success: false, error: 'Job not found' }
    }

    if (!job.customer?.phone_e164) {
      return { success: false, error: 'Customer has no phone number' }
    }

    // Format date and time
    const scheduledDate = new Date(job.scheduled_date)
    const formattedDate = scheduledDate.toLocaleDateString()
    const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    // Get service names
    const services = job.services?.map((s: any) => s.service.name).join(', ') || 'Cleaning service'

    // Send reminder
    const result = await sendSmsTemplate(
      'appointmentReminder',
      job.customer.phone_e164,
      {
        name: job.customer.name,
        date: formattedDate,
        time: formattedTime,
        services
      },
      {
        customerId: job.customer_id,
        jobId: job.id
      }
    )

    if (result.success) {
      // Update job to indicate reminder was sent
      await supabase
        .from('jobs')
        .update({
          reminder_sent_at: new Date().toISOString()
        })
        .eq('id', jobId)

      revalidatePath(`/jobs/${jobId}`)
    }

    return result
  } catch (error) {
    console.error('[SMS Action] Failed to send appointment reminder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send reminder'
    }
  }
}

/**
 * Server action to send technician on-the-way notification
 */
export async function sendTechnicianOnWayAction(jobId: string, technicianName: string, eta: string) {
  try {
    const supabase = await getServerSupabase()

    // Get job and customer details
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*, customer:customers(*)')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return { success: false, error: 'Job not found' }
    }

    if (!job.customer?.phone_e164) {
      return { success: false, error: 'Customer has no phone number' }
    }

    // Send notification
    const result = await sendSmsTemplate(
      'technicianOnWay',
      job.customer.phone_e164,
      {
        name: job.customer.name,
        techName: technicianName,
        time: eta,
        link: `${process.env.NEXT_PUBLIC_APP_URL}/track/${jobId}`
      },
      {
        customerId: job.customer_id,
        jobId: job.id
      }
    )

    if (result.success) {
      // Update job status
      await supabase
        .from('jobs')
        .update({
          status: 'in_transit',
          tech_on_way_at: new Date().toISOString()
        })
        .eq('id', jobId)

      revalidatePath(`/jobs/${jobId}`)
    }

    return result
  } catch (error) {
    console.error('[SMS Action] Failed to send on-way notification:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send notification'
    }
  }
}

/**
 * Server action to send job completion notification
 */
export async function sendJobCompletionAction(jobId: string, invoiceId?: string) {
  try {
    const supabase = await getServerSupabase()

    // Get job and customer details
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*, customer:customers(*)')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return { success: false, error: 'Job not found' }
    }

    if (!job.customer?.phone_e164) {
      return { success: false, error: 'Customer has no phone number' }
    }

    // Generate invoice link if provided
    const invoiceLink = invoiceId
      ? `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${invoiceId}`
      : `${process.env.NEXT_PUBLIC_APP_URL}/customer/${job.customer_id}/invoices`

    // Send completion message
    const result = await sendSmsTemplate(
      'jobComplete',
      job.customer.phone_e164,
      {
        link: invoiceLink
      },
      {
        customerId: job.customer_id,
        jobId: job.id
      }
    )

    if (result.success) {
      // Update job
      await supabase
        .from('jobs')
        .update({
          completion_notification_sent_at: new Date().toISOString()
        })
        .eq('id', jobId)

      revalidatePath(`/jobs/${jobId}`)
    }

    return result
  } catch (error) {
    console.error('[SMS Action] Failed to send completion notification:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send notification'
    }
  }
}

/**
 * Server action to send bulk SMS campaign
 */
export async function sendBulkSmsAction(
  customerIds: string[],
  message: string,
  campaignName?: string
) {
  try {
    const supabase = await getServerSupabase()

    // Get customers with phone numbers
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, name, phone_e164, sms_notifications')
      .in('id', customerIds)
      .eq('sms_notifications', true)
      .not('phone_e164', 'is', null)

    if (error || !customers) {
      return { success: false, error: 'Failed to get customers' }
    }

    // Create campaign record if name provided
    let campaignId: string | undefined
    if (campaignName) {
      const { data: campaign } = await supabase
        .from('sms_campaigns')
        .insert({
          name: campaignName,
          message,
          total_recipients: customers.length,
          status: 'sending'
        })
        .select()
        .single()

      campaignId = campaign?.id
    }

    // Send messages
    const results = await Promise.all(
      customers.map(async (customer) => {
        const result = await sendSms({
          to: customer.phone_e164,
          message,
          customerId: customer.id,
          metadata: { campaignId }
        })

        // Log to campaign recipients if campaign exists
        if (campaignId) {
          await supabase
            .from('sms_campaign_recipients')
            .insert({
              campaign_id: campaignId,
              customer_id: customer.id,
              phone_number: customer.phone_e164,
              message_sid: result.sid,
              status: result.success ? 'sent' : 'failed',
              sent_at: result.success ? new Date().toISOString() : null,
              error_message: result.error
            })
        }

        return result
      })
    )

    // Update campaign status
    if (campaignId) {
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      await supabase
        .from('sms_campaigns')
        .update({
          status: 'completed',
          sent_at: new Date().toISOString(),
          messages_sent: successCount,
          messages_failed: failCount
        })
        .eq('id', campaignId)
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    revalidatePath('/sms')
    revalidatePath('/customers')

    return {
      success: true,
      sent: successCount,
      failed: failCount,
      total: customers.length
    }
  } catch (error) {
    console.error('[SMS Action] Failed to send bulk SMS:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send bulk SMS'
    }
  }
}

/**
 * Server action to get SMS statistics
 */
export async function getSmsStatisticsAction() {
  try {
    const supabase = await getServerSupabase()

    // Get message counts
    const { data: stats } = await supabase
      .from('sms_activity_daily')
      .select('*')
      .order('date', { ascending: false })
      .limit(30)

    // Get total counts
    const { count: totalMessages } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })

    const { count: totalInbound } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound')

    const { count: totalOutbound } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'outbound')

    const { count: uniqueCustomers } = await supabase
      .from('sms_messages')
      .select('customer_id', { count: 'exact', head: true })
      .not('customer_id', 'is', null)

    return {
      dailyStats: stats || [],
      totals: {
        messages: totalMessages || 0,
        inbound: totalInbound || 0,
        outbound: totalOutbound || 0,
        customers: uniqueCustomers || 0
      }
    }
  } catch (error) {
    console.error('[SMS Action] Failed to get statistics:', error)
    return {
      dailyStats: [],
      totals: {
        messages: 0,
        inbound: 0,
        outbound: 0,
        customers: 0
      }
    }
  }
}