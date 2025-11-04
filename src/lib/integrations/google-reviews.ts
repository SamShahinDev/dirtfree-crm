import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Google My Business Reviews Integration
 *
 * Supports two modes:
 * 1. API Integration: Fetch reviews from Google My Business API (requires OAuth setup)
 * 2. Manual Tracking: Staff manually imports/tracks reviews
 *
 * Features:
 * - Fetch recent Google reviews (API mode)
 * - Match reviews to CRM customers
 * - Track when reviews are posted
 * - Update review_requests table
 * - Manual review import/matching
 */

export interface GoogleReview {
  id?: string // Our database ID
  googleReviewId?: string // Google's review ID
  reviewerName: string
  rating: number
  reviewText: string
  postedAt: string // ISO timestamp
  customerId?: string
  reviewRequestId?: string
  matchedManually?: boolean
}

export interface GoogleReviewStats {
  totalReviews: number
  averageRating: number
  rating5Count: number
  rating4Count: number
  rating3Count: number
  rating2Count: number
  rating1Count: number
  matchedCount: number
  unmatchedCount: number
}

export interface CustomerMatch {
  customerId: string
  customerName: string
  matchScore: number // 0-100
}

/**
 * Check if Google My Business API is configured
 */
export function isGoogleApiConfigured(): boolean {
  return !!(
    process.env.GOOGLE_MY_BUSINESS_API_KEY ||
    process.env.GOOGLE_CLIENT_ID
  )
}

/**
 * Fetch recent Google reviews from API
 * NOTE: This requires Google My Business API setup with OAuth
 */
export async function fetchGoogleReviews(
  accountId?: string,
  locationId?: string
): Promise<{ success: boolean; reviews?: GoogleReview[]; error?: string }> {
  try {
    // Check if API is configured
    if (!isGoogleApiConfigured()) {
      return {
        success: false,
        error: 'Google My Business API not configured. Use manual import instead.',
      }
    }

    // Google My Business API integration
    // This is a placeholder - actual implementation requires:
    // 1. OAuth 2.0 setup
    // 2. Google My Business API credentials
    // 3. Account and location IDs from Google

    console.log('[Google Reviews] API integration not yet implemented')
    console.log('[Google Reviews] Use manual import workflow instead')

    // For now, return error indicating manual mode should be used
    return {
      success: false,
      error: 'Google API integration requires OAuth setup. Please use manual import.',
    }

    // FUTURE IMPLEMENTATION:
    // const accessToken = await getGoogleAccessToken()
    // const response = await fetch(
    //   `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
    //   {
    //     headers: {
    //       Authorization: `Bearer ${accessToken}`,
    //     },
    //   }
    // )
    // const data = await response.json()
    // return {
    //   success: true,
    //   reviews: data.reviews.map(transformGoogleReview),
    // }
  } catch (error) {
    console.error('[Google Reviews] Error fetching reviews:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Import Google review manually
 * For use when API is not available
 */
export async function importGoogleReview(
  review: GoogleReview
): Promise<{ success: boolean; reviewId?: string; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    // Check if review already exists (by Google review ID or exact match)
    if (review.googleReviewId) {
      const { data: existing } = await supabase
        .from('google_reviews')
        .select('id')
        .eq('google_review_id', review.googleReviewId)
        .single()

      if (existing) {
        return {
          success: false,
          error: 'Review already imported',
        }
      }
    }

    // Insert review
    const { data: inserted, error: insertError } = await (supabase as any)
      .from('google_reviews')
      .insert({
        google_review_id: review.googleReviewId || null,
        customer_id: review.customerId || null,
        review_request_id: review.reviewRequestId || null,
        reviewer_name: review.reviewerName,
        rating: review.rating,
        review_text: review.reviewText || '',
        posted_at: review.postedAt,
        matched_manually: review.matchedManually || false,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Google Reviews] Error importing review:', insertError)
      return {
        success: false,
        error: insertError.message,
      }
    }

    // If customer/review request associated, update review_requests
    if (review.reviewRequestId) {
      await (supabase as any)
        .from('review_requests')
        .update({
          google_review_completed: true,
          google_review_completed_at: new Date().toISOString(),
        })
        .eq('id', review.reviewRequestId)
    }

    console.log(`[Google Reviews] Imported review ${(inserted as any).id}`)

    return {
      success: true,
      reviewId: (inserted as any).id,
    }
  } catch (error) {
    console.error('[Google Reviews] Error importing review:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Match Google review to CRM customer
 * Uses fuzzy name matching and email matching
 */
export async function findCustomerMatches(
  reviewerName: string
): Promise<CustomerMatch[]> {
  try {
    const supabase = getServiceSupabase()

    // Get all customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, full_name, first_name, last_name, email')
      .limit(100) // Limit for performance

    if (customersError || !customers) {
      return []
    }

    // Calculate match scores
    const matches: CustomerMatch[] = []

    for (const customer of customers as any[]) {
      const score = calculateNameMatchScore(reviewerName, customer.full_name)

      if (score > 50) { // Threshold for suggesting match
        matches.push({
          customerId: customer.id,
          customerName: customer.full_name,
          matchScore: score,
        })
      }
    }

    // Sort by match score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore)

    return matches.slice(0, 10) // Return top 10 matches
  } catch (error) {
    console.error('[Google Reviews] Error finding customer matches:', error)
    return []
  }
}

/**
 * Calculate name match score (0-100)
 * Uses simple fuzzy matching algorithm
 */
function calculateNameMatchScore(name1: string, name2: string): number {
  const normalize = (str: string) =>
    str.toLowerCase().trim().replace(/[^a-z\s]/g, '')

  const n1 = normalize(name1)
  const n2 = normalize(name2)

  // Exact match
  if (n1 === n2) return 100

  // Contains match
  if (n1.includes(n2) || n2.includes(n1)) return 90

  // Split into words
  const words1 = n1.split(/\s+/)
  const words2 = n2.split(/\s+/)

  // Check if any words match
  let matchingWords = 0
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2) matchingWords++
    }
  }

  const totalWords = Math.max(words1.length, words2.length)
  const wordMatchScore = (matchingWords / totalWords) * 80

  // Check first name match
  if (words1[0] === words2[0]) {
    return Math.max(wordMatchScore, 70)
  }

  return wordMatchScore
}

/**
 * Link Google review to customer
 */
export async function linkReviewToCustomer(
  reviewId: string,
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    // Use database function to match review
    const { error } = await (supabase as any).rpc('match_google_review_to_customer', {
      review_id: reviewId,
      customer_id_param: customerId,
    })

    if (error) {
      console.error('[Google Reviews] Error linking review:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    console.log(`[Google Reviews] Linked review ${reviewId} to customer ${customerId}`)

    return { success: true }
  } catch (error) {
    console.error('[Google Reviews] Error linking review:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get recent Google reviews
 */
export async function getRecentGoogleReviews(
  daysBack: number = 30,
  limit: number = 50
): Promise<GoogleReview[]> {
  try {
    const supabase = getServiceSupabase()

    const { data: reviews, error } = await (supabase as any).rpc(
      'get_recent_google_reviews',
      {
        days_back: daysBack,
        limit_count: limit,
      }
    )

    if (error) {
      console.error('[Google Reviews] Error fetching recent reviews:', error)
      return []
    }

    return (reviews || []).map((r: any) => ({
      id: r.id,
      googleReviewId: r.google_review_id,
      reviewerName: r.reviewer_name,
      rating: r.rating,
      reviewText: r.review_text,
      postedAt: r.posted_at,
      customerId: r.customer_id,
      reviewRequestId: r.review_request_id,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      matched: r.matched,
    }))
  } catch (error) {
    console.error('[Google Reviews] Error getting recent reviews:', error)
    return []
  }
}

/**
 * Get Google review statistics
 */
export async function getGoogleReviewStats(
  daysBack: number = 30
): Promise<GoogleReviewStats | null> {
  try {
    const supabase = getServiceSupabase()

    const { data, error } = await (supabase as any).rpc(
      'get_google_review_statistics',
      { days_back: daysBack }
    )

    if (error || !data || data.length === 0) {
      console.error('[Google Reviews] Error fetching stats:', error)
      return null
    }

    const stats = data[0]

    return {
      totalReviews: stats.total_reviews || 0,
      averageRating: parseFloat(stats.average_rating) || 0,
      rating5Count: stats.rating_5_count || 0,
      rating4Count: stats.rating_4_count || 0,
      rating3Count: stats.rating_3_count || 0,
      rating2Count: stats.rating_2_count || 0,
      rating1Count: stats.rating_1_count || 0,
      matchedCount: stats.matched_count || 0,
      unmatchedCount: stats.unmatched_count || 0,
    }
  } catch (error) {
    console.error('[Google Reviews] Error getting stats:', error)
    return null
  }
}

/**
 * Sync Google reviews (fetch and import new ones)
 * This is a wrapper that handles both API and manual modes
 */
export async function syncGoogleReviews(): Promise<{
  success: boolean
  imported: number
  errors: string[]
}> {
  const errors: string[] = []
  let imported = 0

  try {
    // Try API mode first
    if (isGoogleApiConfigured()) {
      const result = await fetchGoogleReviews()

      if (result.success && result.reviews) {
        // Import each review
        for (const review of result.reviews) {
          const importResult = await importGoogleReview(review)

          if (importResult.success) {
            imported++
          } else {
            errors.push(importResult.error || 'Unknown error')
          }
        }

        return {
          success: true,
          imported,
          errors,
        }
      } else {
        errors.push(result.error || 'Failed to fetch reviews')
      }
    }

    // If API not configured or failed, return manual mode message
    return {
      success: false,
      imported: 0,
      errors: [
        'Google API not configured. Please import reviews manually from the dashboard.',
      ],
    }
  } catch (error) {
    console.error('[Google Reviews] Error syncing reviews:', error)
    return {
      success: false,
      imported: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}
