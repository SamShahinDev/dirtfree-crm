import { NextRequest, NextResponse } from 'next/server'

import { verifyOr401 } from '@/lib/sms/verifyTwilio'
import { getServerSupabase } from '@/lib/supabase/server'
import { recordApiLatency } from '@/lib/alerts/slo'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Verify Twilio signature (throws 401 on failure)
    await verifyOr401(request, '/api/twilio/status')

    // 2. Parse form data from Twilio
    const formData = await request.formData()
    const messageSid = formData.get('MessageSid')?.toString()
    const messageStatus = formData.get('MessageStatus')?.toString()
    const errorCode = formData.get('ErrorCode')?.toString()
    const errorMessage = formData.get('ErrorMessage')?.toString()

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 3. Get Supabase client
    const supabase = getServerSupabase()

    // 4. Idempotent upsert by MessageSid
    // Check if record exists first
    const { data: existing } = await supabase
      .from('communication_logs')
      .select('id, body, status')
      .eq('provider_message_id', messageSid)
      .single()

    if (existing) {
      // Record exists - update status and append errors
      const currentBody = existing.body || {}
      const updateData: {
        status: string
        body?: Record<string, unknown>
      } = {
        status: messageStatus
      }

      // Append error information if present
      if (errorCode || errorMessage) {
        updateData.body = {
          ...currentBody,
          errorCode: errorCode || undefined,
          errorMessage: errorMessage || undefined,
          lastStatusUpdate: new Date().toISOString()
        }
      }

      await supabase
        .from('communication_logs')
        .update(updateData)
        .eq('provider_message_id', messageSid)

    } else {
      // Record doesn't exist (late webhook) - create minimal row
      const insertData = {
        direction: 'outbound' as const,
        to_e164: '', // Will be populated when we get more info
        from_e164: process.env.TWILIO_PHONE_NUMBER || '',
        template_key: null,
        status: messageStatus,
        provider_message_id: messageSid,
        job_id: null,
        customer_id: null,
        body: {
          provider: 'twilio',
          late_webhook: true,
          created_from_status: new Date().toISOString(),
          ...(errorCode || errorMessage ? {
            errorCode: errorCode || undefined,
            errorMessage: errorMessage || undefined
          } : {})
        }
      }

      await supabase
        .from('communication_logs')
        .insert(insertData)
    }

    // 5. Record API latency for SLO monitoring
    recordApiLatency(Date.now() - startTime)

    // 6. Return success quickly
    return NextResponse.json({ ok: true })

  } catch (error) {
    // Handle thrown Response objects (401)
    if (error instanceof Response) {
      return error
    }

    // Log errors without PII
    console.error('Status webhook error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}