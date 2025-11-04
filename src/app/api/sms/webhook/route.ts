import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { processSmsReply } from '@/lib/sms/reply-handler'
import { updateSmsStatus, twilioClient } from '@/lib/sms/service'
import { smsConfig } from '@/lib/sms/config'

/**
 * Handle incoming SMS messages from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const headersList = headers()

    // Extract webhook data
    const messageData = {
      messageSid: formData.get('MessageSid') as string,
      accountSid: formData.get('AccountSid') as string,
      from: formData.get('From') as string,
      to: formData.get('To') as string,
      body: formData.get('Body') as string,
      numMedia: parseInt(formData.get('NumMedia') as string || '0'),
      mediaUrls: [] as string[],
      status: formData.get('SmsStatus') as string,
    }

    // Get media URLs if present
    for (let i = 0; i < messageData.numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`) as string
      if (mediaUrl) {
        messageData.mediaUrls.push(mediaUrl)
      }
    }

    // Validate webhook signature (for production)
    if (smsConfig.enableSms && smsConfig.twilioWebhookSecret) {
      const signature = headersList.get('x-twilio-signature')
      const url = `${request.url}`

      // Convert FormData to object for validation
      const params: Record<string, string> = {}
      formData.forEach((value, key) => {
        params[key] = value.toString()
      })

      const isValid = validateTwilioSignature(
        smsConfig.twilioAuthToken,
        signature || '',
        url,
        params
      )

      if (!isValid) {
        console.error('[SMS Webhook] Invalid signature')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.log('[SMS Webhook] Received message:', {
      from: messageData.from,
      to: messageData.to,
      body: messageData.body.substring(0, 50) + '...',
      hasMedia: messageData.numMedia > 0
    })

    // Process the incoming message and get response
    const responseXml = await processSmsReply(messageData)

    // Return TwiML response
    return new NextResponse(responseXml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error) {
    console.error('[SMS Webhook] Error processing webhook:', error)

    // Return error TwiML
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>Sorry, we're having trouble processing your message. Please try again or call ${smsConfig.companyInfo.phone}.</Message>
      </Response>`

    return new NextResponse(errorXml, {
      status: 200, // Return 200 to prevent Twilio retries
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}

/**
 * Handle SMS status updates from Twilio
 */
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData()

    const statusData = {
      messageSid: formData.get('MessageSid') as string,
      messageStatus: formData.get('MessageStatus') as string,
      errorCode: formData.get('ErrorCode') as string,
      errorMessage: formData.get('ErrorMessage') as string,
    }

    console.log('[SMS Webhook] Status update:', statusData)

    // Update message status in database
    await updateSmsStatus(statusData.messageSid, statusData.messageStatus)

    // If there's an error, log it
    if (statusData.errorCode) {
      console.error('[SMS Webhook] Message error:', {
        sid: statusData.messageSid,
        errorCode: statusData.errorCode,
        errorMessage: statusData.errorMessage
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SMS Webhook] Error processing status update:', error)
    return NextResponse.json(
      { error: 'Failed to process status update' },
      { status: 500 }
    )
  }
}

/**
 * Validate Twilio webhook signature
 */
function validateTwilioSignature(
  authToken: string,
  twilioSignature: string,
  url: string,
  params: Record<string, string>
): boolean {
  try {
    if (!smsConfig.enableSms || !twilioClient.validateRequest) {
      return true // Skip validation in development
    }

    // Sort parameters alphabetically
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key]
        return acc
      }, {} as Record<string, string>)

    // Validate using Twilio client
    return twilioClient.validateRequest(
      authToken,
      twilioSignature,
      url,
      sortedParams
    )
  } catch (error) {
    console.error('[SMS Webhook] Signature validation error:', error)
    return false
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    smsEnabled: smsConfig.enableSms,
    webhookUrl: smsConfig.smsWebhookUrl,
    timestamp: new Date().toISOString()
  })
}