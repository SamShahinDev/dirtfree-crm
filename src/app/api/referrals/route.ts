import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getOrCreateReferralCode,
  createReferralInvitation,
  getCustomerReferralStats,
} from '@/lib/referrals/processor'
import { z } from 'zod'

/**
 * Referrals API
 *
 * GET /api/referrals?customer_id=[id]
 * Returns customer's referrals and statistics
 *
 * POST /api/referrals
 * Creates a new referral invitation
 *
 * Authentication: Required
 */

const API_VERSION = 'v1'

const CreateReferralSchema = z.object({
  customer_id: z.string().uuid(),
  referred_email: z.string().email().optional(),
  referred_phone: z.string().optional(),
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
 * GET - List customer's referrals
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')

    if (!customerId) {
      return createErrorResponse('invalid_request', 'customer_id is required', 400)
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

    // Get or create referral code
    const referralCode = await getOrCreateReferralCode(customerId)

    if (!referralCode) {
      return createErrorResponse('server_error', 'Failed to get referral code', 500)
    }

    // Get referral statistics
    const stats = await getCustomerReferralStats(customerId)

    // Get all referrals
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select(`
        *,
        referred:customers!referrals_referred_customer_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('referrer_customer_id', customerId)
      .order('created_at', { ascending: false })

    if (referralsError) {
      console.error('[Referrals API] Get referrals error:', referralsError)
      return createErrorResponse('fetch_failed', 'Failed to fetch referrals', 500)
    }

    // Format referrals with referred customer info
    const formattedReferrals = (referrals || []).map((r: any) => ({
      id: r.id,
      referral_code: r.referral_code,
      referred_email: r.referred_email,
      referred_phone: r.referred_phone,
      referred_customer: r.referred,
      status: r.status,
      clicks: r.clicks,
      points_awarded: r.referrer_points_awarded,
      discount_applied: r.referred_discount_applied,
      service_job_id: r.service_job_id,
      completed_at: r.completed_at,
      created_at: r.created_at,
    }))

    // Generate referral link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dirtfree.com'
    const referralLink = `${appUrl}/book?ref=${referralCode}`

    return createSuccessResponse({
      customer: {
        id: (customer as any).id,
        name: `${(customer as any).first_name} ${(customer as any).last_name}`,
      },
      referral_code: referralCode,
      referral_link: referralLink,
      stats,
      referrals: formattedReferrals,
    })
  } catch (error) {
    console.error('[Referrals API] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Create new referral
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateReferralSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { customer_id, referred_email, referred_phone } = validation.data

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer not found', 404)
    }

    // Create referral invitation
    const result = await createReferralInvitation(customer_id, referred_email, referred_phone)

    if (!result.success) {
      return createErrorResponse('create_failed', result.message, 500)
    }

    return createSuccessResponse({
      message: 'Referral created successfully',
      referral: result.referral,
    })
  } catch (error) {
    console.error('[Referrals API] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
