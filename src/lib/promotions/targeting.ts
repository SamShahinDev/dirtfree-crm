import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Promotion Targeting Utilities
 *
 * Utilities for filtering customers by targeting criteria,
 * calculating estimated reach, and validating promotion rules.
 */

export type TargetAudience =
  | 'all_customers'
  | 'inactive'
  | 'vip'
  | 'new'
  | 'zone_specific'
  | 'service_specific'
  | 'custom'

export interface TargetingCriteria {
  targetAudience: TargetAudience
  targetZones?: string[]
  targetServiceTypes?: string[]
  targetCustomerTags?: string[]
  minJobValue?: number
  maxJobValue?: number
  excludedCustomerIds?: string[]
}

export interface PromotionReach {
  totalCustomers: number
  eligibleCustomers: number
  estimatedReach: number
  breakdown: {
    byZone?: Record<string, number>
    byServiceType?: Record<string, number>
    byTag?: Record<string, number>
  }
}

export interface CostEstimate {
  emailCost: number
  smsCost: number
  totalCost: number
  breakdown: {
    email: {
      count: number
      costPerEmail: number
    }
    sms: {
      count: number
      costPerSms: number
      segments: number
    }
  }
}

export interface PromotionValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Get customers matching targeting criteria
 */
export async function getTargetedCustomers(
  criteria: TargetingCriteria
): Promise<string[]> {
  try {
    const supabase = getServiceSupabase()

    let query = supabase
      .from('customers')
      .select('id')
      .is('deleted_at', null)

    // Apply audience filters
    switch (criteria.targetAudience) {
      case 'inactive':
        // Customers who haven't had a job in 90+ days
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        query = query.or(`last_service_date.is.null,last_service_date.lt.${ninetyDaysAgo.toISOString()}`)
        break

      case 'vip':
        // Customers with VIP tag or high lifetime value
        query = query.or('tags.cs.{"vip"},lifetime_value.gte.5000')
        break

      case 'new':
        // Customers created in last 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        query = query.gte('created_at', thirtyDaysAgo.toISOString())
        break

      case 'zone_specific':
        if (criteria.targetZones && criteria.targetZones.length > 0) {
          query = query.in('zone_id', criteria.targetZones)
        }
        break

      case 'service_specific':
        // Will filter by service history below
        break

      case 'custom':
        // Apply custom filters
        if (criteria.targetZones && criteria.targetZones.length > 0) {
          query = query.in('zone_id', criteria.targetZones)
        }
        if (criteria.targetCustomerTags && criteria.targetCustomerTags.length > 0) {
          // PostgreSQL array overlap operator
          const tagsQuery = criteria.targetCustomerTags.map(tag => `"${tag}"`).join(',')
          query = query.filter('tags', 'cs', `{${tagsQuery}}`)
        }
        break

      case 'all_customers':
      default:
        // No additional filters
        break
    }

    // Exclude specific customers
    if (criteria.excludedCustomerIds && criteria.excludedCustomerIds.length > 0) {
      query = query.not('id', 'in', `(${criteria.excludedCustomerIds.join(',')})`)
    }

    const { data: customers, error } = await query

    if (error) {
      console.error('[Targeting] Error fetching customers:', error)
      return []
    }

    let customerIds = (customers || []).map((c: any) => c.id)

    // Filter by service type if needed
    if (criteria.targetAudience === 'service_specific' && criteria.targetServiceTypes && criteria.targetServiceTypes.length > 0) {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('customer_id')
        .in('service_type', criteria.targetServiceTypes)
        .in('customer_id', customerIds)

      const customersWithService = new Set((jobs || []).map((j: any) => j.customer_id))
      customerIds = customerIds.filter(id => customersWithService.has(id))
    }

    return customerIds
  } catch (error) {
    console.error('[Targeting] Exception fetching customers:', error)
    return []
  }
}

/**
 * Calculate estimated reach for a promotion
 */
export async function calculateEstimatedReach(
  criteria: TargetingCriteria
): Promise<PromotionReach> {
  try {
    const supabase = getServiceSupabase()

    // Get total customer count
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    // Get targeted customers
    const eligibleCustomerIds = await getTargetedCustomers(criteria)
    const eligibleCustomers = eligibleCustomerIds.length

    // Calculate breakdown
    const breakdown: PromotionReach['breakdown'] = {}

    // Breakdown by zone if zone-specific
    if (criteria.targetZones && criteria.targetZones.length > 0) {
      const byZone: Record<string, number> = {}

      for (const zoneId of criteria.targetZones) {
        const { count } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('zone_id', zoneId)
          .in('id', eligibleCustomerIds)

        if (count) {
          byZone[zoneId] = count
        }
      }

      breakdown.byZone = byZone
    }

    // Breakdown by service type if service-specific
    if (criteria.targetServiceTypes && criteria.targetServiceTypes.length > 0) {
      const byServiceType: Record<string, number> = {}

      for (const serviceType of criteria.targetServiceTypes) {
        const { data: jobs } = await supabase
          .from('jobs')
          .select('customer_id')
          .eq('service_type', serviceType)
          .in('customer_id', eligibleCustomerIds)

        const uniqueCustomers = new Set((jobs || []).map((j: any) => j.customer_id))
        byServiceType[serviceType] = uniqueCustomers.size
      }

      breakdown.byServiceType = byServiceType
    }

    return {
      totalCustomers: totalCustomers || 0,
      eligibleCustomers,
      estimatedReach: eligibleCustomers,
      breakdown,
    }
  } catch (error) {
    console.error('[Targeting] Error calculating reach:', error)
    return {
      totalCustomers: 0,
      eligibleCustomers: 0,
      estimatedReach: 0,
      breakdown: {},
    }
  }
}

/**
 * Estimate cost for promotion delivery
 */
export async function estimatePromotionCost(
  criteria: TargetingCriteria,
  deliveryChannels: string[],
  messageText?: string
): Promise<CostEstimate> {
  try {
    const supabase = getServiceSupabase()
    const customerIds = await getTargetedCustomers(criteria)

    // Get customers with contact info
    const { data: customers } = await supabase
      .from('customers')
      .select('email, phone')
      .in('id', customerIds)

    const customersWithEmail = (customers || []).filter((c: any) => c.email).length
    const customersWithPhone = (customers || []).filter((c: any) => c.phone).length

    // Email cost (typically free or very cheap)
    const emailCostPerSend = 0.001 // $0.001 per email (example rate)
    const emailCost = deliveryChannels.includes('email') ? customersWithEmail * emailCostPerSend : 0

    // SMS cost calculation
    let smsCost = 0
    let smsSegments = 1

    if (deliveryChannels.includes('sms') && messageText) {
      const messageLength = messageText.length

      // Calculate SMS segments (160 chars for single, 153 for multi-part)
      if (messageLength <= 160) {
        smsSegments = 1
      } else {
        smsSegments = Math.ceil(messageLength / 153)
      }

      const smsCostPerSegment = 0.0079 // Twilio pricing ~$0.0079/segment
      smsCost = deliveryChannels.includes('sms') ? customersWithPhone * smsSegments * smsCostPerSegment : 0
    }

    return {
      emailCost,
      smsCost,
      totalCost: emailCost + smsCost,
      breakdown: {
        email: {
          count: customersWithEmail,
          costPerEmail: emailCostPerSend,
        },
        sms: {
          count: customersWithPhone,
          costPerSms: 0.0079 * smsSegments,
          segments: smsSegments,
        },
      },
    }
  } catch (error) {
    console.error('[Targeting] Error estimating cost:', error)
    return {
      emailCost: 0,
      smsCost: 0,
      totalCost: 0,
      breakdown: {
        email: { count: 0, costPerEmail: 0 },
        sms: { count: 0, costPerSms: 0, segments: 1 },
      },
    }
  }
}

/**
 * Validate promotion configuration
 */
export function validatePromotion(promotion: {
  title: string
  promotionType: string
  discountValue?: number
  discountPercentage?: number
  startDate: string
  endDate: string
  maxRedemptions?: number
  redemptionsPerCustomer?: number
  minJobValue?: number
  maxJobValue?: number
}): PromotionValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // Title validation
  if (!promotion.title || promotion.title.trim().length === 0) {
    errors.push('Title is required')
  }

  // Date validation
  const startDate = new Date(promotion.startDate)
  const endDate = new Date(promotion.endDate)

  if (isNaN(startDate.getTime())) {
    errors.push('Invalid start date')
  }

  if (isNaN(endDate.getTime())) {
    errors.push('Invalid end date')
  }

  if (startDate >= endDate) {
    errors.push('End date must be after start date')
  }

  if (startDate < new Date()) {
    warnings.push('Start date is in the past')
  }

  const daysDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDuration > 365) {
    warnings.push('Promotion duration is longer than 1 year')
  }

  // Discount validation
  if (promotion.promotionType === 'percentage_off') {
    if (!promotion.discountPercentage || promotion.discountPercentage <= 0) {
      errors.push('Discount percentage must be greater than 0')
    }
    if (promotion.discountPercentage && promotion.discountPercentage > 100) {
      errors.push('Discount percentage cannot exceed 100%')
    }
    if (promotion.discountPercentage && promotion.discountPercentage > 50) {
      warnings.push('Discount percentage is very high (>50%)')
    }
  }

  if (promotion.promotionType === 'dollar_off') {
    if (!promotion.discountValue || promotion.discountValue <= 0) {
      errors.push('Discount value must be greater than 0')
    }
    if (promotion.discountValue && promotion.discountValue > 1000) {
      warnings.push('Discount value is very high (>$1000)')
    }
  }

  // Redemption validation
  if (promotion.maxRedemptions && promotion.maxRedemptions < 1) {
    errors.push('Max redemptions must be at least 1')
  }

  if (promotion.redemptionsPerCustomer && promotion.redemptionsPerCustomer < 1) {
    errors.push('Redemptions per customer must be at least 1')
  }

  if (
    promotion.maxRedemptions &&
    promotion.redemptionsPerCustomer &&
    promotion.redemptionsPerCustomer > promotion.maxRedemptions
  ) {
    warnings.push('Redemptions per customer is greater than max total redemptions')
  }

  // Job value validation
  if (promotion.minJobValue && promotion.minJobValue < 0) {
    errors.push('Minimum job value cannot be negative')
  }

  if (promotion.maxJobValue && promotion.maxJobValue < 0) {
    errors.push('Maximum job value cannot be negative')
  }

  if (
    promotion.minJobValue &&
    promotion.maxJobValue &&
    promotion.minJobValue > promotion.maxJobValue
  ) {
    errors.push('Minimum job value cannot be greater than maximum job value')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Generate a random promo code
 */
export function generatePromoCode(
  title: string,
  length: number = 8
): string {
  // Extract uppercase letters from title
  const titlePart = title
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)

  // Generate random alphanumeric suffix
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  const suffixLength = length - titlePart.length

  for (let i = 0; i < suffixLength; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return titlePart + suffix
}

/**
 * Check if promo code is available
 */
export async function isPromoCodeAvailable(promoCode: string): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('promotions')
      .select('id')
      .eq('promo_code', promoCode)
      .single()

    // If error, code is available (not found)
    // If data exists, code is taken
    return error !== null || !data
  } catch (error) {
    console.error('[Targeting] Error checking promo code:', error)
    return false
  }
}

/**
 * Get promotion preview data
 */
export async function getPromotionPreview(
  promotion: {
    title: string
    description: string
    promotionType: string
    discountValue?: number
    discountPercentage?: number
    endDate: string
  },
  sampleJobValue: number = 100
): Promise<{
  title: string
  description: string
  discountText: string
  calculatedDiscount: number
  finalPrice: number
}> {
  let discountText = ''
  let calculatedDiscount = 0

  switch (promotion.promotionType) {
    case 'percentage_off':
      discountText = `${promotion.discountPercentage}% OFF`
      calculatedDiscount = sampleJobValue * ((promotion.discountPercentage || 0) / 100)
      break

    case 'dollar_off':
      discountText = `$${promotion.discountValue} OFF`
      calculatedDiscount = promotion.discountValue || 0
      break

    case 'free_addon':
      discountText = 'FREE ADD-ON SERVICE'
      calculatedDiscount = 0
      break

    case 'bogo':
      discountText = 'BUY ONE GET ONE'
      calculatedDiscount = sampleJobValue * 0.5
      break

    case 'seasonal':
      discountText = 'SEASONAL SPECIAL'
      calculatedDiscount = 0
      break

    default:
      discountText = 'SPECIAL OFFER'
      break
  }

  return {
    title: promotion.title,
    description: promotion.description,
    discountText,
    calculatedDiscount: Math.round(calculatedDiscount * 100) / 100,
    finalPrice: Math.max(0, sampleJobValue - calculatedDiscount),
  }
}
