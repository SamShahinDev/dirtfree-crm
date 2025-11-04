import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from 'twilio'

/**
 * Verifies Twilio webhook signature to ensure the request is authentic
 *
 * @param req - NextRequest object from the webhook
 * @param webhookUrlPath - The full URL path for this webhook (e.g., '/api/twilio/inbound')
 * @returns Promise<boolean> - true if signature is valid, false otherwise
 */
export async function verifyTwilioSignature(
  req: NextRequest,
  webhookUrlPath: string
): Promise<boolean> {
  try {
    // Get Auth Token from environment (used for signature verification)
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!authToken) {
      console.error('TWILIO_AUTH_TOKEN is not configured')
      return false
    }

    // Get the Twilio signature from headers
    const twilioSignature = req.headers.get('X-Twilio-Signature')
    if (!twilioSignature) {
      console.error('Missing X-Twilio-Signature header')
      return false
    }

    // Get the full URL for the webhook
    const url = new URL(req.url)
    const fullUrl = `${url.protocol}//${url.host}${webhookUrlPath}`

    // Get form data as key-value pairs for validation
    const formData = await req.formData()
    const params: Record<string, string> = {}

    for (const [key, value] of formData.entries()) {
      params[key] = value.toString()
    }

    // Validate the request using Twilio's helper
    const isValid = validateRequest(
      authToken,
      twilioSignature,
      fullUrl,
      params
    )

    if (!isValid) {
      console.error('Invalid Twilio signature', {
        url: fullUrl,
        hasSignature: !!twilioSignature,
        hasToken: !!authToken,
        paramsCount: Object.keys(params).length
      })
    }

    return isValid
  } catch (error) {
    console.error('Error verifying Twilio signature:', error)
    return false
  }
}

/**
 * Verifies Twilio webhook signature and throws 401 Response on failure
 *
 * @param req - NextRequest object from the webhook
 * @param urlPath - The URL path for this webhook (e.g., '/api/twilio/inbound')
 * @throws Response with 401 status on signature verification failure
 */
export async function verifyOr401(req: NextRequest, urlPath: string): Promise<void> {
  const isValid = await verifyTwilioSignature(req, urlPath)

  if (!isValid) {
    throw new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}