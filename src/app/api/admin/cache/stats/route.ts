/**
 * Cache Statistics API
 *
 * GET /api/admin/cache/stats - Get cache statistics
 * POST /api/admin/cache/stats - Clear cache(s)
 *
 * Admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAllCacheStats,
  getCacheStats,
  getCacheEfficiency,
  getCacheHitRate,
  clearCache,
  clearAllCaches,
  resetCacheStats,
  resetAllCacheStats,
  type CacheName,
} from '@/lib/cache/redis-cache'

/**
 * Check if user is admin
 */
async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) return false

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    return (userData as any)?.role === 'admin'
  } catch {
    return false
  }
}

/**
 * GET /api/admin/cache/stats
 *
 * Get statistics for all caches or a specific cache
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin permission
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const cacheName = searchParams.get('cache') as CacheName | null

    // Get stats for specific cache or all caches
    if (cacheName) {
      const stats = getCacheStats(cacheName)
      const efficiency = getCacheEfficiency(cacheName)
      const hitRate = getCacheHitRate(cacheName)

      return NextResponse.json({
        cache: cacheName,
        stats,
        efficiency,
        hitRate: hitRate.toFixed(2) + '%',
      })
    } else {
      const allStats = getAllCacheStats()

      // Calculate overall statistics
      const overall = Object.entries(allStats).reduce(
        (acc, [name, stats]) => {
          return {
            totalHits: acc.totalHits + stats.hits,
            totalMisses: acc.totalMisses + stats.misses,
            totalSets: acc.totalSets + stats.sets,
            totalDeletes: acc.totalDeletes + stats.deletes,
            totalSize: acc.totalSize + stats.size,
            totalMaxSize: acc.totalMaxSize + stats.maxSize,
            caches: {
              ...acc.caches,
              [name]: {
                ...stats,
                hitRate: getCacheHitRate(name as CacheName).toFixed(2) + '%',
                efficiency: getCacheEfficiency(name as CacheName),
              },
            },
          }
        },
        {
          totalHits: 0,
          totalMisses: 0,
          totalSets: 0,
          totalDeletes: 0,
          totalSize: 0,
          totalMaxSize: 0,
          caches: {},
        }
      )

      const totalRequests = overall.totalHits + overall.totalMisses
      const overallHitRate = totalRequests > 0 ? (overall.totalHits / totalRequests) * 100 : 0

      return NextResponse.json({
        summary: {
          totalCaches: Object.keys(allStats).length,
          totalHits: overall.totalHits,
          totalMisses: overall.totalMisses,
          totalRequests,
          overallHitRate: overallHitRate.toFixed(2) + '%',
          totalSets: overall.totalSets,
          totalDeletes: overall.totalDeletes,
          totalSize: overall.totalSize,
          totalMaxSize: overall.totalMaxSize,
          utilizationRate: ((overall.totalSize / overall.totalMaxSize) * 100).toFixed(2) + '%',
        },
        caches: overall.caches,
      })
    }
  } catch (error: any) {
    console.error('Error fetching cache stats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/cache/stats
 *
 * Clear cache or reset statistics
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin permission
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { action, cache } = body

    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 })
    }

    switch (action) {
      case 'clear':
        if (cache) {
          clearCache(cache as CacheName)
          return NextResponse.json({
            success: true,
            message: `Cache '${cache}' cleared`,
          })
        } else {
          clearAllCaches()
          return NextResponse.json({
            success: true,
            message: 'All caches cleared',
          })
        }

      case 'reset_stats':
        if (cache) {
          resetCacheStats(cache as CacheName)
          return NextResponse.json({
            success: true,
            message: `Statistics for '${cache}' reset`,
          })
        } else {
          resetAllCacheStats()
          return NextResponse.json({
            success: true,
            message: 'All statistics reset',
          })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error managing cache:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/cache/stats
 *
 * Clear specific cache
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check admin permission
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const cacheName = searchParams.get('cache') as CacheName

    if (!cacheName) {
      return NextResponse.json({ error: 'Cache name required' }, { status: 400 })
    }

    clearCache(cacheName)

    return NextResponse.json({
      success: true,
      message: `Cache '${cacheName}' cleared`,
    })
  } catch (error: any) {
    console.error('Error clearing cache:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
