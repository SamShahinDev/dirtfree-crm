/**
 * Opportunity Offer SMS Templates
 *
 * Brief, action-oriented SMS messages for opportunity offers.
 * Keeps messages under 160 characters when possible.
 */

export interface OpportunityOfferSMSProps {
  customerName: string
  opportunityType: string
  discountPercentage: number
  offerCode: string
  expirationDays: number
  claimUrl: string
}

/**
 * SMS messages by opportunity type
 */
const SMS_MESSAGES: Record<string, (props: OpportunityOfferSMSProps) => string> = {
  declined_service: (props) =>
    `Hi ${props.customerName}! We'd love another chance to serve you. Get ${props.discountPercentage}% OFF with code ${props.offerCode}. Expires in ${props.expirationDays} days. Claim now: ${props.claimUrl}`,

  price_objection: (props) =>
    `${props.customerName}, special pricing just for you! Save ${props.discountPercentage}% with code ${props.offerCode}. Valid ${props.expirationDays} days. Book now: ${props.claimUrl}`,

  postponed_booking: (props) =>
    `Ready to schedule, ${props.customerName}? We're offering ${props.discountPercentage}% OFF! Use code ${props.offerCode} (expires in ${props.expirationDays} days): ${props.claimUrl}`,

  partial_booking: (props) =>
    `Thanks for your recent service! Complete your cleaning with ${props.discountPercentage}% OFF. Code: ${props.offerCode}. ${props.expirationDays} days left: ${props.claimUrl}`,

  competitor_mention: (props) =>
    `Let us earn your business! ${props.discountPercentage}% OFF with code ${props.offerCode}. Expires in ${props.expirationDays} days. Claim offer: ${props.claimUrl}`,

  service_upsell: (props) =>
    `Exclusive offer for you! Get ${props.discountPercentage}% OFF additional services. Code: ${props.offerCode} (${props.expirationDays} days): ${props.claimUrl}`,
}

/**
 * Default SMS template
 */
const DEFAULT_SMS = (props: OpportunityOfferSMSProps) =>
  `Hi ${props.customerName}! Exclusive offer: ${props.discountPercentage}% OFF with code ${props.offerCode}. Valid ${props.expirationDays} days. Claim: ${props.claimUrl}`

/**
 * Render SMS message for opportunity offer
 */
export function renderOpportunityOfferSMS(props: OpportunityOfferSMSProps): string {
  const messageGenerator = SMS_MESSAGES[props.opportunityType] || DEFAULT_SMS
  return messageGenerator(props)
}

/**
 * Calculate expiration days from expiration date
 */
export function getExpirationDays(expirationDate: string): number {
  const expiry = new Date(expirationDate)
  const now = new Date()
  const diffTime = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

/**
 * Render short SMS (under 160 chars for single SMS)
 */
export function renderShortOpportunityOfferSMS(props: OpportunityOfferSMSProps): string {
  return `${props.discountPercentage}% OFF! Code: ${props.offerCode}. Expires in ${props.expirationDays}d. ${props.claimUrl}`
}

/**
 * Render reminder SMS for unclaimed offers
 */
export function renderOfferReminderSMS(props: OpportunityOfferSMSProps): string {
  const daysLeft = props.expirationDays

  if (daysLeft <= 1) {
    return `LAST CHANCE ${props.customerName}! Your ${props.discountPercentage}% OFF expires TODAY! Code: ${props.offerCode}. Claim now: ${props.claimUrl}`
  } else if (daysLeft <= 3) {
    return `Reminder: Your ${props.discountPercentage}% OFF expires in ${daysLeft} days! Code: ${props.offerCode}. Don't miss out: ${props.claimUrl}`
  } else {
    return `Don't forget! Save ${props.discountPercentage}% with code ${props.offerCode}. ${daysLeft} days left: ${props.claimUrl}`
  }
}
