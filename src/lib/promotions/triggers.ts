import { getServiceSupabase } from '@/lib/supabase/server'
import { queuePromotionDeliveries } from './delivery'

/**
 * Automated Promotion Triggers
 *
 * Handles automated promotion creation and delivery based on trigger conditions:
 * - Inactive customers
 * - Birthdays
 * - Service anniversaries
 * - High-value customers
 * - Referrals
 *
 * Runs via cron job to check conditions and deliver promotions automatically.
 */

export interface TriggerResult {
  success: boolean
  triggerName: string
  customersFound: number
  promotionsCreated: number
  deliveriesQueued: number
  errors: string[]
}

export interface PromotionTemplate {
  title: string
  description: string
  promotion_type: string
  discount_value?: number
  discount_percentage?: number
  target_audience: string
  valid_days: number
  free_addon_service?: string
}

/**
 * Process inactive customer trigger
 */
export async function processInactiveCustomerTrigger(
  trigger: any
): Promise<TriggerResult> {
  const result: TriggerResult = {
    success: false,
    triggerName: trigger.trigger_name,
    customersFound: 0,
    promotionsCreated: 0,
    deliveriesQueued: 0,
    errors: [],
  }

  try {
    const supabase = getServiceSupabase()
    const conditions = trigger.trigger_conditions
    const daysInactive = conditions.days_inactive || 180

    // Get inactive customers
    const { data: customers, error: customersError } = await (supabase as any).rpc(
      'get_inactive_customers',
      { days_inactive: daysInactive }
    )

    if (customersError) {
      result.errors.push(`Failed to fetch inactive customers: ${customersError.message}`)
      return result
    }

    if (!customers || customers.length === 0) {
      result.success = true
      return result
    }

    result.customersFound = customers.length

    // Create promotion for these customers
    const template: PromotionTemplate = trigger.promotion_template
    const { promotionId, error: createError } = await createPromotionFromTemplate(
      template,
      `${trigger.trigger_name}_${new Date().getTime()}`
    )

    if (createError || !promotionId) {
      result.errors.push(`Failed to create promotion: ${createError}`)
      return result
    }

    result.promotionsCreated = 1

    // Queue deliveries
    const customerIds = customers.map((c: any) => c.customer_id)
    const deliveryChannels = trigger.delivery_channels || ['email']

    const queueResult = await queuePromotionDeliveries(
      promotionId,
      customerIds,
      deliveryChannels
    )

    result.deliveriesQueued = queueResult.queuedCount
    result.success = queueResult.success

    if (!queueResult.success) {
      result.errors.push(...queueResult.errors)
    }

    // Log automated deliveries
    await logAutomatedDeliveries(trigger.id, customerIds, promotionId)

    return result
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    return result
  }
}

/**
 * Process birthday trigger
 */
export async function processBirthdayTrigger(trigger: any): Promise<TriggerResult> {
  const result: TriggerResult = {
    success: false,
    triggerName: trigger.trigger_name,
    customersFound: 0,
    promotionsCreated: 0,
    deliveriesQueued: 0,
    errors: [],
  }

  try {
    const supabase = getServiceSupabase()

    // Get customers with upcoming birthdays
    const { data: customers, error: customersError } = await (supabase as any).rpc(
      'get_birthday_customers'
    )

    if (customersError) {
      result.errors.push(`Failed to fetch birthday customers: ${customersError.message}`)
      return result
    }

    if (!customers || customers.length === 0) {
      result.success = true
      return result
    }

    result.customersFound = customers.length

    // Create promotion
    const template: PromotionTemplate = trigger.promotion_template
    const { promotionId, error: createError } = await createPromotionFromTemplate(
      template,
      `${trigger.trigger_name}_${new Date().getTime()}`
    )

    if (createError || !promotionId) {
      result.errors.push(`Failed to create promotion: ${createError}`)
      return result
    }

    result.promotionsCreated = 1

    // Queue deliveries
    const customerIds = customers.map((c: any) => c.customer_id)
    const deliveryChannels = trigger.delivery_channels || ['email', 'sms']

    const queueResult = await queuePromotionDeliveries(
      promotionId,
      customerIds,
      deliveryChannels
    )

    result.deliveriesQueued = queueResult.queuedCount
    result.success = queueResult.success

    if (!queueResult.success) {
      result.errors.push(...queueResult.errors)
    }

    // Log automated deliveries
    await logAutomatedDeliveries(trigger.id, customerIds, promotionId)

    return result
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    return result
  }
}

/**
 * Process anniversary trigger
 */
export async function processAnniversaryTrigger(trigger: any): Promise<TriggerResult> {
  const result: TriggerResult = {
    success: false,
    triggerName: trigger.trigger_name,
    customersFound: 0,
    promotionsCreated: 0,
    deliveriesQueued: 0,
    errors: [],
  }

  try {
    const supabase = getServiceSupabase()

    // Get customers with upcoming anniversaries
    const { data: customers, error: customersError } = await (supabase as any).rpc(
      'get_anniversary_customers'
    )

    if (customersError) {
      result.errors.push(`Failed to fetch anniversary customers: ${customersError.message}`)
      return result
    }

    if (!customers || customers.length === 0) {
      result.success = true
      return result
    }

    result.customersFound = customers.length

    // Create promotion with personalized title
    const template: PromotionTemplate = trigger.promotion_template
    const { promotionId, error: createError } = await createPromotionFromTemplate(
      template,
      `${trigger.trigger_name}_${new Date().getTime()}`
    )

    if (createError || !promotionId) {
      result.errors.push(`Failed to create promotion: ${createError}`)
      return result
    }

    result.promotionsCreated = 1

    // Queue deliveries
    const customerIds = customers.map((c: any) => c.customer_id)
    const deliveryChannels = trigger.delivery_channels || ['email']

    const queueResult = await queuePromotionDeliveries(
      promotionId,
      customerIds,
      deliveryChannels
    )

    result.deliveriesQueued = queueResult.queuedCount
    result.success = queueResult.success

    if (!queueResult.success) {
      result.errors.push(...queueResult.errors)
    }

    // Log automated deliveries
    await logAutomatedDeliveries(trigger.id, customerIds, promotionId)

    return result
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    return result
  }
}

/**
 * Process high-value customer trigger
 */
export async function processHighValueTrigger(trigger: any): Promise<TriggerResult> {
  const result: TriggerResult = {
    success: false,
    triggerName: trigger.trigger_name,
    customersFound: 0,
    promotionsCreated: 0,
    deliveriesQueued: 0,
    errors: [],
  }

  try {
    const supabase = getServiceSupabase()
    const conditions = trigger.trigger_conditions
    const minLifetimeValue = conditions.min_lifetime_value || 1000

    // Get high-value customers
    const { data: customers, error: customersError } = await (supabase as any).rpc(
      'get_high_value_customers',
      { min_lifetime_value: minLifetimeValue }
    )

    if (customersError) {
      result.errors.push(`Failed to fetch high-value customers: ${customersError.message}`)
      return result
    }

    if (!customers || customers.length === 0) {
      result.success = true
      return result
    }

    result.customersFound = customers.length

    // Check if these customers already received this trigger recently (e.g., within 30 days)
    const { data: recentDeliveries } = await supabase
      .from('automated_promotion_deliveries')
      .select('customer_id')
      .eq('promotion_trigger_id', trigger.id)
      .gte('triggered_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const recentCustomerIds = new Set(
      (recentDeliveries || []).map((d: any) => d.customer_id)
    )

    // Filter out customers who received this recently
    const eligibleCustomers = customers.filter(
      (c: any) => !recentCustomerIds.has(c.customer_id)
    )

    if (eligibleCustomers.length === 0) {
      result.success = true
      return result
    }

    // Create promotion
    const template: PromotionTemplate = trigger.promotion_template
    const { promotionId, error: createError } = await createPromotionFromTemplate(
      template,
      `${trigger.trigger_name}_${new Date().getTime()}`
    )

    if (createError || !promotionId) {
      result.errors.push(`Failed to create promotion: ${createError}`)
      return result
    }

    result.promotionsCreated = 1

    // Queue deliveries
    const customerIds = eligibleCustomers.map((c: any) => c.customer_id)
    const deliveryChannels = trigger.delivery_channels || ['email']

    const queueResult = await queuePromotionDeliveries(
      promotionId,
      customerIds,
      deliveryChannels
    )

    result.deliveriesQueued = queueResult.queuedCount
    result.success = queueResult.success

    if (!queueResult.success) {
      result.errors.push(...queueResult.errors)
    }

    // Log automated deliveries
    await logAutomatedDeliveries(trigger.id, customerIds, promotionId)

    return result
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    return result
  }
}

/**
 * Create promotion from template
 */
async function createPromotionFromTemplate(
  template: PromotionTemplate,
  uniqueCode: string
): Promise<{ promotionId?: string; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    // Calculate dates
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + (template.valid_days || 30))

    // Generate promo code
    const promoCode = `AUTO_${uniqueCode.substring(0, 8).toUpperCase()}_${Date.now().toString(36).toUpperCase()}`

    // Create promotion
    const { data: promotion, error } = await (supabase as any)
      .from('promotions')
      .insert({
        title: template.title,
        description: template.description,
        promotion_type: template.promotion_type,
        discount_value: template.discount_value,
        discount_percentage: template.discount_percentage,
        free_addon_service: template.free_addon_service,
        target_audience: template.target_audience,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        promo_code: promoCode,
        status: 'active',
        auto_deliver: true,
        delivery_channels: JSON.stringify(['portal', 'email']),
        current_redemptions: 0,
      })
      .select('id')
      .single()

    if (error) {
      return { error: error.message }
    }

    return { promotionId: (promotion as any).id }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error creating promotion',
    }
  }
}

/**
 * Log automated deliveries
 */
async function logAutomatedDeliveries(
  triggerId: string,
  customerIds: string[],
  promotionId: string
): Promise<void> {
  try {
    const supabase = getServiceSupabase()

    const deliveries = customerIds.map((customerId) => ({
      promotion_trigger_id: triggerId,
      customer_id: customerId,
      promotion_id: promotionId,
      triggered_at: new Date().toISOString(),
    }))

    await (supabase as any)
      .from('automated_promotion_deliveries')
      .insert(deliveries)
  } catch (error) {
    console.error('[Triggers] Error logging automated deliveries:', error)
  }
}

/**
 * Process all active triggers
 */
export async function processAllTriggers(): Promise<{
  totalProcessed: number
  results: TriggerResult[]
}> {
  const supabase = getServiceSupabase()

  // Get all active triggers
  const { data: triggers, error: triggersError } = await supabase
    .from('promotion_triggers')
    .select('*')
    .eq('active', true)
    .order('trigger_type')

  if (triggersError) {
    console.error('[Triggers] Error fetching triggers:', triggersError)
    return { totalProcessed: 0, results: [] }
  }

  if (!triggers || triggers.length === 0) {
    return { totalProcessed: 0, results: [] }
  }

  const results: TriggerResult[] = []

  for (const trigger of triggers) {
    let result: TriggerResult

    switch ((trigger as any).trigger_type) {
      case 'inactive_customer':
        result = await processInactiveCustomerTrigger(trigger)
        break
      case 'birthday':
        result = await processBirthdayTrigger(trigger)
        break
      case 'anniversary':
        result = await processAnniversaryTrigger(trigger)
        break
      case 'high_value':
        result = await processHighValueTrigger(trigger)
        break
      case 'referral':
        // Referrals are handled separately via webhook/event
        result = {
          success: true,
          triggerName: (trigger as any).trigger_name,
          customersFound: 0,
          promotionsCreated: 0,
          deliveriesQueued: 0,
          errors: [],
        }
        break
      default:
        result = {
          success: false,
          triggerName: (trigger as any).trigger_name,
          customersFound: 0,
          promotionsCreated: 0,
          deliveriesQueued: 0,
          errors: [`Unknown trigger type: ${(trigger as any).trigger_type}`],
        }
    }

    results.push(result)

    // Log execution
    await (supabase as any).rpc('log_trigger_execution', {
      p_trigger_id: (trigger as any).id,
      p_customers_found: result.customersFound,
      p_deliveries_created: result.deliveriesQueued,
    })
  }

  return {
    totalProcessed: triggers.length,
    results,
  }
}
