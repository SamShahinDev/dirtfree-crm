/**
 * Loyalty Achievements System
 *
 * Manages customer achievements, badges, and gamification elements
 */

import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

export interface LoyaltyAchievement {
  id: string
  achievement_name: string
  achievement_type: 'milestone' | 'streak' | 'referral' | 'review' | 'social'
  description: string
  requirements: Record<string, any>
  points_award: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  icon_url: string | null
  badge_color: string | null
  active: boolean
  created_at: string
}

export interface CustomerAchievement {
  id: string
  customer_id: string
  achievement_id: string
  earned_at: string
  achievement?: LoyaltyAchievement
}

export interface AchievementProgress {
  achievement: LoyaltyAchievement
  earned: boolean
  earned_at?: string
  progress?: {
    current: number
    required: number
    percentage: number
  }
}

export interface AwardAchievementResult {
  success: boolean
  achievement?: LoyaltyAchievement
  points_awarded: number
  message: string
  already_earned?: boolean
}

export type AchievementEventType =
  | 'service_completed'
  | 'booking_created'
  | 'referral_completed'
  | 'review_submitted'
  | 'social_share'
  | 'social_tag'

export interface AchievementEventData {
  customerId: string
  eventType: AchievementEventType
  metadata?: Record<string, any>
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get all active achievements
 */
export async function getAllAchievements(): Promise<LoyaltyAchievement[]> {
  try {
    const supabase = await createClient()

    const { data: achievements, error } = await supabase
      .from('loyalty_achievements')
      .select('*')
      .eq('active', true)
      .order('achievement_type', { ascending: true })
      .order('points_award', { ascending: true })

    if (error) {
      console.error('[Achievements] Get all achievements error:', error)
      return []
    }

    return (achievements as LoyaltyAchievement[]) || []
  } catch (error) {
    console.error('[Achievements] Get all achievements error:', error)
    return []
  }
}

/**
 * Get achievements by type
 */
export async function getAchievementsByType(
  type: LoyaltyAchievement['achievement_type']
): Promise<LoyaltyAchievement[]> {
  try {
    const supabase = await createClient()

    const { data: achievements, error } = await supabase
      .from('loyalty_achievements')
      .select('*')
      .eq('achievement_type', type)
      .eq('active', true)
      .order('points_award', { ascending: true })

    if (error) {
      console.error('[Achievements] Get achievements by type error:', error)
      return []
    }

    return (achievements as LoyaltyAchievement[]) || []
  } catch (error) {
    console.error('[Achievements] Get achievements by type error:', error)
    return []
  }
}

/**
 * Get customer's earned achievements
 */
export async function getCustomerAchievements(
  customerId: string
): Promise<CustomerAchievement[]> {
  try {
    const supabase = await createClient()

    const { data: customerAchievements, error } = await supabase
      .from('customer_achievements')
      .select(`
        *,
        achievement:loyalty_achievements(*)
      `)
      .eq('customer_id', customerId)
      .order('earned_at', { ascending: false })

    if (error) {
      console.error('[Achievements] Get customer achievements error:', error)
      return []
    }

    return (customerAchievements as any[]) || []
  } catch (error) {
    console.error('[Achievements] Get customer achievements error:', error)
    return []
  }
}

/**
 * Get unlocked (earned) achievements for a customer
 */
export async function getUnlockedAchievements(
  customerId: string
): Promise<LoyaltyAchievement[]> {
  try {
    const customerAchievements = await getCustomerAchievements(customerId)
    return customerAchievements
      .map((ca) => (ca as any).achievement)
      .filter((a) => a) as LoyaltyAchievement[]
  } catch (error) {
    console.error('[Achievements] Get unlocked achievements error:', error)
    return []
  }
}

/**
 * Get achievement progress for a customer
 */
export async function getAchievementProgress(
  customerId: string
): Promise<AchievementProgress[]> {
  try {
    const supabase = await createClient()

    // Get all achievements
    const allAchievements = await getAllAchievements()

    // Get earned achievements
    const earnedAchievements = await getCustomerAchievements(customerId)
    const earnedIds = new Set(earnedAchievements.map((ea) => ea.achievement_id))

    // Get customer stats for progress calculation
    const stats = await getCustomerStats(customerId)

    // Build progress for each achievement
    const progress: AchievementProgress[] = allAchievements.map((achievement) => {
      const earned = earnedIds.has(achievement.id)
      const earnedRecord = earnedAchievements.find((ea) => ea.achievement_id === achievement.id)

      const baseProgress: AchievementProgress = {
        achievement,
        earned,
        earned_at: earnedRecord?.earned_at,
      }

      // Calculate progress for unearn achievements
      if (!earned) {
        const progressData = calculateAchievementProgress(achievement, stats)
        if (progressData) {
          baseProgress.progress = progressData
        }
      }

      return baseProgress
    })

    return progress
  } catch (error) {
    console.error('[Achievements] Get achievement progress error:', error)
    return []
  }
}

/**
 * Award an achievement to a customer
 */
export async function awardAchievement(
  customerId: string,
  achievementId: string
): Promise<AwardAchievementResult> {
  try {
    const supabase = await createClient()

    // Check if already earned
    const { data: existing } = await supabase
      .from('customer_achievements')
      .select('id')
      .eq('customer_id', customerId)
      .eq('achievement_id', achievementId)
      .single()

    if (existing) {
      return {
        success: false,
        points_awarded: 0,
        message: 'Achievement already earned',
        already_earned: true,
      }
    }

    // Get achievement details
    const { data: achievement, error: achError } = await supabase
      .from('loyalty_achievements')
      .select('*')
      .eq('id', achievementId)
      .single()

    if (achError || !achievement) {
      return {
        success: false,
        points_awarded: 0,
        message: 'Achievement not found',
      }
    }

    // Award the achievement using the database function
    const { data: result, error: awardError } = await (supabase as any).rpc(
      'award_achievement',
      {
        p_customer_id: customerId,
        p_achievement_id: achievementId,
      }
    )

    if (awardError) {
      console.error('[Achievements] Award achievement error:', awardError)
      return {
        success: false,
        points_awarded: 0,
        message: 'Failed to award achievement',
      }
    }

    console.log(
      `[Achievements] Awarded "${(achievement as any).achievement_name}" to customer ${customerId} (${(achievement as any).points_award} pts)`
    )

    return {
      success: true,
      achievement: achievement as LoyaltyAchievement,
      points_awarded: (achievement as any).points_award,
      message: `Achievement "${(achievement as any).achievement_name}" unlocked!`,
    }
  } catch (error) {
    console.error('[Achievements] Award achievement error:', error)
    return {
      success: false,
      points_awarded: 0,
      message: 'Internal error',
    }
  }
}

/**
 * Check and award achievements based on an event
 */
export async function checkAchievements(
  customerId: string,
  eventType: AchievementEventType,
  eventData?: Record<string, any>
): Promise<AwardAchievementResult[]> {
  try {
    const supabase = await createClient()

    // Get customer stats
    const stats = await getCustomerStats(customerId)

    // Get all unearn achievements
    const allAchievements = await getAllAchievements()
    const earnedAchievements = await getCustomerAchievements(customerId)
    const earnedIds = new Set(earnedAchievements.map((ea) => ea.achievement_id))

    const unearnedAchievements = allAchievements.filter((a) => !earnedIds.has(a.id))

    // Check which achievements qualify
    const results: AwardAchievementResult[] = []

    for (const achievement of unearnedAchievements) {
      const qualifies = await checkAchievementQualification(
        achievement,
        eventType,
        stats,
        eventData
      )

      if (qualifies) {
        const result = await awardAchievement(customerId, achievement.id)
        if (result.success) {
          results.push(result)
        }
      }
    }

    return results
  } catch (error) {
    console.error('[Achievements] Check achievements error:', error)
    return []
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get customer statistics for achievement calculations
 */
async function getCustomerStats(customerId: string): Promise<Record<string, any>> {
  try {
    const supabase = await createClient()

    // Count completed services
    const { count: serviceCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'completed')

    // Count bookings
    const { count: bookingCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)

    // Count successful referrals
    const { count: referralCount } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_customer_id', customerId)
      .eq('status', 'completed')

    // Count reviews
    const { count: reviewCount } = await supabase
      .from('customer_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .not('google_review_url', 'is', null)

    // Get booking streak info
    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('scheduled_date')
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: false })
      .limit(10)

    const streak = calculateBookingStreak(recentJobs || [])

    // Count social shares (from customer metadata or separate table if exists)
    const { data: customer } = await supabase
      .from('customers')
      .select('metadata')
      .eq('id', customerId)
      .single()

    const socialShares = (customer as any)?.metadata?.social_shares || 0
    const socialTags = (customer as any)?.metadata?.social_tags || 0

    return {
      service_count: serviceCount || 0,
      booking_count: bookingCount || 0,
      referral_count: referralCount || 0,
      review_count: reviewCount || 0,
      booking_streak: streak,
      social_shares: socialShares,
      social_tags: socialTags,
    }
  } catch (error) {
    console.error('[Achievements] Get customer stats error:', error)
    return {}
  }
}

/**
 * Calculate booking streak
 */
function calculateBookingStreak(jobs: any[]): number {
  if (jobs.length === 0) return 0

  let streak = 0
  let lastDate: Date | null = null

  for (const job of jobs) {
    const currentDate = new Date(job.scheduled_date)

    if (!lastDate) {
      streak = 1
      lastDate = currentDate
      continue
    }

    const daysDiff = Math.floor(
      (lastDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Within 90 days is considered a streak
    if (daysDiff <= 90) {
      streak++
      lastDate = currentDate
    } else {
      break
    }
  }

  return streak
}

/**
 * Check if customer qualifies for an achievement
 */
async function checkAchievementQualification(
  achievement: LoyaltyAchievement,
  eventType: AchievementEventType,
  stats: Record<string, any>,
  eventData?: Record<string, any>
): Promise<boolean> {
  const reqs = achievement.requirements

  switch (achievement.achievement_type) {
    case 'milestone':
      if (eventType !== 'service_completed') return false
      return stats.service_count >= (reqs.service_count || 0)

    case 'streak':
      if (eventType !== 'booking_created' && eventType !== 'service_completed') return false
      return stats.booking_streak >= (reqs.streak_count || 0)

    case 'referral':
      if (eventType !== 'referral_completed') return false
      return stats.referral_count >= (reqs.referral_count || 0)

    case 'review':
      if (eventType !== 'review_submitted') return false
      return stats.review_count >= (reqs.review_count || 0)

    case 'social':
      if (eventType !== 'social_share' && eventType !== 'social_tag') return false
      if (eventType === 'social_share') {
        return stats.social_shares >= (reqs.share_count || 0)
      }
      if (eventType === 'social_tag') {
        return stats.social_tags >= (reqs.tag_count || 0)
      }
      return false

    default:
      return false
  }
}

/**
 * Calculate progress toward an achievement
 */
function calculateAchievementProgress(
  achievement: LoyaltyAchievement,
  stats: Record<string, any>
): { current: number; required: number; percentage: number } | null {
  const reqs = achievement.requirements

  let current = 0
  let required = 0

  switch (achievement.achievement_type) {
    case 'milestone':
      current = stats.service_count || 0
      required = reqs.service_count || 0
      break

    case 'streak':
      current = stats.booking_streak || 0
      required = reqs.streak_count || 0
      break

    case 'referral':
      current = stats.referral_count || 0
      required = reqs.referral_count || 0
      break

    case 'review':
      current = stats.review_count || 0
      required = reqs.review_count || 0
      break

    case 'social':
      if (reqs.share_count) {
        current = stats.social_shares || 0
        required = reqs.share_count
      } else if (reqs.tag_count) {
        current = stats.social_tags || 0
        required = reqs.tag_count
      }
      break

    default:
      return null
  }

  if (required === 0) return null

  const percentage = Math.min(100, Math.round((current / required) * 100))

  return { current, required, percentage }
}

/**
 * Get achievement by name
 */
export async function getAchievementByName(name: string): Promise<LoyaltyAchievement | null> {
  try {
    const supabase = await createClient()

    const { data: achievement, error } = await supabase
      .from('loyalty_achievements')
      .select('*')
      .eq('achievement_name', name)
      .eq('active', true)
      .single()

    if (error) {
      console.error('[Achievements] Get achievement by name error:', error)
      return null
    }

    return achievement as LoyaltyAchievement | null
  } catch (error) {
    console.error('[Achievements] Get achievement by name error:', error)
    return null
  }
}

/**
 * Format achievement for display
 */
export function formatAchievementForDisplay(achievement: LoyaltyAchievement): {
  name: string
  description: string
  points: string
  rarity: string
  rarityColor: string
} {
  const rarityColors: Record<string, string> = {
    common: '#94a3b8',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
  }

  return {
    name: achievement.achievement_name,
    description: achievement.description,
    points: `+${achievement.points_award} pts`,
    rarity: achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1),
    rarityColor: rarityColors[achievement.rarity] || '#94a3b8',
  }
}
