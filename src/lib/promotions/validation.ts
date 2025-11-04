import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Promotion Validation Utilities
 *
 * Validates promotion eligibility and constraints:
 * - Expiration checks
 * - Redemption limits (total and per-customer)
 * - Minimum/maximum job value requirements
 * - Zone restrictions
 * - Service type restrictions
 * - Customer eligibility
 */

export interface ValidationResult {
  valid: boolean
  reason?: string
  code?: string
}

export interface PromotionConstraints {
  promotionId: string
  customerId?: string
  jobValue?: number
  zoneId?: string
  serviceTypes?: string[]
}

/**
 * Validate if promotion is currently active and not expired
 */
export async function validatePromotionActive(promotionId: string): Promise<ValidationResult> {
  try {
    const supabase = getServiceSupabase()

    const { data: promotion, error } = await supabase
      .from('promotions')
      .select('status, start_date, end_date')
      .eq('id', promotionId)
      .single()

    if (error || !promotion) {
      return {
        valid: false,
        reason: 'Promotion not found',
        code: 'PROMOTION_NOT_FOUND',
      }
    }

    // Check status
    if ((promotion as any).status !== 'active') {
      return {
        valid: false,
        reason: 'Promotion is not active',
        code: 'PROMOTION_NOT_ACTIVE',
      }
    }

    // Check start date
    const startDate = new Date((promotion as any).start_date)
    const now = new Date()
    if (startDate > now) {
      return {
        valid: false,
        reason: 'Promotion has not started yet',
        code: 'PROMOTION_NOT_STARTED',
      }
    }

    // Check end date
    const endDate = new Date((promotion as any).end_date)
    if (endDate < now) {
      return {
        valid: false,
        reason: 'Promotion has expired',
        code: 'PROMOTION_EXPIRED',
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Validation] Error validating promotion active:', error)
    return {
      valid: false,
      reason: 'Failed to validate promotion',
      code: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Validate promotion redemption limits
 */
export async function validateRedemptionLimits(
  promotionId: string,
  customerId?: string
): Promise<ValidationResult> {
  try {
    const supabase = getServiceSupabase()

    const { data: promotion, error } = await supabase
      .from('promotions')
      .select('max_redemptions, redemptions_per_customer, current_redemptions')
      .eq('id', promotionId)
      .single()

    if (error || !promotion) {
      return {
        valid: false,
        reason: 'Promotion not found',
        code: 'PROMOTION_NOT_FOUND',
      }
    }

    // Check total redemption limit
    const maxRedemptions = (promotion as any).max_redemptions
    const currentRedemptions = (promotion as any).current_redemptions || 0

    if (maxRedemptions && currentRedemptions >= maxRedemptions) {
      return {
        valid: false,
        reason: 'Promotion has reached maximum redemptions',
        code: 'MAX_REDEMPTIONS_REACHED',
      }
    }

    // Check per-customer redemption limit
    if (customerId) {
      const redemptionsPerCustomer = (promotion as any).redemptions_per_customer || 1

      const { count: customerRedemptions, error: countError } = await supabase
        .from('promotion_deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('promotion_id', promotionId)
        .eq('customer_id', customerId)
        .not('redeemed_at', 'is', null)

      if (countError) {
        console.error('[Validation] Error counting customer redemptions:', countError)
        return {
          valid: false,
          reason: 'Failed to validate redemption limits',
          code: 'VALIDATION_ERROR',
        }
      }

      if (customerRedemptions && customerRedemptions >= redemptionsPerCustomer) {
        return {
          valid: false,
          reason: `You have already redeemed this promotion ${customerRedemptions} time(s). Limit is ${redemptionsPerCustomer} per customer.`,
          code: 'CUSTOMER_REDEMPTION_LIMIT_REACHED',
        }
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Validation] Error validating redemption limits:', error)
    return {
      valid: false,
      reason: 'Failed to validate redemption limits',
      code: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Validate job value against promotion constraints
 */
export async function validateJobValue(
  promotionId: string,
  jobValue: number
): Promise<ValidationResult> {
  try {
    const supabase = getServiceSupabase()

    const { data: promotion, error } = await supabase
      .from('promotions')
      .select('min_job_value, max_job_value')
      .eq('id', promotionId)
      .single()

    if (error || !promotion) {
      return {
        valid: false,
        reason: 'Promotion not found',
        code: 'PROMOTION_NOT_FOUND',
      }
    }

    const minJobValue = (promotion as any).min_job_value
    const maxJobValue = (promotion as any).max_job_value

    // Check minimum job value
    if (minJobValue && jobValue < minJobValue) {
      return {
        valid: false,
        reason: `Job value must be at least $${minJobValue.toFixed(2)}`,
        code: 'JOB_VALUE_TOO_LOW',
      }
    }

    // Check maximum job value
    if (maxJobValue && jobValue > maxJobValue) {
      return {
        valid: false,
        reason: `Job value must not exceed $${maxJobValue.toFixed(2)}`,
        code: 'JOB_VALUE_TOO_HIGH',
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Validation] Error validating job value:', error)
    return {
      valid: false,
      reason: 'Failed to validate job value',
      code: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Validate zone restrictions
 */
export async function validateZoneRestrictions(
  promotionId: string,
  zoneId: string
): Promise<ValidationResult> {
  try {
    const supabase = getServiceSupabase()

    const { data: promotion, error } = await supabase
      .from('promotions')
      .select('target_zones')
      .eq('id', promotionId)
      .single()

    if (error || !promotion) {
      return {
        valid: false,
        reason: 'Promotion not found',
        code: 'PROMOTION_NOT_FOUND',
      }
    }

    const targetZones = (promotion as any).target_zones

    // If no zones specified, promotion is valid for all zones
    if (!targetZones || targetZones.length === 0) {
      return { valid: true }
    }

    // Check if customer's zone is in target zones
    if (!targetZones.includes(zoneId)) {
      return {
        valid: false,
        reason: 'This promotion is not available in your area',
        code: 'ZONE_NOT_ELIGIBLE',
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Validation] Error validating zone restrictions:', error)
    return {
      valid: false,
      reason: 'Failed to validate zone restrictions',
      code: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Validate service type restrictions
 */
export async function validateServiceTypeRestrictions(
  promotionId: string,
  serviceTypes: string[]
): Promise<ValidationResult> {
  try {
    const supabase = getServiceSupabase()

    const { data: promotion, error } = await supabase
      .from('promotions')
      .select('target_service_types')
      .eq('id', promotionId)
      .single()

    if (error || !promotion) {
      return {
        valid: false,
        reason: 'Promotion not found',
        code: 'PROMOTION_NOT_FOUND',
      }
    }

    const targetServiceTypes = (promotion as any).target_service_types

    // If no service types specified, promotion is valid for all services
    if (!targetServiceTypes || targetServiceTypes.length === 0) {
      return { valid: true }
    }

    // Check if any of the job's service types match target service types
    const hasMatchingService = serviceTypes.some((type) =>
      targetServiceTypes.includes(type)
    )

    if (!hasMatchingService) {
      return {
        valid: false,
        reason: 'This promotion is not valid for the selected services',
        code: 'SERVICE_TYPE_NOT_ELIGIBLE',
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Validation] Error validating service type restrictions:', error)
    return {
      valid: false,
      reason: 'Failed to validate service type restrictions',
      code: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Validate customer eligibility based on target audience
 */
export async function validateCustomerEligibility(
  promotionId: string,
  customerId: string
): Promise<ValidationResult> {
  try {
    const supabase = getServiceSupabase()

    const { data: promotion, error } = await supabase
      .from('promotions')
      .select('target_audience')
      .eq('id', promotionId)
      .single()

    if (error || !promotion) {
      return {
        valid: false,
        reason: 'Promotion not found',
        code: 'PROMOTION_NOT_FOUND',
      }
    }

    const targetAudience = (promotion as any).target_audience

    // 'all_customers' is always eligible
    if (targetAudience === 'all_customers') {
      return { valid: true }
    }

    // Get customer data for other audience types
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('created_at, last_service_date, lifetime_value, customer_type')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return {
        valid: false,
        reason: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
      }
    }

    const now = new Date()

    switch (targetAudience) {
      case 'new':
        // New customers (no previous service)
        if ((customer as any).last_service_date) {
          return {
            valid: false,
            reason: 'This promotion is only for new customers',
            code: 'NOT_NEW_CUSTOMER',
          }
        }
        break

      case 'inactive':
        // Inactive customers (no service in 90+ days)
        if ((customer as any).last_service_date) {
          const lastService = new Date((customer as any).last_service_date)
          const daysSinceService = Math.floor(
            (now.getTime() - lastService.getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSinceService < 90) {
            return {
              valid: false,
              reason: 'This promotion is only for inactive customers',
              code: 'NOT_INACTIVE_CUSTOMER',
            }
          }
        }
        break

      case 'vip':
        // VIP customers (high lifetime value or VIP type)
        const lifetimeValue = (customer as any).lifetime_value || 0
        const isVipType = (customer as any).customer_type === 'vip'
        if (lifetimeValue < 1000 && !isVipType) {
          return {
            valid: false,
            reason: 'This promotion is only for VIP customers',
            code: 'NOT_VIP_CUSTOMER',
          }
        }
        break

      default:
        // Unknown target audience, allow by default
        return { valid: true }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Validation] Error validating customer eligibility:', error)
    return {
      valid: false,
      reason: 'Failed to validate customer eligibility',
      code: 'VALIDATION_ERROR',
    }
  }
}

/**
 * Comprehensive promotion validation
 * Runs all validation checks
 */
export async function validatePromotion(
  constraints: PromotionConstraints
): Promise<ValidationResult> {
  // Check if promotion is active
  const activeCheck = await validatePromotionActive(constraints.promotionId)
  if (!activeCheck.valid) return activeCheck

  // Check redemption limits
  const limitsCheck = await validateRedemptionLimits(
    constraints.promotionId,
    constraints.customerId
  )
  if (!limitsCheck.valid) return limitsCheck

  // Check customer eligibility
  if (constraints.customerId) {
    const eligibilityCheck = await validateCustomerEligibility(
      constraints.promotionId,
      constraints.customerId
    )
    if (!eligibilityCheck.valid) return eligibilityCheck
  }

  // Check job value if provided
  if (constraints.jobValue !== undefined) {
    const jobValueCheck = await validateJobValue(constraints.promotionId, constraints.jobValue)
    if (!jobValueCheck.valid) return jobValueCheck
  }

  // Check zone if provided
  if (constraints.zoneId) {
    const zoneCheck = await validateZoneRestrictions(constraints.promotionId, constraints.zoneId)
    if (!zoneCheck.valid) return zoneCheck
  }

  // Check service types if provided
  if (constraints.serviceTypes && constraints.serviceTypes.length > 0) {
    const serviceCheck = await validateServiceTypeRestrictions(
      constraints.promotionId,
      constraints.serviceTypes
    )
    if (!serviceCheck.valid) return serviceCheck
  }

  return { valid: true }
}

/**
 * Validate claim code
 */
export async function validateClaimCode(claimCode: string): Promise<{
  valid: boolean
  delivery?: any
  promotion?: any
  reason?: string
  code?: string
}> {
  try {
    const supabase = getServiceSupabase()

    // Get delivery by claim code
    const { data: delivery, error: deliveryError } = await supabase
      .from('promotion_deliveries')
      .select(`
        *,
        promotions (*)
      `)
      .eq('claim_code', claimCode)
      .single()

    if (deliveryError || !delivery) {
      return {
        valid: false,
        reason: 'Invalid claim code',
        code: 'INVALID_CLAIM_CODE',
      }
    }

    // Check if already redeemed
    if ((delivery as any).redeemed_at) {
      return {
        valid: false,
        reason: 'This promotion has already been redeemed',
        code: 'ALREADY_REDEEMED',
      }
    }

    const promotion = (delivery as any).promotions

    // Validate promotion is still active
    const activeCheck = await validatePromotionActive(promotion.id)
    if (!activeCheck.valid) {
      return {
        valid: false,
        reason: activeCheck.reason,
        code: activeCheck.code,
      }
    }

    return {
      valid: true,
      delivery,
      promotion,
    }
  } catch (error) {
    console.error('[Validation] Error validating claim code:', error)
    return {
      valid: false,
      reason: 'Failed to validate claim code',
      code: 'VALIDATION_ERROR',
    }
  }
}
