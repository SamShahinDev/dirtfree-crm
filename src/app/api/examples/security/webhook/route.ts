/**
 * Example: Webhook with Signature Verification
 *
 * Demonstrates how to protect webhook endpoints with signature verification.
 */

import { NextResponse } from 'next/server'
import { withWebhookVerification } from '@/lib/security/signature-verification'

export const POST = withWebhookVerification(
  async (req, payload) => {
    // Payload is verified and ready to process
    const data = JSON.parse(payload)

    console.log('Received verified webhook:', data)

    // Process the webhook...
    // For example, handle Stripe events, external notifications, etc.

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
    })
  },
  {
    secret: process.env.WEBHOOK_SECRET || 'your-webhook-secret',
    signatureHeader: 'x-webhook-signature',
    // Optional: Enable timestamp verification to prevent replay attacks
    timestampHeader: 'x-webhook-timestamp',
    timestampTolerance: 300, // 5 minutes
  }
)

export const dynamic = 'force-dynamic'
