import { NextRequest, NextResponse } from 'next/server'

import { verifyOr401 } from '@/lib/sms/verifyTwilio'
import { setOptOut, clearOptOut } from '@/lib/sms/optout'
import { normalizeToE164 } from '@/lib/utils/phone'
import { getServerSupabase } from '@/lib/supabase/server'
import { limitByIp, limitByPhone, getClientIp } from '@/lib/rate-limit/limiter'
import { sendAutoReply } from '@/lib/sms/autoreply'
import { recordInboundVerification } from '@/lib/alerts/slo'
import { log, createRequestContext } from '@/lib/obs/log'

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext(request)
  const logger = log.child(requestContext)
  let verificationSuccess = false

  try {
    // 1. Verify Twilio signature (throws 401 on failure)
    await verifyOr401(request, '/api/twilio/inbound')
    verificationSuccess = true

    // 2. Parse form data from Twilio
    const formData = await request.formData()
    const from = formData.get('From')?.toString()
    const to = formData.get('To')?.toString()
    const body = formData.get('Body')?.toString()
    const messageSid = formData.get('MessageSid')?.toString()

    if (!from || !to || !body || !messageSid) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 3. Normalize phone numbers
    const fromE164 = normalizeToE164(from)
    const toE164 = normalizeToE164(to)

    if (!fromE164 || !toE164) {
      return NextResponse.json({ error: 'Invalid phone numbers' }, { status: 400 })
    }

    // 4. Rate limiting
    const clientIp = getClientIp(request)
    await limitByIp(clientIp, 1, 60) // 60 requests per 60 seconds per IP
    await limitByPhone(fromE164, 1, 300) // 10 messages per 300 seconds per phone

    // 5. Get Supabase client
    const supabase = getServerSupabase()

    // 6. Idempotent logging - upsert by MessageSid
    const { data: existing } = await supabase
      .from('communication_logs')
      .select('id')
      .eq('provider_message_id', messageSid)
      .single()

    if (!existing) {
      // Insert new communication log
      await supabase
        .from('communication_logs')
        .insert({
          direction: 'inbound',
          to_e164: toE164,
          from_e164: fromE164,
          template_key: null,
          status: 'received',
          provider_message_id: messageSid,
          job_id: null,
          customer_id: null,
          body: {
            text: body,
            provider: 'twilio',
            webhook_processed: new Date().toISOString()
          }
        })
    }

    // 7. Handle keywords (case-insensitive, trimmed)
    const trimmedBody = body.trim().toUpperCase()

    if (['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT'].includes(trimmedBody)) {
      // Handle STOP command and synonyms
      await setOptOut(fromE164)
      await sendAutoReply(fromE164, "You're opted out. Reply START to opt in.")

    } else if (['START', 'YES', 'UNSTOP'].includes(trimmedBody)) {
      // Handle START command and opt-in synonyms
      await clearOptOut(fromE164)
      await sendAutoReply(fromE164, "You're opted in again.")

    } else if (trimmedBody === 'HELP') {
      // Handle HELP command
      await sendAutoReply(
        fromE164,
        "Dirt Free Support: reply STOP to opt out. For assistance call (555) 123-4567."
      )
    }
    // Otherwise: no autoreply for other messages

    // 8. Record successful verification for SLO tracking
    recordInboundVerification(true)

    // 9. Audit successful webhook processing
    logger.info('Inbound webhook processed successfully', {
      messageSid,
      verificationSuccess
    })

    // 10. Return success quickly
    return NextResponse.json({ ok: true })

  } catch (error) {
    // Record failed verification for SLO tracking
    recordInboundVerification(false)

    // Handle thrown Response objects (401, 429)
    if (error instanceof Response) {
      // Log verification failures for SLO monitoring
      if (error.status === 401) {
        logger.warn('Twilio signature verification failed', {
          status: error.status,
          verificationSuccess: false
        })
      } else if (error.status === 429) {
        logger.warn('Rate limit exceeded on inbound webhook', {
          status: error.status,
          verificationSuccess: false
        })
      }
      return error
    }

    // Log other errors without PII
    logger.error('Inbound webhook error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      verificationSuccess
    })

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}