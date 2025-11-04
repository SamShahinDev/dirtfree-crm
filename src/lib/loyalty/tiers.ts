/**
 * Loyalty Tiers System
 *
 * Manages customer loyalty tiers, benefits, and automatic progression
 */

import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export interface LoyaltyTier {
  id: string
  tier_name: string
  tier_level: number
  points_required: number
  benefits: Record<string, any>
  discount_percentage: number
  free_upgrades: string[]
  priority_scheduling: boolean
  icon_url: string | null
  color: string | null
  active: boolean
}

export interface TierProgress {
  current_tier: LoyaltyTier
  next_tier: LoyaltyTier | null
  current_points: number
  points_to_next_tier: number | null
  progress_percentage: number
}

export interface TierUpgradeResult {
  upgraded: boolean
  previous_tier: LoyaltyTier | null
  new_tier: LoyaltyTier
  bonus_points_awarded: number
  message: string
}

// ============================================================================
// Tier Definitions (from database)
// ============================================================================

/**
 * Tier structure:
 * - Bronze (Level 1): 0+ points - 5% discount, welcome benefits
 * - Silver (Level 2): 1,000+ points - 10% discount, priority support, free stain protection
 * - Gold (Level 3): 2,500+ points - 15% discount, priority scheduling, free room upgrade
 * - Platinum (Level 4): 5,000+ points - 20% discount, VIP benefits, all upgrades
 */

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate customer's current tier based on points
 */
export async function calculateCustomerTier(points: number): Promise<LoyaltyTier | null> {
  try {
    const supabase = await createClient()

    // Get the highest tier the customer qualifies for
    const { data: tier, error } = await supabase
      .from('loyalty_tiers')
      .select('*')
      .eq('active', true)
      .lte('points_required', points)
      .order('tier_level', { ascending: false })
      .limit(1)
      .single()

    if (error || !tier) {
      console.error('[Tiers] Calculate tier error:', error)
      // Return Bronze tier as fallback
      const { data: bronze } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .eq('tier_level', 1)
        .single()
      return bronze as LoyaltyTier | null
    }

    return tier as LoyaltyTier
  } catch (error) {
    console.error('[Tiers] Calculate tier error:', error)
    return null
  }
}

/**
 * Get all active tiers
 */
export async function getAllTiers(): Promise<LoyaltyTier[]> {
  try {
    const supabase = await createClient()

    const { data: tiers, error } = await supabase
      .from('loyalty_tiers')
      .select('*')
      .eq('active', true)
      .order('tier_level', { ascending: true })

    if (error) {
      console.error('[Tiers] Get all tiers error:', error)
      return []
    }

    return (tiers as LoyaltyTier[]) || []
  } catch (error) {
    console.error('[Tiers] Get all tiers error:', error)
    return []
  }
}

/**
 * Get tier benefits formatted for display
 */
export function getTierBenefits(tier: LoyaltyTier): {
  discount: string
  priority_scheduling: boolean
  free_upgrades: string[]
  special_benefits: string[]
} {
  const benefits = tier.benefits || {}

  // Extract special benefits from JSONB
  const specialBenefits: string[] = []

  if (benefits.birthday_discount) {
    specialBenefits.push(`${benefits.birthday_discount} birthday month discount`)
  }
  if (benefits.priority_support) {
    specialBenefits.push('Priority customer support')
  }
  if (benefits.free_room_upgrade) {
    specialBenefits.push(benefits.free_room_upgrade)
  }
  if (benefits.free_upholstery) {
    specialBenefits.push(benefits.free_upholstery)
  }
  if (benefits.annual_deep_clean) {
    specialBenefits.push(benefits.annual_deep_clean)
  }
  if (benefits.referral_bonus) {
    specialBenefits.push(benefits.referral_bonus)
  }
  if (benefits.vip_promotions || benefits.vip_events) {
    specialBenefits.push('Exclusive VIP promotions and events')
  }
  if (benefits.lifetime_guarantee) {
    specialBenefits.push('Lifetime satisfaction guarantee')
  }

  return {
    discount: `${tier.discount_percentage}%`,
    priority_scheduling: tier.priority_scheduling,
    free_upgrades: tier.free_upgrades || [],
    special_benefits: specialBenefits,
  }
}

/**
 * Get customer's tier progress
 */
export async function getCustomerTierProgress(
  customerId: string
): Promise<TierProgress | null> {
  try {
    const supabase = await createClient()

    // Get customer's loyalty points
    const { data: loyalty } = await supabase
      .from('customer_loyalty')
      .select('total_points')
      .eq('customer_id', customerId)
      .single()

    const currentPoints = (loyalty as any)?.total_points || 0

    // Get current tier
    const currentTier = await calculateCustomerTier(currentPoints)
    if (!currentTier) return null

    // Get all tiers to find next tier
    const allTiers = await getAllTiers()
    const nextTier = allTiers.find((t) => t.tier_level === currentTier.tier_level + 1) || null

    // Calculate progress
    let pointsToNextTier: number | null = null
    let progressPercentage = 100

    if (nextTier) {
      pointsToNextTier = nextTier.points_required - currentPoints
      const pointsInCurrentTier = currentPoints - currentTier.points_required
      const pointsNeededForNextTier = nextTier.points_required - currentTier.points_required

      if (pointsNeededForNextTier > 0) {
        progressPercentage = Math.min(
          100,
          Math.round((pointsInCurrentTier / pointsNeededForNextTier) * 100)
        )
      }
    }

    return {
      current_tier: currentTier,
      next_tier: nextTier,
      current_points: currentPoints,
      points_to_next_tier: pointsToNextTier,
      progress_percentage: progressPercentage,
    }
  } catch (error) {
    console.error('[Tiers] Get tier progress error:', error)
    return null
  }
}

/**
 * Check if customer has upgraded to a new tier
 */
export async function checkTierUpgrade(customerId: string): Promise<TierUpgradeResult | null> {
  try {
    const supabase = await createClient()

    // Get customer's current loyalty info
    const { data: loyalty } = await supabase
      .from('customer_loyalty')
      .select('total_points, current_tier_id, current_tier_level')
      .eq('customer_id', customerId)
      .single()

    if (!loyalty) {
      console.log('[Tiers] No loyalty record found for customer:', customerId)
      return null
    }

    const currentPoints = (loyalty as any).total_points || 0
    const previousTierLevel = (loyalty as any).current_tier_level || 1

    // Calculate what tier they should be in based on points
    const correctTier = await calculateCustomerTier(currentPoints)
    if (!correctTier) return null

    // Check if tier has changed
    if (correctTier.tier_level <= previousTierLevel) {
      return {
        upgraded: false,
        previous_tier: null,
        new_tier: correctTier,
        bonus_points_awarded: 0,
        message: 'No tier upgrade',
      }
    }

    // Get previous tier for comparison
    const { data: previousTier } = await supabase
      .from('loyalty_tiers')
      .select('*')
      .eq('tier_level', previousTierLevel)
      .single()

    return {
      upgraded: true,
      previous_tier: previousTier as LoyaltyTier | null,
      new_tier: correctTier,
      bonus_points_awarded: 0, // Will be set by awardTierUpgradeBonus
      message: `Upgraded from ${(previousTier as any)?.tier_name || 'Bronze'} to ${correctTier.tier_name}`,
    }
  } catch (error) {
    console.error('[Tiers] Check tier upgrade error:', error)
    return null
  }
}

/**
 * Award tier upgrade bonus and update customer's tier
 */
export async function awardTierUpgradeBonus(
  customerId: string,
  newTier: LoyaltyTier
): Promise<{ success: boolean; bonus_points: number }> {
  try {
    const supabase = await createClient()

    // Calculate bonus points (10% of points required for new tier)
    const bonusPoints = Math.floor(newTier.points_required * 0.1)

    // Update customer loyalty record
    const { error: updateError } = await (supabase as any)
      .from('customer_loyalty')
      .update({
        current_tier_id: newTier.id,
        current_tier_level: newTier.tier_level,
        total_points: (supabase as any).raw(`total_points + ${bonusPoints}`),
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customerId)

    if (updateError) {
      console.error('[Tiers] Update tier error:', updateError)
      return { success: false, bonus_points: 0 }
    }

    // Log the tier upgrade in loyalty history
    await supabase.from('loyalty_history').insert({
      customer_id: customerId,
      points_change: bonusPoints,
      reason: `Tier upgrade bonus - ${newTier.tier_name}`,
      transaction_type: 'tier_upgrade_bonus',
      created_at: new Date().toISOString(),
    } as any)

    console.log(
      `[Tiers] Awarded ${bonusPoints} points to customer ${customerId} for ${newTier.tier_name} upgrade`
    )

    return { success: true, bonus_points: bonusPoints }
  } catch (error) {
    console.error('[Tiers] Award tier upgrade bonus error:', error)
    return { success: false, bonus_points: 0 }
  }
}

/**
 * Get tier by name
 */
export async function getTierByName(tierName: string): Promise<LoyaltyTier | null> {
  try {
    const supabase = await createClient()

    const { data: tier, error } = await supabase
      .from('loyalty_tiers')
      .select('*')
      .eq('tier_name', tierName)
      .eq('active', true)
      .single()

    if (error) {
      console.error('[Tiers] Get tier by name error:', error)
      return null
    }

    return tier as LoyaltyTier | null
  } catch (error) {
    console.error('[Tiers] Get tier by name error:', error)
    return null
  }
}

/**
 * Get tier by level
 */
export async function getTierByLevel(level: number): Promise<LoyaltyTier | null> {
  try {
    const supabase = await createClient()

    const { data: tier, error } = await supabase
      .from('loyalty_tiers')
      .select('*')
      .eq('tier_level', level)
      .eq('active', true)
      .single()

    if (error) {
      console.error('[Tiers] Get tier by level error:', error)
      return null
    }

    return tier as LoyaltyTier | null
  } catch (error) {
    console.error('[Tiers] Get tier by level error:', error)
    return null
  }
}

/**
 * Format tier benefits for email/display
 */
export function formatTierBenefitsForDisplay(tier: LoyaltyTier): string[] {
  const benefits: string[] = []

  // Discount
  if (tier.discount_percentage > 0) {
    benefits.push(`${tier.discount_percentage}% discount on all services`)
  }

  // Priority scheduling
  if (tier.priority_scheduling) {
    benefits.push('Priority scheduling')
  }

  // Free upgrades
  if (tier.free_upgrades && tier.free_upgrades.length > 0) {
    tier.free_upgrades.forEach((upgrade) => {
      const formatted = upgrade.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      benefits.push(`Free ${formatted}`)
    })
  }

  // JSONB benefits
  const jsonBenefits = tier.benefits || {}
  Object.entries(jsonBenefits).forEach(([key, value]) => {
    if (typeof value === 'string' && key !== 'discount') {
      benefits.push(value)
    } else if (typeof value === 'boolean' && value === true) {
      const formatted = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      benefits.push(formatted)
    }
  })

  return benefits
}
