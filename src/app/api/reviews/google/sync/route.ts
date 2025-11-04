import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncGoogleReviews, importGoogleReview } from '@/lib/integrations/google-reviews'
import { z } from 'zod'

/**
 * Google Reviews Sync API
 *
 * POST /api/reviews/google/sync
 *
 * Two modes:
 * 1. Auto sync: Fetch reviews from Google My Business API (if configured)
 * 2. Manual import: Import individual review data provided in request
 *
 * Manual Import Body:
 * {
 *   "reviewerName": "John Smith",
 *   "rating": 5,
 *   "reviewText": "Great service!",
 *   "postedAt": "2025-10-23T10:00:00Z",
 *   "googleReviewId": "optional-google-id"
 * }
 *
 * Auto Sync Body:
 * {
 *   "mode": "auto"
 * }
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

const ManualImportSchema = z.object({
  reviewerName: z.string().min(1, 'Reviewer name is required'),
  rating: z
    .number()
    .int()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  reviewText: z.string().optional(),
  postedAt: z.string(), // ISO timestamp
  googleReviewId: z.string().optional(),
})

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
 * Verify staff authentication
 */
async function verifyStaffAuth(supabase: any, userId: string): Promise<boolean> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return userRole && ['admin', 'manager', 'dispatcher'].includes(userRole.role)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify staff permissions
    const isStaff = await verifyStaffAuth(supabase, user.id)
    if (!isStaff) {
      return createErrorResponse(
        'forbidden',
        'Only staff members can sync Google reviews',
        403
      )
    }

    const body = await request.json()

    // Check if this is auto sync or manual import
    if (body.mode === 'auto') {
      // Auto sync mode
      console.log('[Google Sync] Starting auto sync...')

      const result = await syncGoogleReviews()

      if (result.success) {
        return createSuccessResponse({
          message: `Successfully synced ${result.imported} reviews`,
          imported: result.imported,
          errors: result.errors.length > 0 ? result.errors : undefined,
        })
      } else {
        return createErrorResponse(
          'sync_failed',
          result.errors[0] || 'Failed to sync reviews',
          500
        )
      }
    }

    // Manual import mode
    const validation = ManualImportSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { reviewerName, rating, reviewText, postedAt, googleReviewId } = validation.data

    console.log(`[Google Sync] Manually importing review from ${reviewerName}`)

    // Import the review
    const result = await importGoogleReview({
      reviewerName,
      rating,
      reviewText: reviewText || '',
      postedAt,
      googleReviewId,
      matchedManually: false, // Will be matched in separate step
    })

    if (!result.success) {
      return createErrorResponse(
        'import_failed',
        result.error || 'Failed to import review',
        500
      )
    }

    return createSuccessResponse({
      message: 'Review imported successfully',
      reviewId: result.reviewId,
    })
  } catch (error) {
    console.error('[Google Sync] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
