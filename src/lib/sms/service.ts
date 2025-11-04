import { smsConfig } from './config'
import { getServerSupabase } from '@/lib/supabase/server'

// Mock Twilio client for development
class MockTwilioClient {
  messages = {
    create: async (options: any) => {
      console.log('[SMS Mock] Sending message:', {
        to: options.to,
        from: options.from,
        body: options.body.substring(0, 50) + '...'
      })
      return {
        sid: 'MOCK_' + Math.random().toString(36).substr(2, 9),
        status: 'sent',
        to: options.to,
        from: options.from,
        body: options.body,
        dateCreated: new Date(),
        price: '0.00',
        priceUnit: 'USD'
      }
    }
  }

  // Mock webhook validation
  validateRequest = () => true
}

// Initialize Twilio client (use mock if not configured)
let twilioClient: any

if (smsConfig.enableSms && smsConfig.twilioAccountSid !== 'AC_PLACEHOLDER_ACCOUNT_SID') {
  try {
    const twilio = require('twilio')
    twilioClient = twilio(smsConfig.twilioAccountSid, smsConfig.twilioAuthToken)
    console.log('[SMS] Twilio client initialized')
  } catch (error) {
    console.warn('[SMS] Twilio not available, using mock client')
    twilioClient = new MockTwilioClient()
  }
} else {
  twilioClient = new MockTwilioClient()
  console.log('[SMS] Using mock SMS client (development mode)')
}

export interface SendSmsOptions {
  to: string
  message: string
  customerId?: string
  jobId?: string
  technicianId?: string
  metadata?: Record<string, any>
}

export interface SmsResult {
  success: boolean
  sid?: string
  error?: string
  mock?: boolean
}

/**
 * Send an SMS message
 */
export async function sendSms({
  to,
  message,
  customerId,
  jobId,
  technicianId,
  metadata
}: SendSmsOptions): Promise<SmsResult> {
  try {
    // Format phone number
    const formattedTo = formatPhoneForSms(to)

    // Check if phone number is valid
    if (!isValidPhoneNumber(formattedTo)) {
      console.error('[SMS] Invalid phone number:', formattedTo)
      return { success: false, error: 'Invalid phone number' }
    }

    // Check rate limiting
    const rateLimitOk = await checkRateLimit(formattedTo)
    if (!rateLimitOk) {
      console.warn('[SMS] Rate limit exceeded for:', formattedTo)
      return { success: false, error: 'Rate limit exceeded' }
    }

    // Send via Twilio or mock
    const result = await twilioClient.messages.create({
      body: message,
      from: smsConfig.twilioPhoneNumber,
      to: formattedTo,
      statusCallback: smsConfig.smsWebhookUrl + '/status'
    })

    // Log the message to database
    await logSmsMessage({
      sid: result.sid,
      to_number: formattedTo,
      from_number: smsConfig.twilioPhoneNumber,
      body: message,
      direction: 'outbound',
      status: result.status,
      customer_id: customerId,
      job_id: jobId,
      technician_id: technicianId,
      metadata,
      price: result.price,
      price_unit: result.priceUnit
    })

    console.log('[SMS] Message sent successfully:', result.sid)
    return {
      success: true,
      sid: result.sid,
      mock: !smsConfig.enableSms
    }
  } catch (error) {
    console.error('[SMS] Failed to send message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS'
    }
  }
}

/**
 * Send SMS using a template
 */
export async function sendSmsTemplate(
  templateKey: keyof typeof smsConfig.templates,
  to: string,
  variables: Record<string, string>,
  options?: Omit<SendSmsOptions, 'to' | 'message'>
): Promise<SmsResult> {
  const template = smsConfig.templates[templateKey]
  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  // Replace variables in template
  let message = template
  Object.entries(variables).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value)
  })

  // Add company phone to common variables
  message = message.replace(/{phone}/g, smsConfig.companyInfo.phone)

  return sendSms({
    to,
    message,
    ...options
  })
}

/**
 * Format phone number for SMS (E.164 format)
 */
export function formatPhoneForSms(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')

  // Handle US numbers
  if (digits.length === 10) {
    return `+1${digits}`
  } else if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`
  }

  // If already has country code
  if (digits.length > 10) {
    return `+${digits}`
  }

  // Return as-is if format unclear
  return phone.startsWith('+') ? phone : `+${digits}`
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  // Basic E.164 validation
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phone)
}

/**
 * Check rate limiting for a phone number
 */
async function checkRateLimit(phoneNumber: string): Promise<boolean> {
  const supabase = await getServerSupabase()
  const now = new Date()
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Count messages in last hour
  const { count: hourCount } = await supabase
    .from('sms_messages')
    .select('*', { count: 'exact', head: true })
    .eq('to_number', phoneNumber)
    .gte('created_at', hourAgo.toISOString())

  if ((hourCount || 0) >= smsConfig.maxMessagesPerHour) {
    return false
  }

  // Count messages in last day
  const { count: dayCount } = await supabase
    .from('sms_messages')
    .select('*', { count: 'exact', head: true })
    .eq('to_number', phoneNumber)
    .gte('created_at', dayAgo.toISOString())

  if ((dayCount || 0) >= smsConfig.maxMessagesPerDay) {
    return false
  }

  return true
}

/**
 * Log SMS message to database
 */
async function logSmsMessage(data: {
  sid: string
  to_number: string
  from_number: string
  body: string
  direction: 'inbound' | 'outbound'
  status: string
  customer_id?: string
  job_id?: string
  technician_id?: string
  metadata?: any
  price?: string
  price_unit?: string
}) {
  try {
    const supabase = await getServerSupabase()
    const { error } = await supabase.from('sms_messages').insert({
      sid: data.sid,
      to_number: data.to_number,
      from_number: data.from_number,
      body: data.body,
      direction: data.direction,
      status: data.status,
      customer_id: data.customer_id,
      job_id: data.job_id,
      technician_id: data.technician_id,
      metadata: data.metadata,
      price: data.price ? parseFloat(data.price) : null,
      price_unit: data.price_unit,
      created_at: new Date().toISOString()
    })

    if (error) {
      console.error('[SMS] Failed to log message:', error)
    }
  } catch (error) {
    console.error('[SMS] Error logging message:', error)
  }
}

/**
 * Get SMS conversation history
 */
export async function getSmsConversation(
  customerId: string,
  limit: number = 50
) {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[SMS] Failed to get conversation:', error)
    return []
  }

  // Reverse to show oldest first in UI
  return (data || []).reverse()
}

/**
 * Update SMS message status (from webhook)
 */
export async function updateSmsStatus(sid: string, status: string) {
  const supabase = await getServerSupabase()
  const { error } = await supabase
    .from('sms_messages')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('sid', sid)

  if (error) {
    console.error('[SMS] Failed to update status:', error)
  }
}

/**
 * Check if customer has opted out of SMS
 */
export async function isCustomerOptedOut(customerId: string): Promise<boolean> {
  const supabase = await getServerSupabase()
  const { data } = await supabase
    .from('customers')
    .select('sms_notifications')
    .eq('id', customerId)
    .single()

  return data?.sms_notifications === false
}

/**
 * Send appointment reminder SMS
 */
export async function sendAppointmentReminder(
  customerId: string,
  jobId: string,
  appointmentDate: string,
  appointmentTime: string,
  services: string[]
) {
  const supabase = await getServerSupabase()

  // Get customer details
  const { data: customer } = await supabase
    .from('customers')
    .select('name, phone_e164')
    .eq('id', customerId)
    .single()

  if (!customer?.phone_e164) {
    console.log('[SMS] No phone number for customer:', customerId)
    return { success: false, error: 'No phone number' }
  }

  // Check opt-out status
  if (await isCustomerOptedOut(customerId)) {
    console.log('[SMS] Customer opted out:', customerId)
    return { success: false, error: 'Customer opted out' }
  }

  return sendSmsTemplate(
    'appointmentReminder',
    customer.phone_e164,
    {
      name: customer.name,
      date: appointmentDate,
      time: appointmentTime,
      services: services.join(', ')
    },
    {
      customerId,
      jobId
    }
  )
}

// Export utilities
export { logSmsMessage, twilioClient }