/**
 * Promotion SMS Template
 *
 * Concise SMS template for delivering promotional offers to customers.
 * Optimized for SMS character limits with essential information only.
 */

interface PromotionSMSProps {
  customerName: string
  promotion: {
    promotionId: string
    title: string
    promotionType: string
    discountValue?: number
    discountPercentage?: number
    promoCode?: string
    endDate: string
  }
  claimCode: string
}

/**
 * Render promotion SMS message
 *
 * SMS best practices:
 * - Keep under 160 characters for single segment (if possible)
 * - Include essential info: discount, promo code, expiration, link
 * - Use URL shortener for links
 * - Clear call to action
 */
export function renderPromotionSMS({
  customerName,
  promotion,
  claimCode,
}: PromotionSMSProps): string {
  // Format discount display
  const getDiscountDisplay = () => {
    if (promotion.promotionType === 'percentage_off' && promotion.discountPercentage) {
      return `${promotion.discountPercentage}% OFF`
    }
    if (promotion.promotionType === 'dollar_off' && promotion.discountValue) {
      return `$${promotion.discountValue} OFF`
    }
    return 'Special Offer'
  }

  // Format date (short format for SMS)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
    })
  }

  // Create claim URL with deep link support
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dirtfree.com'
  const claimUrl = `${baseUrl}/dashboard/promotions/claim?code=${claimCode}`

  // Get first name only to save space
  const firstName = customerName.split(' ')[0]

  // Build SMS message
  const discount = getDiscountDisplay()
  const expiryDate = formatDate(promotion.endDate)

  // Option 1: With promo code (longer)
  if (promotion.promoCode) {
    return `Hi ${firstName}! Exclusive offer: ${discount} on your next service! Code: ${promotion.promoCode}. Claim now: ${claimUrl} Expires ${expiryDate}. Reply STOP to opt out.`
  }

  // Option 2: Without promo code (shorter)
  return `Hi ${firstName}! Exclusive offer: ${discount} on your next service! Claim: ${claimUrl} Code: ${claimCode}. Expires ${expiryDate}. Reply STOP to opt out.`
}

/**
 * Calculate SMS segments for a message
 *
 * SMS segment calculation:
 * - Single segment: up to 160 characters (GSM-7) or 70 characters (UCS-2/Unicode)
 * - Multi-segment: 153 characters per segment (GSM-7) or 67 characters (UCS-2)
 */
export function calculateSMSSegments(message: string): number {
  // Check if message contains non-GSM characters
  const gsmRegex = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/
  const isGSM = gsmRegex.test(message)

  const length = message.length

  if (isGSM) {
    // GSM-7 encoding
    if (length <= 160) {
      return 1
    }
    return Math.ceil(length / 153)
  } else {
    // UCS-2/Unicode encoding
    if (length <= 70) {
      return 1
    }
    return Math.ceil(length / 67)
  }
}

/**
 * Estimate SMS cost for a message
 */
export function estimateSMSCost(message: string, costPerSegment = 0.0079): number {
  const segments = calculateSMSSegments(message)
  return segments * costPerSegment
}

/**
 * Validate SMS message length
 */
export function validateSMSMessage(message: string): {
  valid: boolean
  segments: number
  length: number
  cost: number
  warnings: string[]
} {
  const segments = calculateSMSSegments(message)
  const length = message.length
  const cost = estimateSMSCost(message)
  const warnings: string[] = []

  // Add warnings
  if (segments > 3) {
    warnings.push('Message is longer than 3 segments. Consider shortening.')
  }

  if (segments > 1 && segments <= 3) {
    warnings.push(`Message will be sent as ${segments} segments.`)
  }

  if (length > 320) {
    warnings.push('Message is very long. Consider using email instead.')
  }

  // Check for opt-out language
  if (!message.toLowerCase().includes('stop') && !message.toLowerCase().includes('opt out')) {
    warnings.push('Consider including opt-out instructions (e.g., "Reply STOP to opt out").')
  }

  return {
    valid: true, // Could add stricter validation rules here
    segments,
    length,
    cost,
    warnings,
  }
}

/**
 * Generate short promotion SMS (optimized for single segment)
 */
export function renderShortPromotionSMS({
  promotion,
  claimCode,
}: Omit<PromotionSMSProps, 'customerName'>): string {
  const getDiscountDisplay = () => {
    if (promotion.promotionType === 'percentage_off' && promotion.discountPercentage) {
      return `${promotion.discountPercentage}% OFF`
    }
    if (promotion.promotionType === 'dollar_off' && promotion.discountValue) {
      return `$${promotion.discountValue} OFF`
    }
    return 'SPECIAL OFFER'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dirtfree.com'
  const claimUrl = `${baseUrl}/promo/${claimCode}`

  const discount = getDiscountDisplay()
  const expiryDate = formatDate(promotion.endDate)

  if (promotion.promoCode) {
    return `${discount} on next service! Code: ${promotion.promoCode}. ${claimUrl} Exp: ${expiryDate}. STOP to opt out.`
  }

  return `${discount}! ${claimUrl} Code: ${claimCode}. Exp: ${expiryDate}. STOP to opt out.`
}
