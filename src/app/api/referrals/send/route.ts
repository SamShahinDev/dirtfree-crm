import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateReferralCode, createReferralInvitation } from '@/lib/referrals/processor'
import { z } from 'zod'

/**
 * Send Referral Invitation API
 *
 * POST /api/referrals/send
 * Sends a referral invitation via email or SMS
 *
 * Authentication: Required
 */

const API_VERSION = 'v1'

const SendReferralSchema = z.object({
  customer_id: z.string().uuid(),
  recipient_email: z.string().email().optional(),
  recipient_phone: z.string().optional(),
  method: z.enum(['email', 'sms']),
  personal_message: z.string().optional(),
})

function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

function createSuccessResponse<T>(data: T) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() }
  )
}

/**
 * Send referral invitation via email
 */
async function sendReferralEmail(
  referrerName: string,
  recipientEmail: string,
  referralCode: string,
  referralLink: string,
  personalMessage?: string
): Promise<boolean> {
  try {
    // TODO: Integrate with email service (Resend/SendGrid)
    // For now, just log the email that would be sent
    console.log(`[Referrals] Email invitation:`, {
      to: recipientEmail,
      from: referrerName,
      subject: `${referrerName} sent you $20 off your first carpet cleaning!`,
      referralCode,
      referralLink,
      personalMessage,
    })

    // This will be implemented with email service integration
    // await sendEmail({
    //   to: recipientEmail,
    //   subject: `${referrerName} sent you $20 off!`,
    //   react: ReferralInvitationEmail({
    //     referrerName,
    //     referralCode,
    //     referralLink,
    //     personalMessage,
    //   }),
    // })

    return true
  } catch (error) {
    console.error('[Referrals] Send email error:', error)
    return false
  }
}

/**
 * Send referral invitation via SMS
 */
async function sendReferralSMS(
  referrerName: string,
  recipientPhone: string,
  referralCode: string,
  referralLink: string,
  personalMessage?: string
): Promise<boolean> {
  try {
    // TODO: Integrate with Twilio
    // For now, just log the SMS that would be sent
    const message = personalMessage
      ? `${referrerName}: ${personalMessage}\n\nGet $20 off your first carpet cleaning! Use code ${referralCode} or book here: ${referralLink}`
      : `${referrerName} sent you $20 off your first carpet cleaning! Use code ${referralCode} or book here: ${referralLink}`

    console.log(`[Referrals] SMS invitation:`, {
      to: recipientPhone,
      from: referrerName,
      message,
    })

    // This will be implemented with Twilio integration
    // await sendSMS({
    //   to: recipientPhone,
    //   message,
    // })

    return true
  } catch (error) {
    console.error('[Referrals] Send SMS error:', error)
    return false
  }
}

/**
 * POST - Send referral invitation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = SendReferralSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { customer_id, recipient_email, recipient_phone, method, personal_message } =
      validation.data

    // Validate recipient based on method
    if (method === 'email' && !recipient_email) {
      return createErrorResponse('validation_failed', 'Email is required for email method', 400)
    }
    if (method === 'sms' && !recipient_phone) {
      return createErrorResponse('validation_failed', 'Phone is required for SMS method', 400)
    }

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer not found', 404)
    }

    const referrerName = `${(customer as any).first_name} ${(customer as any).last_name}`

    // Get or create referral code
    const referralCode = await getOrCreateReferralCode(customer_id)
    if (!referralCode) {
      return createErrorResponse('server_error', 'Failed to get referral code', 500)
    }

    // Create referral invitation record
    const referralResult = await createReferralInvitation(
      customer_id,
      recipient_email,
      recipient_phone
    )

    if (!referralResult.success) {
      return createErrorResponse('create_failed', referralResult.message, 500)
    }

    // Generate referral link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dirtfree.com'
    const referralLink = `${appUrl}/book?ref=${referralCode}`

    // Send invitation
    let sent = false
    if (method === 'email' && recipient_email) {
      sent = await sendReferralEmail(
        referrerName,
        recipient_email,
        referralCode,
        referralLink,
        personal_message
      )
    } else if (method === 'sms' && recipient_phone) {
      sent = await sendReferralSMS(
        referrerName,
        recipient_phone,
        referralCode,
        referralLink,
        personal_message
      )
    }

    if (!sent) {
      return createErrorResponse('send_failed', 'Failed to send invitation', 500)
    }

    return createSuccessResponse({
      message: `Referral invitation sent via ${method}`,
      referral: referralResult.referral,
      method,
      sent_to: method === 'email' ? recipient_email : recipient_phone,
    })
  } catch (error) {
    console.error('[Send Referral API] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
