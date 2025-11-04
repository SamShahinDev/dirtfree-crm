/**
 * Review Request SMS Templates
 *
 * Concise SMS messages requesting customer feedback.
 * Optimized for character count and high engagement.
 */

export interface ReviewRequestSMSProps {
  customerName: string
  serviceType: string
  reviewUrl: string
}

/**
 * Standard review request SMS (for all customers)
 */
export function renderReviewRequestSMS({
  customerName,
  serviceType,
  reviewUrl,
}: ReviewRequestSMSProps): string {
  // SMS segment limits: 160 chars for single segment, 153 chars for multi-segment
  // Goal: Keep under 160 characters for single segment delivery

  const message = `Hi ${customerName}! Thanks for choosing Dirt Free for your ${serviceType} service. We'd love your feedback! ${reviewUrl}`

  return message
}

/**
 * High-value customer review request SMS (premium tone)
 */
export function renderHighValueReviewRequestSMS({
  customerName,
  serviceType,
  reviewUrl,
}: ReviewRequestSMSProps): string {
  const message = `${customerName}, thank you for being a valued Dirt Free customer! We'd appreciate your feedback on your recent ${serviceType}: ${reviewUrl}`

  return message
}

/**
 * Brief review request SMS (minimal length)
 */
export function renderBriefReviewRequestSMS({
  customerName,
  reviewUrl,
}: Omit<ReviewRequestSMSProps, 'serviceType'>): string {
  const message = `Hi ${customerName}! How was your recent Dirt Free service? Share your feedback: ${reviewUrl} - Thanks!`

  return message
}

/**
 * Review request SMS with Google mention
 */
export function renderGoogleReviewRequestSMS({
  customerName,
  reviewUrl,
}: Omit<ReviewRequestSMSProps, 'serviceType'>): string {
  const message = `${customerName}, thanks for choosing Dirt Free! Please share your experience & consider leaving a Google review: ${reviewUrl}`

  return message
}

/**
 * Calculate SMS segment count
 * Single segment: 160 chars
 * Multi-segment: 153 chars each
 */
export function calculateSMSSegments(message: string): number {
  const length = message.length

  if (length === 0) return 0
  if (length <= 160) return 1

  return Math.ceil(length / 153)
}

/**
 * Estimate SMS cost based on segment count
 * Typically $0.0075 - $0.01 per segment
 */
export function estimateReviewSMSCost(message: string): number {
  const segments = calculateSMSSegments(message)
  const costPerSegment = 0.0075 // $0.0075 per segment (Twilio pricing)

  return segments * costPerSegment
}

/**
 * Validate SMS message length
 */
export function validateReviewSMS(message: string): {
  valid: boolean
  segments: number
  length: number
  cost: number
  warning?: string
} {
  const length = message.length
  const segments = calculateSMSSegments(message)
  const cost = estimateReviewSMSCost(message)

  let warning: string | undefined

  if (length > 160) {
    warning = `Message will be sent as ${segments} segments (${length} chars)`
  }

  if (segments > 3) {
    warning = `Message is very long (${segments} segments, $${cost.toFixed(4)}). Consider shortening.`
  }

  return {
    valid: length > 0 && length <= 1600, // Max 1600 chars (10 segments)
    segments,
    length,
    cost,
    warning,
  }
}

/**
 * Get recommended SMS template based on customer profile
 */
export function getRecommendedTemplate(
  props: ReviewRequestSMSProps,
  isHighValue: boolean = false
): string {
  if (isHighValue) {
    return renderHighValueReviewRequestSMS(props)
  }

  return renderReviewRequestSMS(props)
}

/**
 * Preview SMS template with metadata
 */
export function previewReviewRequestSMS(
  props: ReviewRequestSMSProps,
  isHighValue: boolean = false
): {
  message: string
  segments: number
  length: number
  cost: number
  validation: ReturnType<typeof validateReviewSMS>
} {
  const message = getRecommendedTemplate(props, isHighValue)
  const validation = validateReviewSMS(message)

  return {
    message,
    segments: validation.segments,
    length: validation.length,
    cost: validation.cost,
    validation,
  }
}

/**
 * Example usage and templates
 */
export const REVIEW_SMS_EXAMPLES = {
  standard: (name: string, url: string) =>
    `Hi ${name}! Thanks for choosing Dirt Free. We'd love your feedback: ${url}`,

  withService: (name: string, service: string, url: string) =>
    `Hi ${name}! Thanks for your ${service} service. Rate your experience: ${url}`,

  premium: (name: string, url: string) =>
    `${name}, we appreciate your business! Share your Dirt Free experience: ${url}`,

  withGratitude: (name: string, url: string) =>
    `${name}, thank you for trusting Dirt Free! Your feedback helps us improve: ${url}`,

  urgent: (name: string, url: string) =>
    `Quick favor, ${name}? Rate your recent Dirt Free service: ${url} - Takes 30 seconds!`,
}

/**
 * Character count guidelines for SMS
 */
export const SMS_GUIDELINES = {
  SINGLE_SEGMENT_MAX: 160,
  MULTI_SEGMENT_MAX: 153,
  RECOMMENDED_MAX: 160,
  ABSOLUTE_MAX: 1600,

  tips: [
    'Keep under 160 characters for single segment delivery',
    'Use shortened URLs to save characters',
    'Avoid special characters that may require encoding',
    'Include clear call-to-action',
    'Add unsubscribe option for compliance',
  ],
} as const

/**
 * Add opt-out footer to SMS message
 */
export function addOptOutFooter(message: string): string {
  return `${message}\n\nReply STOP to opt out`
}

/**
 * Shorten URL for SMS (placeholder - would integrate with URL shortener)
 */
export function shortenReviewURL(url: string): string {
  // In production, integrate with bit.ly, TinyURL, or custom shortener
  // For now, return original URL
  return url
}
