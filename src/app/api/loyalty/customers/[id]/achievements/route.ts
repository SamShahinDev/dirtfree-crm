import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCustomerAchievements,
  getAchievementProgress,
  getAllAchievements,
  formatAchievementForDisplay,
} from '@/lib/loyalty/achievements'

/**
 * Customer Achievements API
 *
 * GET /api/loyalty/customers/[id]/achievements
 * Returns customer's earned achievements and progress toward locked achievements
 *
 * Authentication: Required
 */

const API_VERSION = 'v1'

function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

function createSuccessResponse<T>(data: T) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() }
  )
}

/**
 * GET - Get customer's achievements and progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const customerId = params.id

    if (!customerId) {
      return createErrorResponse('invalid_request', 'Customer ID is required', 400)
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer not found', 404)
    }

    // Get achievement progress (includes earned and unearned)
    const progress = await getAchievementProgress(customerId)

    // Separate earned and locked achievements
    const earned = progress.filter((p) => p.earned)
    const locked = progress.filter((p) => !p.earned)

    // Calculate statistics
    const earnedPoints = earned.reduce((sum, p) => sum + p.achievement.points_award, 0)
    const totalPossiblePoints = progress.reduce((sum, p) => sum + p.achievement.points_award, 0)

    // Group earned by type
    const earnedByType = earned.reduce((acc: any, p) => {
      const type = p.achievement.achievement_type
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push({
        ...p.achievement,
        earned_at: p.earned_at,
        formatted: formatAchievementForDisplay(p.achievement),
      })
      return acc
    }, {})

    // Group locked by type with progress
    const lockedByType = locked.reduce((acc: any, p) => {
      const type = p.achievement.achievement_type
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push({
        ...p.achievement,
        progress: p.progress,
        formatted: formatAchievementForDisplay(p.achievement),
      })
      return acc
    }, {})

    // Get recent achievements (last 5)
    const recentAchievements = earned
      .sort((a, b) => {
        const dateA = new Date(a.earned_at || 0).getTime()
        const dateB = new Date(b.earned_at || 0).getTime()
        return dateB - dateA
      })
      .slice(0, 5)
      .map((p) => ({
        ...p.achievement,
        earned_at: p.earned_at,
        formatted: formatAchievementForDisplay(p.achievement),
      }))

    // Find next achievable (highest progress)
    const nextAchievable = locked
      .filter((p) => p.progress && p.progress.percentage > 0)
      .sort((a, b) => (b.progress?.percentage || 0) - (a.progress?.percentage || 0))
      .slice(0, 3)
      .map((p) => ({
        ...p.achievement,
        progress: p.progress,
        formatted: formatAchievementForDisplay(p.achievement),
      }))

    // Calculate completion percentage
    const completionPercentage = progress.length > 0
      ? Math.round((earned.length / progress.length) * 100)
      : 0

    return createSuccessResponse({
      customer: {
        id: (customer as any).id,
        name: `${(customer as any).first_name} ${(customer as any).last_name}`,
      },
      stats: {
        total_achievements: progress.length,
        earned: earned.length,
        locked: locked.length,
        completion_percentage: completionPercentage,
        points_earned: earnedPoints,
        total_possible_points: totalPossiblePoints,
        by_rarity: {
          common: earned.filter((p) => p.achievement.rarity === 'common').length,
          rare: earned.filter((p) => p.achievement.rarity === 'rare').length,
          epic: earned.filter((p) => p.achievement.rarity === 'epic').length,
          legendary: earned.filter((p) => p.achievement.rarity === 'legendary').length,
        },
      },
      earned_achievements: {
        all: earned.map((p) => ({
          ...p.achievement,
          earned_at: p.earned_at,
          formatted: formatAchievementForDisplay(p.achievement),
        })),
        by_type: earnedByType,
        recent: recentAchievements,
      },
      locked_achievements: {
        all: locked.map((p) => ({
          ...p.achievement,
          progress: p.progress,
          formatted: formatAchievementForDisplay(p.achievement),
        })),
        by_type: lockedByType,
        next_achievable: nextAchievable,
      },
    })
  } catch (error) {
    console.error('[Customer Achievements API] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
