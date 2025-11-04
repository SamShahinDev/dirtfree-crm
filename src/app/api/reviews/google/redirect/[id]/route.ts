import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import { trackGoogleReviewClick } from '@/lib/reviews/request'

/**
 * Google Review Redirect API
 *
 * GET /api/reviews/google/redirect/[id]
 *
 * Tracks Google review link clicks and redirects to Google review page.
 *
 * Features:
 * - Tracks click timestamp
 * - Updates review request status
 * - Redirects to Google review URL
 *
 * Authentication: Not required (public link)
 */

const GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL || 'https://g.page/r/YOUR_PLACE_ID/review'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reviewRequestId = params.id

    // Track the click
    const result = await trackGoogleReviewClick(reviewRequestId)

    if (!result.success) {
      console.error('[Google Review] Failed to track click:', result.error)
      // Don't fail the redirect, just log the error
    }

    // Redirect to Google review page
    return NextResponse.redirect(GOOGLE_REVIEW_URL, { status: 302 })
  } catch (error) {
    console.error('[Google Review] Redirect error:', error)

    // Still redirect even if tracking fails
    return NextResponse.redirect(GOOGLE_REVIEW_URL, { status: 302 })
  }
}
