import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllAchievements, getAchievementsByType, formatAchievementForDisplay } from '@/lib/loyalty/achievements'

/**
 * Loyalty Achievements API
 *
 * GET /api/loyalty/achievements
 * Returns all available achievements, optionally filtered by type
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
 * GET - List all achievements
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const { searchParams } = new URL(request.url)
    const achievementType = searchParams.get('type') as any

    // Get achievements (filtered or all)
    let achievements
    if (achievementType) {
      achievements = await getAchievementsByType(achievementType)
    } else {
      achievements = await getAllAchievements()
    }

    // Group by type
    const groupedByType = achievements.reduce((acc: any, achievement: any) => {
      const type = achievement.achievement_type
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push({
        ...achievement,
        formatted: formatAchievementForDisplay(achievement),
      })
      return acc
    }, {})

    // Group by rarity
    const groupedByRarity = achievements.reduce((acc: any, achievement: any) => {
      const rarity = achievement.rarity
      if (!acc[rarity]) {
        acc[rarity] = []
      }
      acc[rarity].push(achievement)
      return acc
    }, {})

    // Calculate statistics
    const stats = {
      total: achievements.length,
      by_type: {
        milestone: achievements.filter((a: any) => a.achievement_type === 'milestone').length,
        streak: achievements.filter((a: any) => a.achievement_type === 'streak').length,
        referral: achievements.filter((a: any) => a.achievement_type === 'referral').length,
        review: achievements.filter((a: any) => a.achievement_type === 'review').length,
        social: achievements.filter((a: any) => a.achievement_type === 'social').length,
      },
      by_rarity: {
        common: achievements.filter((a: any) => a.rarity === 'common').length,
        rare: achievements.filter((a: any) => a.rarity === 'rare').length,
        epic: achievements.filter((a: any) => a.rarity === 'epic').length,
        legendary: achievements.filter((a: any) => a.rarity === 'legendary').length,
      },
      total_points_available: achievements.reduce((sum: number, a: any) => sum + a.points_award, 0),
    }

    return createSuccessResponse({
      achievements,
      grouped_by_type: groupedByType,
      grouped_by_rarity: groupedByRarity,
      stats,
    })
  } catch (error) {
    console.error('[Achievements API] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
