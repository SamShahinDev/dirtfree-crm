import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireDispatcher } from '@/lib/auth/guards'
import { sendSms } from '@/lib/sms/twilio'
import { Templates, type TemplateKey } from '@/app/(comms)/templates'
import { recordApiLatency } from '@/lib/alerts/slo'

const SendSmsSchema = z.object({
  to: z.string().min(1, 'Phone number is required'),
  templateKey: z.string().optional(),
  ctx: z.object({
    customerName: z.string().optional(),
    jobDate: z.string().optional(),
    arrivalWindow: z.string().optional(),
    company: z.string().optional()
  }).optional(),
  body: z.string().optional(),
  customerId: z.string().optional(),
  jobId: z.string().optional()
})

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Require dispatcher+ role
    await requireDispatcher()

    // Parse and validate request body
    const body = await request.json()
    const validatedData = SendSmsSchema.parse(body)

    const { to, templateKey, ctx, body: rawBody, customerId, jobId } = validatedData

    let messageBody: string

    if (templateKey) {
      // Use template system
      if (!Object.keys(Templates).includes(templateKey)) {
        return NextResponse.json(
          { ok: false, error: 'Invalid template key' },
          { status: 400 }
        )
      }

      const template = Templates[templateKey as TemplateKey]
      messageBody = template(ctx || {})
    } else if (rawBody) {
      // Use raw body (trim to max length)
      messageBody = rawBody.trim().slice(0, 800)
    } else {
      return NextResponse.json(
        { ok: false, error: 'Either templateKey or body must be provided' },
        { status: 400 }
      )
    }

    // Send SMS
    const result = await sendSms({
      toE164: to,
      body: messageBody,
      customerId: customerId || null,
      jobId: jobId || null,
      templateKey: templateKey as TemplateKey || null
    })

    // Record API latency for SLO monitoring
    recordApiLatency(Date.now() - startTime)

    return NextResponse.json(result)
  } catch (error) {
    console.error('SMS send API error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.constructor.name : 'Unknown'
    })

    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (error instanceof Error && error.name === 'UnauthenticatedError') {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}