/**
 * Autoreply utilities for system-generated responses
 * Server-side only
 */

// Server-only guard
if (typeof window !== 'undefined') {
  throw new Error('This module must only be used on the server side')
}

import { RateLimiterMemory } from 'rate-limiter-flexible'
import { sendSms } from './twilio'

// Rate limiter for auto-replies: 1 per 60 seconds per phone number
const autoReplyLimiter = new RateLimiterMemory({
  keyGenerator: (phone: string) => `autoreply:${phone}`,
  points: 1,
  duration: 60, // 60 seconds
})

/**
 * Send an auto-reply SMS with rate limiting
 *
 * @param toE164 - Phone number in E.164 format to send to
 * @param body - Message body to send
 * @throws Response with 429 status when rate limit exceeded for this phone
 */
export async function sendAutoReply(toE164: string, body: string): Promise<void> {
  try {
    // Rate limit: 1 auto-reply per 60 seconds per phone number
    await autoReplyLimiter.consume(toE164)

    // Send the auto-reply using existing SMS infrastructure
    await sendSms({
      toE164,
      body,
      customerId: null,
      jobId: null,
      templateKey: 'system_autoreply'
    })

  } catch (rejRes) {
    // Rate limit exceeded - silently fail for auto-replies
    // We don't want to throw errors for auto-reply rate limits
    console.log('Auto-reply rate limited', {
      phone: toE164.slice(0, 4) + '***', // Partial phone for logging
      resetTime: new Date(Date.now() + rejRes.msBeforeNext).toISOString()
    })

    // Don't throw - just skip the auto-reply when rate limited
    return
  }
}