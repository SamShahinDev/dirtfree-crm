import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  processAutomatedOffers,
  createOfferRecord,
  markOfferDelivered,
  type GeneratedOffer,
} from '@/lib/opportunities/auto-offers'
import {
  renderOpportunityOfferEmail,
  getOpportunityOfferSubject,
} from '@/lib/email/templates/opportunity-offer'
import {
  renderOpportunityOfferSMS,
  getExpirationDays,
} from '@/lib/sms/templates/opportunity-offer'
import { sendEmail } from '@/lib/email/send'

/**
 * Process Opportunity Offers Cron Job
 *
 * GET /api/cron/process-opportunity-offers
 *
 * Runs daily at 8 AM to:
 * - Find opportunities ready for automated offers
 * - Generate personalized discount offers
 * - Send via email, SMS, and portal
 * - Track delivery and engagement
 *
 * Vercel Cron: 0 8 * * *
 */

const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret-change-in-production'

interface ProcessingResult {
  success: boolean
  totalProcessed: number
  offersGenerated: number
  offersSent: number
  errors: string[]
}

/**
 * Send offer via email
 */
async function sendOfferEmail(
  offer: GeneratedOffer,
  customer: {
    name: string
    email: string
    opportunityType: string
    declinedServices: string[]
    estimatedValue: number | null
    reason: string | null
  }
): Promise<boolean> {
  try {
    const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/offers/${offer.offerCode}`
    const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/book`

    const emailHtml = renderOpportunityOfferEmail({
      customerName: customer.name,
      opportunityType: customer.opportunityType,
      declinedServices: customer.declinedServices,
      discountPercentage: offer.offerPercentage,
      offerCode: offer.offerCode,
      expirationDate: offer.offerExpiresAt.toISOString(),
      claimUrl,
      bookingUrl,
      estimatedValue: customer.estimatedValue || undefined,
      reason: customer.reason || undefined,
    })

    const subject = getOpportunityOfferSubject(customer.opportunityType)

    await sendEmail({
      to: customer.email,
      subject,
      html: emailHtml,
    })

    return true
  } catch (error) {
    console.error('[Opportunity Offers] Email send error:', error)
    return false
  }
}

/**
 * Send offer via SMS (placeholder - integrate with Twilio)
 */
async function sendOfferSMS(
  offer: GeneratedOffer,
  customer: {
    name: string
    phone: string
    opportunityType: string
  }
): Promise<boolean> {
  try {
    const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/offers/${offer.offerCode}`
    const expirationDays = getExpirationDays(offer.offerExpiresAt.toISOString())

    const message = renderOpportunityOfferSMS({
      customerName: customer.name,
      opportunityType: customer.opportunityType,
      discountPercentage: offer.offerPercentage,
      offerCode: offer.offerCode,
      expirationDays,
      claimUrl,
    })

    // TODO: Integrate with Twilio SMS
    console.log(`[Opportunity Offers] Would send SMS to ${customer.phone}: ${message}`)

    return true
  } catch (error) {
    console.error('[Opportunity Offers] SMS send error:', error)
    return false
  }
}

/**
 * Create portal notification
 */
async function createPortalNotification(
  offer: GeneratedOffer,
  customer: {
    id: string
    name: string
    opportunityType: string
  }
): Promise<boolean> {
  try {
    const supabase = await createClient()

    await supabase.from('portal_notifications').insert({
      customer_id: customer.id,
      type: 'special_offer',
      title: `Exclusive ${offer.offerPercentage}% OFF Offer!`,
      message: `We have a special offer just for you. Use code ${offer.offerCode} to save ${offer.offerPercentage}% on your next service.`,
      link: `/portal/offers/${offer.offerCode}`,
      expires_at: offer.offerExpiresAt.toISOString(),
      metadata: {
        offer_id: offer.opportunityId,
        offer_code: offer.offerCode,
        opportunity_type: customer.opportunityType,
      } as any,
    } as any)

    return true
  } catch (error) {
    console.error('[Opportunity Offers] Portal notification error:', error)
    return false
  }
}

/**
 * Log offer interaction
 */
async function logOfferInteraction(
  opportunityId: string,
  offerId: string,
  deliveryMethod: string
): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase.from('opportunity_interactions').insert({
      opportunity_id: opportunityId,
      interaction_type: 'offer_sent',
      interaction_method: deliveryMethod,
      performed_by_user_id: null,
      notes: `Automated offer sent via ${deliveryMethod}`,
      metadata: {
        offer_id: offerId,
        auto_generated: true,
      } as any,
    } as any)
  } catch (error) {
    console.error('[Opportunity Offers] Log interaction error:', error)
  }
}

/**
 * Process and deliver a single offer
 */
async function processOffer(
  offer: GeneratedOffer,
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
    opportunityType: string
    declinedServices: string[]
    estimatedValue: number | null
    reason: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create offer record in database
    const offerId = await createOfferRecord(offer)

    if (!offerId) {
      return { success: false, error: 'Failed to create offer record' }
    }

    // Track delivery methods
    const deliveryMethods: string[] = []
    let anyDelivered = false

    // Send via email
    if (customer.email && (offer.deliveryMethod === 'email' || offer.deliveryMethod === 'all')) {
      const emailSent = await sendOfferEmail(offer, {
        name: customer.name,
        email: customer.email,
        opportunityType: customer.opportunityType,
        declinedServices: customer.declinedServices,
        estimatedValue: customer.estimatedValue,
        reason: customer.reason,
      })

      if (emailSent) {
        deliveryMethods.push('email')
        anyDelivered = true
      }
    }

    // Send via SMS
    if (customer.phone && (offer.deliveryMethod === 'sms' || offer.deliveryMethod === 'all')) {
      const smsSent = await sendOfferSMS(offer, {
        name: customer.name,
        phone: customer.phone,
        opportunityType: customer.opportunityType,
      })

      if (smsSent) {
        deliveryMethods.push('sms')
        anyDelivered = true
      }
    }

    // Always create portal notification
    const portalCreated = await createPortalNotification(offer, {
      id: customer.id,
      name: customer.name,
      opportunityType: customer.opportunityType,
    })

    if (portalCreated) {
      deliveryMethods.push('portal')
      anyDelivered = true
    }

    // Mark as delivered if any method succeeded
    if (anyDelivered) {
      const deliveryMethodStr = deliveryMethods.join(', ')
      await markOfferDelivered(offerId, deliveryMethodStr)
      await logOfferInteraction(offer.opportunityId, offerId, deliveryMethodStr)

      console.log(
        `[Opportunity Offers] Offer ${offer.offerCode} delivered to ${customer.name} via ${deliveryMethodStr}`
      )

      return { success: true }
    } else {
      return { success: false, error: 'All delivery methods failed' }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Opportunity Offers] Process offer error:`, error)
    return { success: false, error: message }
  }
}

/**
 * Main cron job handler
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Opportunity Offers] Starting automated offer processing...')

    // Process automated offers
    const { processed, offers, errors } = await processAutomatedOffers()

    console.log(`[Opportunity Offers] Generated ${offers.length} offers for ${processed} opportunities`)

    // Get customer details for each offer
    const supabase = await createClient()
    const result: ProcessingResult = {
      success: true,
      totalProcessed: processed,
      offersGenerated: offers.length,
      offersSent: 0,
      errors: [...errors],
    }

    // Process each offer
    for (const offer of offers) {
      try {
        // Get opportunity and customer details
        const { data: opportunity } = await supabase
          .from('missed_opportunities')
          .select(
            `
            *,
            customer:customers(id, full_name, email, phone)
          `
          )
          .eq('id', offer.opportunityId)
          .single()

        if (!opportunity || !(opportunity as any).customer) {
          result.errors.push(`Customer not found for opportunity ${offer.opportunityId}`)
          continue
        }

        const customer = (opportunity as any).customer
        const processResult = await processOffer(offer, {
          id: customer.id,
          name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          opportunityType: (opportunity as any).opportunity_type,
          declinedServices: (opportunity as any).declined_services || [],
          estimatedValue: (opportunity as any).estimated_value,
          reason: (opportunity as any).reason,
        })

        if (processResult.success) {
          result.offersSent++
        } else {
          result.errors.push(
            `Failed to process offer ${offer.offerCode}: ${processResult.error}`
          )
        }
      } catch (error) {
        const message = `Failed to process offer: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
        result.errors.push(message)
      }
    }

    console.log(`[Opportunity Offers] Completed: ${result.offersSent}/${result.offersGenerated} offers sent`)

    return NextResponse.json({
      message: 'Opportunity offers processed',
      ...result,
    })
  } catch (error) {
    console.error('[Opportunity Offers] Cron error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
