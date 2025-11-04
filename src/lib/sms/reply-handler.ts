import { smsConfig } from './config'
import { getServerSupabase } from '@/lib/supabase/server'
import { sendSmsTemplate } from './service'

export interface IncomingSmsData {
  messageSid: string
  accountSid: string
  from: string
  to: string
  body: string
  numMedia: number
  mediaUrls: string[]
  status: string
}

/**
 * Process incoming SMS reply and generate appropriate response
 */
export async function processSmsReply(data: IncomingSmsData): Promise<string> {
  const messageBody = data.body.trim().toUpperCase()
  const phoneNumber = data.from

  try {
    // Log the incoming message
    await logInboundMessage(data)

    // Check for STOP/START commands first
    if (isCommand(messageBody, 'stop')) {
      await handleOptOut(phoneNumber)
      return generateTwiml(smsConfig.templates.stopConfirmation)
    }

    if (isCommand(messageBody, 'start')) {
      await handleOptIn(phoneNumber)
      return generateTwiml(smsConfig.templates.startConfirmation)
    }

    // Get customer by phone number
    const customer = await getCustomerByPhone(phoneNumber)

    if (!customer) {
      return generateTwiml(smsConfig.templates.noAppointment.replace('{phone}', smsConfig.companyInfo.phone))
    }

    // Handle HELP command
    if (isCommand(messageBody, 'help')) {
      return generateTwiml(smsConfig.templates.helpMessage.replace('{phone}', smsConfig.companyInfo.phone))
    }

    // Get customer's next appointment
    const appointment = await getNextAppointment(customer.id)

    if (!appointment) {
      return generateTwiml(smsConfig.templates.noAppointment.replace('{phone}', smsConfig.companyInfo.phone))
    }

    // Handle appointment-related commands
    if (isCommand(messageBody, 'confirm')) {
      await confirmAppointment(appointment.id)
      return generateTwiml('Your appointment has been confirmed. We will see you soon!')
    }

    if (isCommand(messageBody, 'reschedule')) {
      return generateTwiml(smsConfig.templates.rescheduleRequest.replace('{phone}', smsConfig.companyInfo.phone))
    }

    if (isCommand(messageBody, 'cancel')) {
      await cancelAppointment(appointment.id)
      const formattedDate = new Date(appointment.scheduled_date).toLocaleDateString()
      return generateTwiml(
        smsConfig.templates.appointmentCancelled
          .replace('{date}', formattedDate)
          .replace('{phone}', smsConfig.companyInfo.phone)
      )
    }

    // Handle payment command
    if (isCommand(messageBody, 'pay')) {
      const invoice = await getUnpaidInvoice(customer.id)
      if (invoice) {
        // In production, this would trigger payment processing
        return generateTwiml(`Invoice #${invoice.number} payment link: ${smsConfig.companyInfo.website}/pay/${invoice.id}`)
      }
      return generateTwiml('You have no outstanding invoices.')
    }

    // Handle feedback/ratings
    if (messageBody.match(/^[1-5]$/)) {
      await saveRating(customer.id, parseInt(messageBody))
      if (messageBody === '5') {
        return generateTwiml(smsConfig.templates.reviewRequest.replace('{link}', `${smsConfig.companyInfo.website}/review`))
      }
      return generateTwiml('Thank you for your feedback! We appreciate your response.')
    }

    // Default response for unrecognized commands
    return generateTwiml(smsConfig.templates.unknownCommand)

  } catch (error) {
    console.error('[SMS Reply Handler] Error processing reply:', error)
    return generateTwiml(smsConfig.templates.systemError.replace('{phone}', smsConfig.companyInfo.phone))
  }
}

/**
 * Check if message matches a command keyword
 */
function isCommand(message: string, commandKey: keyof typeof smsConfig.keywords): boolean {
  const keywords = smsConfig.keywords[commandKey]
  return keywords.some(keyword => message === keyword || message.startsWith(keyword + ' '))
}

/**
 * Generate TwiML response
 */
function generateTwiml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Message>${escapeXml(message)}</Message>
    </Response>`
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Log inbound SMS message to database
 */
async function logInboundMessage(data: IncomingSmsData) {
  const supabase = await getServerSupabase()

  // Get customer ID if exists
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('phone_e164', data.from)
    .single()

  const { error } = await supabase.from('sms_messages').insert({
    sid: data.messageSid,
    to_number: data.to,
    from_number: data.from,
    body: data.body,
    direction: 'inbound',
    status: 'received',
    customer_id: customer?.id,
    metadata: {
      numMedia: data.numMedia,
      mediaUrls: data.mediaUrls
    }
  })

  if (error) {
    console.error('[SMS Reply Handler] Failed to log inbound message:', error)
  }
}

/**
 * Get customer by phone number
 */
async function getCustomerByPhone(phoneNumber: string) {
  const supabase = await getServerSupabase()
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('phone_e164', phoneNumber)
    .single()

  return data
}

/**
 * Get customer's next appointment
 */
async function getNextAppointment(customerId: string) {
  const supabase = await getServerSupabase()
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'scheduled')
    .gte('scheduled_date', new Date().toISOString())
    .order('scheduled_date', { ascending: true })
    .limit(1)
    .single()

  return data
}

/**
 * Confirm an appointment
 */
async function confirmAppointment(jobId: string) {
  const supabase = await getServerSupabase()
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'confirmed',
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)

  if (error) {
    console.error('[SMS Reply Handler] Failed to confirm appointment:', error)
  }
}

/**
 * Cancel an appointment
 */
async function cancelAppointment(jobId: string) {
  const supabase = await getServerSupabase()
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)

  if (error) {
    console.error('[SMS Reply Handler] Failed to cancel appointment:', error)
  }
}

/**
 * Handle SMS opt-out
 */
async function handleOptOut(phoneNumber: string) {
  const supabase = await getServerSupabase()

  // Update customer preferences
  await supabase
    .from('customers')
    .update({ sms_notifications: false })
    .eq('phone_e164', phoneNumber)

  // Add to opt-out list
  await supabase
    .from('sms_opt_outs')
    .upsert({
      phone_number: phoneNumber,
      opted_out_at: new Date().toISOString(),
      is_active: true
    }, { onConflict: 'phone_number' })
}

/**
 * Handle SMS opt-in
 */
async function handleOptIn(phoneNumber: string) {
  const supabase = await getServerSupabase()

  // Update customer preferences
  await supabase
    .from('customers')
    .update({ sms_notifications: true })
    .eq('phone_e164', phoneNumber)

  // Update opt-out record
  await supabase
    .from('sms_opt_outs')
    .update({
      opted_in_at: new Date().toISOString(),
      is_active: false
    })
    .eq('phone_number', phoneNumber)
}

/**
 * Get unpaid invoice for customer
 */
async function getUnpaidInvoice(customerId: string) {
  const supabase = await getServerSupabase()
  const { data } = await supabase
    .from('invoices')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data
}

/**
 * Save customer rating
 */
async function saveRating(customerId: string, rating: number) {
  const supabase = await getServerSupabase()

  // Get the most recent completed job
  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  if (job) {
    await supabase
      .from('jobs')
      .update({
        customer_rating: rating,
        rating_received_at: new Date().toISOString()
      })
      .eq('id', job.id)
  }

  // Update customer record with latest rating
  await supabase
    .from('customers')
    .update({
      last_rating: rating,
      last_rating_date: new Date().toISOString()
    })
    .eq('id', customerId)
}

/**
 * Process reschedule request with suggested times
 */
export async function processRescheduleRequest(
  customerId: string,
  jobId: string,
  suggestedTimes: string
): Promise<string> {
  // In production, this would parse the suggested times and create a rescheduling request
  // For now, we'll just log it and send a confirmation
  const supabase = await getServerSupabase()

  await supabase
    .from('jobs')
    .update({
      reschedule_request: suggestedTimes,
      reschedule_requested_at: new Date().toISOString()
    })
    .eq('id', jobId)

  return 'We received your reschedule request. Our team will contact you shortly to confirm a new time.'
}