/**
 * Automated Opportunity Offers
 *
 * Handles intelligent re-engagement of customers who declined services
 * with personalized discount offers based on opportunity type and timing.
 */

import { createClient } from '@/lib/supabase/server'

export interface OfferStrategy {
  initialDelayDays: number
  initialDiscountPercentage: number
  escalationDelayDays: number
  escalatedDiscountPercentage: number
  offerValidityDays: number
  maxEscalations: number
}

/**
 * Offer strategies by opportunity type
 */
const OFFER_STRATEGIES: Record<string, OfferStrategy> = {
  declined_service: {
    initialDelayDays: 7,
    initialDiscountPercentage: 10,
    escalationDelayDays: 14, // After initial offer
    escalatedDiscountPercentage: 15,
    offerValidityDays: 30,
    maxEscalations: 2,
  },
  price_objection: {
    initialDelayDays: 3,
    initialDiscountPercentage: 15,
    escalationDelayDays: 7,
    escalatedDiscountPercentage: 20,
    offerValidityDays: 21,
    maxEscalations: 2,
  },
  postponed_booking: {
    initialDelayDays: 0, // Wait for customer-specified date
    initialDiscountPercentage: 5,
    escalationDelayDays: 30,
    escalatedDiscountPercentage: 10,
    offerValidityDays: 14,
    maxEscalations: 1,
  },
  partial_booking: {
    initialDelayDays: 14,
    initialDiscountPercentage: 10,
    escalationDelayDays: 21,
    escalatedDiscountPercentage: 15,
    offerValidityDays: 30,
    maxEscalations: 2,
  },
  competitor_mention: {
    initialDelayDays: 5,
    initialDiscountPercentage: 12,
    escalationDelayDays: 10,
    escalatedDiscountPercentage: 18,
    offerValidityDays: 21,
    maxEscalations: 2,
  },
  service_upsell: {
    initialDelayDays: 21,
    initialDiscountPercentage: 8,
    escalationDelayDays: 30,
    escalatedDiscountPercentage: 12,
    offerValidityDays: 30,
    maxEscalations: 1,
  },
}

/**
 * Default strategy for unknown opportunity types
 */
const DEFAULT_STRATEGY: OfferStrategy = {
  initialDelayDays: 7,
  initialDiscountPercentage: 10,
  escalationDelayDays: 14,
  escalatedDiscountPercentage: 15,
  offerValidityDays: 21,
  maxEscalations: 1,
}

export interface OpportunityForOffer {
  opportunity_id: string
  customer_id: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  opportunity_type: string
  declined_services: string[]
  estimated_value: number | null
  reason: string | null
  created_at: string
  days_since_created: number
  has_pending_offer: boolean
  escalation_level: number
}

export interface GeneratedOffer {
  opportunityId: string
  customerId: string
  offerCode: string
  offerPercentage: number
  offerExpiresAt: Date
  applicableServices: string[]
  escalationLevel: number
  deliveryMethod: 'email' | 'sms' | 'portal' | 'all'
}

/**
 * Get strategy for opportunity type
 */
export function getOfferStrategy(opportunityType: string): OfferStrategy {
  return OFFER_STRATEGIES[opportunityType] || DEFAULT_STRATEGY
}

/**
 * Check if opportunity is ready for offer based on timing rules
 */
export function isReadyForOffer(
  opportunity: OpportunityForOffer,
  strategy: OfferStrategy
): boolean {
  const { days_since_created, escalation_level, has_pending_offer } = opportunity

  // Don't send if there's already a pending offer
  if (has_pending_offer) {
    return false
  }

  // Check max escalations
  if (escalation_level >= strategy.maxEscalations) {
    return false
  }

  // First offer (escalation level 0)
  if (escalation_level === 0) {
    return days_since_created >= strategy.initialDelayDays
  }

  // Escalated offer (escalation level 1+)
  // Note: This checks total days since creation, not days since last offer
  // The database function ensures last offer was >14 days ago
  const totalDelayRequired = strategy.initialDelayDays + strategy.escalationDelayDays
  return days_since_created >= totalDelayRequired
}

/**
 * Generate unique offer code
 */
export function generateOfferCode(): string {
  const prefix = 'OFFER'
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase()
  return `${prefix}${randomPart}`
}

/**
 * Calculate offer percentage based on escalation level
 */
export function calculateOfferPercentage(
  opportunityType: string,
  escalationLevel: number
): number {
  const strategy = getOfferStrategy(opportunityType)

  if (escalationLevel === 0) {
    return strategy.initialDiscountPercentage
  } else {
    return strategy.escalatedDiscountPercentage
  }
}

/**
 * Generate offer for opportunity
 */
export async function generateOffer(
  opportunity: OpportunityForOffer
): Promise<GeneratedOffer | null> {
  const strategy = getOfferStrategy(opportunity.opportunity_type)

  // Check if ready
  if (!isReadyForOffer(opportunity, strategy)) {
    return null
  }

  // Calculate offer details
  const nextEscalationLevel = opportunity.escalation_level + 1
  const offerPercentage = calculateOfferPercentage(
    opportunity.opportunity_type,
    opportunity.escalation_level
  )

  // Generate expiration date
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + strategy.offerValidityDays)

  // Determine delivery method
  let deliveryMethod: 'email' | 'sms' | 'portal' | 'all' = 'portal'
  if (opportunity.customer_email && opportunity.customer_phone) {
    deliveryMethod = 'all'
  } else if (opportunity.customer_email) {
    deliveryMethod = 'email'
  } else if (opportunity.customer_phone) {
    deliveryMethod = 'sms'
  }

  return {
    opportunityId: opportunity.opportunity_id,
    customerId: opportunity.customer_id,
    offerCode: generateOfferCode(),
    offerPercentage,
    offerExpiresAt: expiresAt,
    applicableServices: opportunity.declined_services || [],
    escalationLevel: nextEscalationLevel,
    deliveryMethod,
  }
}

/**
 * Get opportunities ready for offers
 */
export async function getOpportunitiesReadyForOffers(): Promise<OpportunityForOffer[]> {
  const supabase = await createClient()

  try {
    // Use database function if available
    const { data, error } = await (supabase as any).rpc('get_opportunities_ready_for_offers')

    if (error) {
      console.error('[Auto Offers] Database function error:', error)
      return []
    }

    return (data || []) as OpportunityForOffer[]
  } catch (error) {
    console.error('[Auto Offers] Error fetching opportunities:', error)
    return []
  }
}

/**
 * Create offer record in database
 */
export async function createOfferRecord(
  offer: GeneratedOffer,
  previousOfferId?: string
): Promise<string | null> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('opportunity_offers')
      .insert({
        opportunity_id: offer.opportunityId,
        offer_percentage: offer.offerPercentage,
        offer_code: offer.offerCode,
        offer_expires_at: offer.offerExpiresAt.toISOString(),
        applicable_services: offer.applicableServices,
        escalation_level: offer.escalationLevel,
        previous_offer_id: previousOfferId || null,
        metadata: {
          auto_generated: true,
          generated_at: new Date().toISOString(),
        } as any,
      } as any)
      .select('id')
      .single()

    if (error) {
      console.error('[Auto Offers] Create offer error:', error)
      return null
    }

    return (data as any)?.id || null
  } catch (error) {
    console.error('[Auto Offers] Error creating offer:', error)
    return null
  }
}

/**
 * Mark offer as delivered
 */
export async function markOfferDelivered(
  offerId: string,
  deliveryMethod: string
): Promise<void> {
  const supabase = await createClient()

  try {
    await (supabase as any)
      .from('opportunity_offers')
      .update({
        delivered_at: new Date().toISOString(),
        delivery_method: deliveryMethod,
      })
      .eq('id', offerId)

    // Also update opportunity status
    const { data: offer } = await supabase
      .from('opportunity_offers')
      .select('opportunity_id')
      .eq('id', offerId)
      .single()

    if (offer) {
      await (supabase as any)
        .from('missed_opportunities')
        .update({
          status: 'offer_sent',
          latest_offer_id: offerId,
        })
        .eq('id', (offer as any).opportunity_id)
    }
  } catch (error) {
    console.error('[Auto Offers] Error marking delivered:', error)
  }
}

/**
 * Process all pending offers
 */
export async function processAutomatedOffers(): Promise<{
  processed: number
  offers: GeneratedOffer[]
  errors: string[]
}> {
  const errors: string[] = []
  const offers: GeneratedOffer[] = []

  try {
    // Get opportunities ready for offers
    const opportunities = await getOpportunitiesReadyForOffers()

    console.log(`[Auto Offers] Found ${opportunities.length} opportunities ready for offers`)

    // Generate offers for each
    for (const opportunity of opportunities) {
      try {
        const offer = await generateOffer(opportunity)

        if (offer) {
          offers.push(offer)
        }
      } catch (error) {
        const message = `Failed to generate offer for opportunity ${opportunity.opportunity_id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
        console.error(`[Auto Offers] ${message}`)
        errors.push(message)
      }
    }

    return {
      processed: offers.length,
      offers,
      errors,
    }
  } catch (error) {
    const message = `Failed to process automated offers: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`
    console.error(`[Auto Offers] ${message}`)
    errors.push(message)

    return {
      processed: 0,
      offers: [],
      errors,
    }
  }
}
