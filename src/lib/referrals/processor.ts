/**
 * Referral Program Processor
 *
 * Manages referral code generation, tracking, and reward distribution
 */

import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export interface Referral {
  id: string
  referrer_customer_id: string
  referred_customer_id: string | null
  referral_code: string
  referred_email: string | null
  referred_phone: string | null
  status: 'pending' | 'registered' | 'booked' | 'completed'
  clicks: number
  referrer_points_awarded: number
  referred_discount_applied: number
  service_job_id: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ReferralStats {
  total_sent: number
  pending: number
  registered: number
  booked: number
  completed: number
  total_points_earned: number
  total_clicks: number
}

export interface ReferralReward {
  referrer_points: number
  referred_discount_amount: number
}

// Default referral rewards
export const REFERRAL_REWARDS: ReferralReward = {
  referrer_points: 500,
  referred_discount_amount: 20,
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate unique referral code for a customer
 */
export async function generateReferralCode(customerId: string): Promise<string | null> {
  try {
    const supabase = await createClient()

    // Get customer name for code generation
    const { data: customer } = await supabase
      .from('customers')
      .select('first_name, last_name')
      .eq('id', customerId)
      .single()

    if (!customer) {
      console.error('[Referrals] Customer not found:', customerId)
      return null
    }

    // Use the database function to generate a unique code
    const { data: code, error } = await (supabase as any).rpc('generate_referral_code', {
      p_customer_id: customerId,
    })

    if (error) {
      console.error('[Referrals] Generate code error:', error)
      return null
    }

    console.log(`[Referrals] Generated code for customer ${customerId}: ${code}`)
    return code as string
  } catch (error) {
    console.error('[Referrals] Generate referral code error:', error)
    return null
  }
}

/**
 * Get or create customer's referral code
 */
export async function getOrCreateReferralCode(customerId: string): Promise<string | null> {
  try {
    const supabase = await createClient()

    // Check if customer already has a referral code
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('referral_code')
      .eq('referrer_customer_id', customerId)
      .limit(1)
      .single()

    if (existingReferral) {
      return (existingReferral as any).referral_code
    }

    // Generate new code
    return await generateReferralCode(customerId)
  } catch (error) {
    console.error('[Referrals] Get or create referral code error:', error)
    return null
  }
}

/**
 * Track referral link click
 */
export async function trackReferralClick(code: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Increment click count for all referrals with this code
    const { error } = await (supabase as any)
      .from('referrals')
      .update({
        clicks: (supabase as any).raw('clicks + 1'),
        updated_at: new Date().toISOString(),
      })
      .eq('referral_code', code)

    if (error) {
      console.error('[Referrals] Track click error:', error)
      return false
    }

    console.log(`[Referrals] Tracked click for code: ${code}`)
    return true
  } catch (error) {
    console.error('[Referrals] Track referral click error:', error)
    return false
  }
}

/**
 * Register a referred customer
 */
export async function registerReferredCustomer(
  code: string,
  newCustomerId: string
): Promise<{ success: boolean; referralId?: string; message: string }> {
  try {
    const supabase = await createClient()

    // Find referral by code with pending status
    const { data: referrals, error: fetchError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', code)
      .eq('status', 'pending')

    if (fetchError) {
      console.error('[Referrals] Fetch referral error:', fetchError)
      return { success: false, message: 'Failed to find referral' }
    }

    if (!referrals || referrals.length === 0) {
      return { success: false, message: 'Invalid or already used referral code' }
    }

    // Update the first matching referral
    const referral = referrals[0]
    const { data: updated, error: updateError } = await (supabase as any)
      .from('referrals')
      .update({
        referred_customer_id: newCustomerId,
        status: 'registered',
        updated_at: new Date().toISOString(),
      })
      .eq('id', (referral as any).id)
      .select()
      .single()

    if (updateError) {
      console.error('[Referrals] Update referral error:', updateError)
      return { success: false, message: 'Failed to register referral' }
    }

    console.log(`[Referrals] Registered customer ${newCustomerId} with code ${code}`)

    return {
      success: true,
      referralId: (referral as any).id,
      message: 'Referral registered successfully',
    }
  } catch (error) {
    console.error('[Referrals] Register referred customer error:', error)
    return { success: false, message: 'Internal error' }
  }
}

/**
 * Mark referral as booked when referred customer creates a booking
 */
export async function markReferralBooked(
  customerId: string,
  jobId: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Find referral for this customer with registered status
    const { data: referral, error: fetchError } = await supabase
      .from('referrals')
      .select('id, status')
      .eq('referred_customer_id', customerId)
      .in('status', ['registered', 'pending'])
      .limit(1)
      .single()

    if (fetchError || !referral) {
      console.log(`[Referrals] No referral found for customer ${customerId}`)
      return false
    }

    // Update to booked status
    const { error: updateError } = await (supabase as any)
      .from('referrals')
      .update({
        status: 'booked',
        service_job_id: jobId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (referral as any).id)

    if (updateError) {
      console.error('[Referrals] Mark booked error:', updateError)
      return false
    }

    console.log(`[Referrals] Marked referral as booked for customer ${customerId}, job ${jobId}`)
    return true
  } catch (error) {
    console.error('[Referrals] Mark referral booked error:', error)
    return false
  }
}

/**
 * Complete referral and award points when service is completed
 */
export async function completeReferral(
  referralId: string
): Promise<{ success: boolean; points_awarded: number; message: string }> {
  try {
    const supabase = await createClient()

    // Get referral details
    const { data: referral, error: fetchError } = await supabase
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .single()

    if (fetchError || !referral) {
      return { success: false, points_awarded: 0, message: 'Referral not found' }
    }

    const referralData = referral as any

    // Check if already completed
    if (referralData.status === 'completed') {
      return {
        success: false,
        points_awarded: 0,
        message: 'Referral already completed',
      }
    }

    // Check if has required fields
    if (!referralData.referred_customer_id || !referralData.service_job_id) {
      return {
        success: false,
        points_awarded: 0,
        message: 'Referral missing required data',
      }
    }

    // Award points to referrer
    const pointsAwarded = REFERRAL_REWARDS.referrer_points

    const { error: loyaltyError } = await (supabase as any)
      .from('customer_loyalty')
      .update({
        total_points: (supabase as any).raw(`total_points + ${pointsAwarded}`),
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', referralData.referrer_customer_id)

    if (loyaltyError) {
      console.error('[Referrals] Award loyalty points error:', loyaltyError)
      return { success: false, points_awarded: 0, message: 'Failed to award points' }
    }

    // Log in loyalty history
    await supabase.from('loyalty_history').insert({
      customer_id: referralData.referrer_customer_id,
      points_change: pointsAwarded,
      reason: `Referral completed - ${referralData.referral_code}`,
      transaction_type: 'referral_completed',
      created_at: new Date().toISOString(),
    } as any)

    // Update referral status
    const { error: updateError } = await (supabase as any)
      .from('referrals')
      .update({
        status: 'completed',
        referrer_points_awarded: pointsAwarded,
        referred_discount_applied: REFERRAL_REWARDS.referred_discount_amount,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', referralId)

    if (updateError) {
      console.error('[Referrals] Update referral status error:', updateError)
      return { success: false, points_awarded: 0, message: 'Failed to update referral' }
    }

    // Check for referral achievement
    const { checkAchievements } = await import('@/lib/loyalty/achievements')
    await checkAchievements(referralData.referrer_customer_id, 'referral_completed')

    console.log(
      `[Referrals] Completed referral ${referralId}, awarded ${pointsAwarded} points to customer ${referralData.referrer_customer_id}`
    )

    return {
      success: true,
      points_awarded: pointsAwarded,
      message: 'Referral completed successfully',
    }
  } catch (error) {
    console.error('[Referrals] Complete referral error:', error)
    return { success: false, points_awarded: 0, message: 'Internal error' }
  }
}

/**
 * Get customer's referral statistics
 */
export async function getCustomerReferralStats(customerId: string): Promise<ReferralStats> {
  try {
    const supabase = await createClient()

    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_customer_id', customerId)

    if (error) {
      console.error('[Referrals] Get stats error:', error)
      return {
        total_sent: 0,
        pending: 0,
        registered: 0,
        booked: 0,
        completed: 0,
        total_points_earned: 0,
        total_clicks: 0,
      }
    }

    const stats: ReferralStats = {
      total_sent: referrals?.length || 0,
      pending: 0,
      registered: 0,
      booked: 0,
      completed: 0,
      total_points_earned: 0,
      total_clicks: 0,
    }

    referrals?.forEach((r: any) => {
      switch (r.status) {
        case 'pending':
          stats.pending++
          break
        case 'registered':
          stats.registered++
          break
        case 'booked':
          stats.booked++
          break
        case 'completed':
          stats.completed++
          break
      }
      stats.total_points_earned += r.referrer_points_awarded || 0
      stats.total_clicks += r.clicks || 0
    })

    return stats
  } catch (error) {
    console.error('[Referrals] Get customer referral stats error:', error)
    return {
      total_sent: 0,
      pending: 0,
      registered: 0,
      booked: 0,
      completed: 0,
      total_points_earned: 0,
      total_clicks: 0,
    }
  }
}

/**
 * Create a new referral invitation
 */
export async function createReferralInvitation(
  customerId: string,
  email?: string,
  phone?: string
): Promise<{ success: boolean; referral?: Referral; message: string }> {
  try {
    const supabase = await createClient()

    // Get or create referral code
    let referralCode = await getOrCreateReferralCode(customerId)

    if (!referralCode) {
      referralCode = await generateReferralCode(customerId)
      if (!referralCode) {
        return { success: false, message: 'Failed to generate referral code' }
      }
    }

    // Create referral record
    const { data: referral, error } = await (supabase as any)
      .from('referrals')
      .insert({
        referrer_customer_id: customerId,
        referral_code: referralCode,
        referred_email: email || null,
        referred_phone: phone || null,
        status: 'pending',
        clicks: 0,
        referrer_points_awarded: 0,
        referred_discount_applied: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('[Referrals] Create invitation error:', error)
      return { success: false, message: 'Failed to create referral' }
    }

    console.log(`[Referrals] Created referral invitation for customer ${customerId}`)

    return {
      success: true,
      referral: referral as Referral,
      message: 'Referral invitation created',
    }
  } catch (error) {
    console.error('[Referrals] Create referral invitation error:', error)
    return { success: false, message: 'Internal error' }
  }
}

/**
 * Get referral by code
 */
export async function getReferralByCode(code: string): Promise<Referral | null> {
  try {
    const supabase = await createClient()

    const { data: referral, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', code)
      .limit(1)
      .single()

    if (error) {
      console.error('[Referrals] Get referral by code error:', error)
      return null
    }

    return referral as Referral | null
  } catch (error) {
    console.error('[Referrals] Get referral by code error:', error)
    return null
  }
}

/**
 * Validate referral code
 */
export async function validateReferralCode(code: string): Promise<{
  valid: boolean
  message: string
  discount?: number
}> {
  try {
    const supabase = await createClient()

    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('referrer_customer_id, status')
      .eq('referral_code', code)

    if (error) {
      return { valid: false, message: 'Error validating code' }
    }

    if (!referrals || referrals.length === 0) {
      return { valid: false, message: 'Invalid referral code' }
    }

    // Check if any referrals with this code are still available
    const hasAvailable = referrals.some((r: any) => r.status === 'pending')

    if (!hasAvailable) {
      return { valid: false, message: 'Referral code has been used' }
    }

    return {
      valid: true,
      message: 'Valid referral code',
      discount: REFERRAL_REWARDS.referred_discount_amount,
    }
  } catch (error) {
    console.error('[Referrals] Validate referral code error:', error)
    return { valid: false, message: 'Internal error' }
  }
}
