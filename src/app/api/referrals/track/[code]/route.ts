import { NextRequest, NextResponse } from 'next/server'
import { trackReferralClick, validateReferralCode } from '@/lib/referrals/processor'

/**
 * Referral Tracking API
 *
 * GET /api/referrals/track/[code]
 * Tracks referral link click and redirects to booking page with code pre-filled
 *
 * No authentication required (public link)
 */

/**
 * GET - Track referral click and redirect
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code

    if (!code) {
      // Redirect to home page if no code
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Validate referral code
    const validation = await validateReferralCode(code)

    if (!validation.valid) {
      // Redirect to booking page without code if invalid
      console.log(`[Referral Track] Invalid code: ${code}`)
      return NextResponse.redirect(new URL('/book', request.url))
    }

    // Track the click
    await trackReferralClick(code)

    // Redirect to booking page with referral code
    const bookingUrl = new URL('/book', request.url)
    bookingUrl.searchParams.set('ref', code)

    console.log(`[Referral Track] Tracked click for code ${code}, redirecting to booking`)

    return NextResponse.redirect(bookingUrl)
  } catch (error) {
    console.error('[Referral Track] GET error:', error)
    // Redirect to booking page on error
    return NextResponse.redirect(new URL('/book', request.url))
  }
}
