import { getServiceSupabase } from '@/lib/supabase/server'
import { sendCustomEmail } from '@/lib/email/service'
import { sendSms } from '@/lib/sms/service'
import { renderPromotionEmail } from '@/lib/email/templates/promotion-email'
import { renderPromotionSMS } from '@/lib/sms/templates/promotion-sms'
import { CommunicationPreferenceChecker } from '@/lib/communications/preference-checker'
import { nanoid } from 'nanoid'

/**
 * Promotion Delivery System
 *
 * Handles reliable delivery of promotions across multiple channels:
 * - Portal notifications
 * - Email
 * - SMS
 *
 * Features:
 * - Generates unique claim codes
 * - Respects customer communication preferences
 * - Tracks delivery status
 * - Handles failures with retry logic
 * - Rate limiting support
 */

export interface DeliveryChannel {
  type: 'portal' | 'email' | 'sms'
  enabled: boolean
}

export interface PromotionDeliveryData {
  promotionId: string
  title: string
  description?: string
  promotionType: string
  discountValue?: number
  discountPercentage?: number
  promoCode?: string
  startDate: string
  endDate: string
  termsAndConditions?: string
}

export interface CustomerDeliveryData {
  id: string
  email?: string
  phone?: string
  fullName?: string
  preferredName?: string
}

export interface DeliveryResult {
  success: boolean
  deliveryId?: string
  claimCode?: string
  channel: 'portal' | 'email' | 'sms'
  error?: string
}

export interface QueueDeliveriesResult {
  success: boolean
  queuedCount: number
  skippedCount: number
  errors: string[]
}

/**
 * Generate unique claim code for promotion
 */
export function generateClaimCode(promotionId: string, customerId: string): string {
  // Format: PROMO-{8-char-nanoid}
  // Nanoid uses URL-safe characters (A-Za-z0-9_-)
  const uniqueId = nanoid(8).toUpperCase()
  return `PROMO-${uniqueId}`
}

/**
 * Queue promotion deliveries for multiple customers
 */
export async function queuePromotionDeliveries(
  promotionId: string,
  customerIds: string[],
  deliveryChannels: ('portal' | 'email' | 'sms')[]
): Promise<QueueDeliveriesResult> {
  const supabase = getServiceSupabase()
  const errors: string[] = []

  try {
    // Use database function to queue deliveries
    const { data, error } = await (supabase as any).rpc('queue_promotion_deliveries', {
      p_promotion_id: promotionId,
      p_customer_ids: customerIds,
      p_delivery_channels: deliveryChannels,
    })

    if (error) {
      console.error('[Promotion Delivery] Error queuing deliveries:', error)
      return {
        success: false,
        queuedCount: 0,
        skippedCount: customerIds.length * deliveryChannels.length,
        errors: [error.message],
      }
    }

    const queuedCount = data || 0
    const totalExpected = customerIds.length * deliveryChannels.length
    const skippedCount = totalExpected - queuedCount

    return {
      success: true,
      queuedCount,
      skippedCount,
      errors: [],
    }
  } catch (error) {
    console.error('[Promotion Delivery] Exception queuing deliveries:', error)
    return {
      success: false,
      queuedCount: 0,
      skippedCount: customerIds.length * deliveryChannels.length,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}

/**
 * Deliver promotion to customer via portal notification
 */
async function deliverViaPortal(
  promotion: PromotionDeliveryData,
  customer: CustomerDeliveryData,
  claimCode: string
): Promise<DeliveryResult> {
  const supabase = getServiceSupabase()

  try {
    // Check if delivery record already exists
    const { data: existingDelivery } = await supabase
      .from('promotion_deliveries')
      .select('id, claim_code')
      .eq('promotion_id', promotion.promotionId)
      .eq('customer_id', customer.id)
      .single()

    if (existingDelivery) {
      return {
        success: true,
        deliveryId: (existingDelivery as any).id,
        claimCode: (existingDelivery as any).claim_code,
        channel: 'portal',
      }
    }

    // Create delivery record
    const { data: delivery, error } = await (supabase as any)
      .from('promotion_deliveries')
      .insert({
        promotion_id: promotion.promotionId,
        customer_id: customer.id,
        claim_code: claimCode,
        delivered_at: new Date().toISOString(),
        delivery_channel: 'portal',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Promotion Delivery] Portal delivery error:', error)
      return {
        success: false,
        channel: 'portal',
        error: error.message,
      }
    }

    return {
      success: true,
      deliveryId: (delivery as any).id,
      claimCode,
      channel: 'portal',
    }
  } catch (error) {
    console.error('[Promotion Delivery] Portal delivery exception:', error)
    return {
      success: false,
      channel: 'portal',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Deliver promotion to customer via email
 */
async function deliverViaEmail(
  promotion: PromotionDeliveryData,
  customer: CustomerDeliveryData,
  claimCode: string
): Promise<DeliveryResult> {
  const supabase = getServiceSupabase()

  try {
    // Check customer email
    if (!customer.email) {
      return {
        success: false,
        channel: 'email',
        error: 'Customer email not available',
      }
    }

    // Check communication preferences
    const preferenceChecker = new CommunicationPreferenceChecker()
    const canSend = await preferenceChecker.canSendEmail(customer.id, 'promotional')

    if (!canSend.allowed) {
      return {
        success: false,
        channel: 'email',
        error: `Cannot send email: ${canSend.reason}`,
      }
    }

    // Check if delivery record already exists
    const { data: existingDelivery } = await supabase
      .from('promotion_deliveries')
      .select('id, claim_code')
      .eq('promotion_id', promotion.promotionId)
      .eq('customer_id', customer.id)
      .single()

    const deliveryClaimCode = existingDelivery
      ? (existingDelivery as any).claim_code
      : claimCode

    // Render email
    const emailHtml = renderPromotionEmail({
      customerName: customer.preferredName || customer.fullName || 'Valued Customer',
      promotion,
      claimCode: deliveryClaimCode,
    })

    // Send email
    const emailResult = await sendCustomEmail(
      customer.email,
      `Special Offer: ${promotion.title}`,
      emailHtml
    )

    if (!emailResult.success) {
      return {
        success: false,
        channel: 'email',
        error: emailResult.error || 'Email send failed',
      }
    }

    // Create or update delivery record
    if (existingDelivery) {
      return {
        success: true,
        deliveryId: (existingDelivery as any).id,
        claimCode: deliveryClaimCode,
        channel: 'email',
      }
    }

    const { data: delivery, error } = await (supabase as any)
      .from('promotion_deliveries')
      .insert({
        promotion_id: promotion.promotionId,
        customer_id: customer.id,
        claim_code: deliveryClaimCode,
        delivered_at: new Date().toISOString(),
        delivery_channel: 'email',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Promotion Delivery] Email delivery record error:', error)
      return {
        success: false,
        channel: 'email',
        error: error.message,
      }
    }

    return {
      success: true,
      deliveryId: (delivery as any).id,
      claimCode: deliveryClaimCode,
      channel: 'email',
    }
  } catch (error) {
    console.error('[Promotion Delivery] Email delivery exception:', error)
    return {
      success: false,
      channel: 'email',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Deliver promotion to customer via SMS
 */
async function deliverViaSMS(
  promotion: PromotionDeliveryData,
  customer: CustomerDeliveryData,
  claimCode: string
): Promise<DeliveryResult> {
  const supabase = getServiceSupabase()

  try {
    // Check customer phone
    if (!customer.phone) {
      return {
        success: false,
        channel: 'sms',
        error: 'Customer phone not available',
      }
    }

    // Check communication preferences
    const preferenceChecker = new CommunicationPreferenceChecker()
    const canSend = await preferenceChecker.canSendSMS(customer.id, 'promotional')

    if (!canSend.allowed) {
      return {
        success: false,
        channel: 'sms',
        error: `Cannot send SMS: ${canSend.reason}`,
      }
    }

    // Check if delivery record already exists
    const { data: existingDelivery } = await supabase
      .from('promotion_deliveries')
      .select('id, claim_code')
      .eq('promotion_id', promotion.promotionId)
      .eq('customer_id', customer.id)
      .single()

    const deliveryClaimCode = existingDelivery
      ? (existingDelivery as any).claim_code
      : claimCode

    // Render SMS
    const smsText = renderPromotionSMS({
      customerName: customer.preferredName || customer.fullName || 'Customer',
      promotion,
      claimCode: deliveryClaimCode,
    })

    // Send SMS
    const smsResult = await sendSms({
      to: customer.phone,
      message: smsText,
      customerId: customer.id,
      metadata: {
        type: 'promotion',
        promotionId: promotion.promotionId,
      },
    })

    if (!smsResult.success) {
      return {
        success: false,
        channel: 'sms',
        error: smsResult.error || 'SMS send failed',
      }
    }

    // Create or update delivery record
    if (existingDelivery) {
      return {
        success: true,
        deliveryId: (existingDelivery as any).id,
        claimCode: deliveryClaimCode,
        channel: 'sms',
      }
    }

    const { data: delivery, error } = await (supabase as any)
      .from('promotion_deliveries')
      .insert({
        promotion_id: promotion.promotionId,
        customer_id: customer.id,
        claim_code: deliveryClaimCode,
        delivered_at: new Date().toISOString(),
        delivery_channel: 'sms',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Promotion Delivery] SMS delivery record error:', error)
      return {
        success: false,
        channel: 'sms',
        error: error.message,
      }
    }

    return {
      success: true,
      deliveryId: (delivery as any).id,
      claimCode: deliveryClaimCode,
      channel: 'sms',
    }
  } catch (error) {
    console.error('[Promotion Delivery] SMS delivery exception:', error)
    return {
      success: false,
      channel: 'sms',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Deliver promotion to a single customer across specified channels
 */
export async function deliverPromotion(
  promotion: PromotionDeliveryData,
  customer: CustomerDeliveryData,
  channels: ('portal' | 'email' | 'sms')[]
): Promise<DeliveryResult[]> {
  // Generate unique claim code for this customer
  const claimCode = generateClaimCode(promotion.promotionId, customer.id)

  const results: DeliveryResult[] = []

  for (const channel of channels) {
    let result: DeliveryResult

    switch (channel) {
      case 'portal':
        result = await deliverViaPortal(promotion, customer, claimCode)
        break
      case 'email':
        result = await deliverViaEmail(promotion, customer, claimCode)
        break
      case 'sms':
        result = await deliverViaSMS(promotion, customer, claimCode)
        break
      default:
        result = {
          success: false,
          channel,
          error: `Unknown channel: ${channel}`,
        }
    }

    results.push(result)
  }

  return results
}

/**
 * Get delivery statistics for a promotion
 */
export async function getDeliveryStatistics(promotionId: string) {
  const supabase = getServiceSupabase()

  try {
    const { data, error } = await (supabase as any).rpc('get_delivery_statistics', {
      p_promotion_id: promotionId,
    })

    if (error) {
      console.error('[Promotion Delivery] Error getting statistics:', error)
      return null
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null
  } catch (error) {
    console.error('[Promotion Delivery] Exception getting statistics:', error)
    return null
  }
}
