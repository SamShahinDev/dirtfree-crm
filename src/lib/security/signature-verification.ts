/**
 * Webhook Signature Verification
 *
 * Provides cryptographic signature verification for webhooks to ensure
 * requests are authentic and haven't been tampered with.
 *
 * @module lib/security/signature-verification
 */

import crypto from 'crypto'

/**
 * Verify webhook signature using HMAC SHA-256
 *
 * This uses timing-safe comparison to prevent timing attacks.
 *
 * @param payload - The raw request body as a string
 * @param signature - The signature from the request header (hex string)
 * @param secret - The webhook secret used to sign the payload
 * @returns true if signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * const payload = await req.text()
 * const signature = req.headers.get('x-webhook-signature')
 * const isValid = verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)
 * ```
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false
  }

  try {
    // Compute expected signature
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    )

    return isValid
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}

/**
 * Verify webhook signature with multiple possible secrets
 *
 * Useful for secret rotation - try current secret first, then old secret.
 *
 * @param payload - The raw request body as a string
 * @param signature - The signature from the request header
 * @param secrets - Array of possible secrets (current first, then older ones)
 * @returns true if signature matches any secret, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = verifyWebhookSignatureWithRotation(
 *   payload,
 *   signature,
 *   [process.env.WEBHOOK_SECRET, process.env.WEBHOOK_SECRET_OLD]
 * )
 * ```
 */
export function verifyWebhookSignatureWithRotation(
  payload: string,
  signature: string | null,
  secrets: string[]
): boolean {
  if (!signature) {
    return false
  }

  // Try each secret in order (current first)
  for (const secret of secrets) {
    if (verifyWebhookSignature(payload, signature, secret)) {
      return true
    }
  }

  return false
}

/**
 * Generate webhook signature for outgoing webhooks
 *
 * Use this when sending webhooks to external services.
 *
 * @param payload - The request body to sign
 * @param secret - The secret key to use for signing
 * @returns The hex-encoded HMAC signature
 *
 * @example
 * ```typescript
 * const payload = JSON.stringify(data)
 * const signature = generateWebhookSignature(payload, process.env.WEBHOOK_SECRET)
 *
 * await fetch(webhookUrl, {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-Webhook-Signature': signature
 *   },
 *   body: payload
 * })
 * ```
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verify webhook signature with timestamp to prevent replay attacks
 *
 * @param payload - The raw request body
 * @param signature - The signature from the header
 * @param timestamp - The timestamp from the header (Unix timestamp in seconds)
 * @param secret - The webhook secret
 * @param toleranceSeconds - Maximum age of the request in seconds (default: 300 = 5 minutes)
 * @returns Object with validation result and reason if invalid
 *
 * @example
 * ```typescript
 * const result = verifyWebhookSignatureWithTimestamp(
 *   payload,
 *   signature,
 *   timestamp,
 *   secret,
 *   300 // 5 minutes tolerance
 * )
 *
 * if (!result.valid) {
 *   console.log('Invalid:', result.reason)
 * }
 * ```
 */
export function verifyWebhookSignatureWithTimestamp(
  payload: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  toleranceSeconds: number = 300
): { valid: boolean; reason?: string } {
  if (!signature) {
    return { valid: false, reason: 'Missing signature' }
  }

  if (!timestamp) {
    return { valid: false, reason: 'Missing timestamp' }
  }

  // Parse timestamp
  const timestampNum = parseInt(timestamp, 10)
  if (isNaN(timestampNum)) {
    return { valid: false, reason: 'Invalid timestamp format' }
  }

  // Check if timestamp is within tolerance
  const currentTime = Math.floor(Date.now() / 1000)
  const age = currentTime - timestampNum

  if (age > toleranceSeconds) {
    return { valid: false, reason: 'Timestamp too old (replay attack?)' }
  }

  if (age < -toleranceSeconds) {
    return { valid: false, reason: 'Timestamp from the future' }
  }

  // Verify signature includes timestamp to prevent replay attacks
  const signedPayload = `${timestamp}.${payload}`
  const isValid = verifyWebhookSignature(signedPayload, signature, secret)

  if (!isValid) {
    return { valid: false, reason: 'Invalid signature' }
  }

  return { valid: true }
}

/**
 * Generate webhook signature with timestamp
 *
 * @param payload - The request body
 * @param secret - The secret key
 * @param timestamp - Optional timestamp (defaults to current time)
 * @returns Object with signature and timestamp
 *
 * @example
 * ```typescript
 * const { signature, timestamp } = generateWebhookSignatureWithTimestamp(
 *   JSON.stringify(data),
 *   secret
 * )
 *
 * await fetch(url, {
 *   headers: {
 *     'X-Webhook-Signature': signature,
 *     'X-Webhook-Timestamp': timestamp
 *   },
 *   body: payload
 * })
 * ```
 */
export function generateWebhookSignatureWithTimestamp(
  payload: string,
  secret: string,
  timestamp?: number
): { signature: string; timestamp: string } {
  const ts = timestamp || Math.floor(Date.now() / 1000)
  const timestampStr = ts.toString()
  const signedPayload = `${timestampStr}.${payload}`
  const signature = generateWebhookSignature(signedPayload, secret)

  return { signature, timestamp: timestampStr }
}

/**
 * Middleware wrapper for webhook endpoints with signature verification
 *
 * @param handler - The webhook handler function
 * @param options - Verification options
 * @returns Wrapped handler with signature verification
 *
 * @example
 * ```typescript
 * export const POST = withWebhookVerification(
 *   async (req, payload) => {
 *     // Process webhook with verified payload
 *     return NextResponse.json({ success: true })
 *   },
 *   {
 *     secret: process.env.STRIPE_WEBHOOK_SECRET,
 *     signatureHeader: 'stripe-signature',
 *     timestampTolerance: 300
 *   }
 * )
 * ```
 */
export interface WebhookVerificationOptions {
  /**
   * The secret key to verify signatures
   */
  secret: string

  /**
   * The header name containing the signature (default: 'x-webhook-signature')
   */
  signatureHeader?: string

  /**
   * The header name containing the timestamp (optional)
   */
  timestampHeader?: string

  /**
   * Maximum age of request in seconds (default: 300)
   */
  timestampTolerance?: number

  /**
   * Multiple secrets for rotation (optional)
   */
  secrets?: string[]
}

export function withWebhookVerification(
  handler: (req: Request, payload: string) => Promise<Response> | Response,
  options: WebhookVerificationOptions
) {
  return async (req: Request): Promise<Response> => {
    try {
      // Get the raw payload
      const payload = await req.text()

      // Get signature from headers
      const signatureHeader = options.signatureHeader || 'x-webhook-signature'
      const signature = req.headers.get(signatureHeader)

      if (!signature) {
        return new Response(
          JSON.stringify({ error: 'Missing webhook signature' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // If timestamp verification is enabled
      if (options.timestampHeader) {
        const timestamp = req.headers.get(options.timestampHeader)
        const result = verifyWebhookSignatureWithTimestamp(
          payload,
          signature,
          timestamp,
          options.secret,
          options.timestampTolerance
        )

        if (!result.valid) {
          return new Response(
            JSON.stringify({ error: 'Invalid webhook signature', reason: result.reason }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      } else {
        // Simple signature verification
        const isValid = options.secrets
          ? verifyWebhookSignatureWithRotation(payload, signature, options.secrets)
          : verifyWebhookSignature(payload, signature, options.secret)

        if (!isValid) {
          return new Response(
            JSON.stringify({ error: 'Invalid webhook signature' }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }
      }

      // Signature is valid - call the handler
      return await handler(req, payload)
    } catch (error) {
      console.error('Error in webhook verification:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
}
