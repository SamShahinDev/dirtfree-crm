import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeReferral } from '@/lib/referrals/processor'

/**
 * Referrals Processing Cron Job
 *
 * POST /api/cron/process-referrals
 * Runs daily to check for completed referral services
 * Awards points to referrers and sends notification emails
 *
 * Triggered by: Vercel Cron (daily at 4:00 AM)
 * Authorization: Cron secret header
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
 * Verify cron authorization
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[Referrals Cron] CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Send referral completion notification email
 */
async function sendReferralCompletionEmail(
  referrerEmail: string,
  referrerName: string,
  referredName: string,
  pointsAwarded: number
): Promise<boolean> {
  try {
    // TODO: Integrate with email service (Resend/SendGrid)
    // For now, just log the email that would be sent
    console.log(`[Referrals Cron] Email notification:`, {
      to: referrerEmail,
      subject: `You earned ${pointsAwarded} points from your referral!`,
      referrerName,
      referredName,
      pointsAwarded,
    })

    // This will be implemented with email service integration
    // await sendEmail({
    //   to: referrerEmail,
    //   subject: `You earned ${pointsAwarded} points!`,
    //   react: ReferralCompletedEmail({
    //     referrerName,
    //     referredName,
    //     pointsAwarded,
    //   }),
    // })

    return true
  } catch (error) {
    console.error('[Referrals Cron] Send email error:', error)
    return false
  }
}

/**
 * POST - Process referrals and award points
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron authorization
    if (!verifyCronAuth(request)) {
      return createErrorResponse(
        'unauthorized',
        'Invalid cron authorization',
        401
      )
    }

    console.log('[Referrals Cron] Starting referral processing...')

    const supabase = await createClient()

    // Get all referrals with booked status and completed service jobs
    const { data: referrals, error: fetchError } = await supabase
      .from('referrals')
      .select(`
        id,
        referrer_customer_id,
        referred_customer_id,
        referral_code,
        service_job_id,
        referrer:customers!referrals_referrer_customer_id_fkey (
          first_name,
          last_name,
          email
        ),
        referred:customers!referrals_referred_customer_id_fkey (
          first_name,
          last_name
        ),
        job:jobs!referrals_service_job_id_fkey (
          id,
          status
        )
      `)
      .eq('status', 'booked')

    if (fetchError) {
      console.error('[Referrals Cron] Fetch referrals error:', fetchError)
      return createErrorResponse(
        'fetch_failed',
        'Failed to fetch referrals',
        500
      )
    }

    const results = {
      total_checked: referrals?.length || 0,
      referrals_completed: 0,
      points_awarded: 0,
      emails_sent: 0,
      errors: 0,
      completed_referrals: [] as any[],
      processing_time_ms: 0,
    }

    if (!referrals || referrals.length === 0) {
      console.log('[Referrals Cron] No booked referrals to check')
      results.processing_time_ms = Date.now() - startTime
      return createSuccessResponse({
        message: 'No booked referrals to check',
        results,
      })
    }

    console.log(`[Referrals Cron] Checking ${referrals.length} booked referrals...`)

    // Process each referral
    for (const referral of referrals) {
      try {
        const referralData = referral as any
        const job = referralData.job

        // Check if service job is completed
        if (!job || job.status !== 'completed') {
          continue
        }

        console.log(
          `[Referrals Cron] Processing referral ${referralData.id} - job ${job.id} is completed`
        )

        // Complete the referral and award points
        const result = await completeReferral(referralData.id)

        if (result.success) {
          results.referrals_completed++
          results.points_awarded += result.points_awarded

          // Send notification email to referrer
          const referrerData = referralData.referrer
          const referredData = referralData.referred

          if (referrerData && referredData) {
            const emailResult = await sendReferralCompletionEmail(
              referrerData.email,
              `${referrerData.first_name} ${referrerData.last_name}`,
              `${referredData.first_name} ${referredData.last_name}`,
              result.points_awarded
            )

            if (emailResult) {
              results.emails_sent++
            }

            results.completed_referrals.push({
              referral_id: referralData.id,
              referrer_name: `${referrerData.first_name} ${referrerData.last_name}`,
              referred_name: `${referredData.first_name} ${referredData.last_name}`,
              points_awarded: result.points_awarded,
              email_sent: emailResult,
            })
          }
        } else {
          console.error(
            `[Referrals Cron] Failed to complete referral ${referralData.id}: ${result.message}`
          )
          results.errors++
        }
      } catch (error) {
        console.error(
          `[Referrals Cron] Error processing referral ${(referral as any).id}:`,
          error
        )
        results.errors++
      }
    }

    results.processing_time_ms = Date.now() - startTime

    console.log('[Referrals Cron] Processing complete:', {
      total_checked: results.total_checked,
      referrals_completed: results.referrals_completed,
      points_awarded: results.points_awarded,
      emails_sent: results.emails_sent,
      errors: results.errors,
      processing_time_ms: results.processing_time_ms,
    })

    return createSuccessResponse({
      message: `Processed ${results.total_checked} referrals, completed ${results.referrals_completed}`,
      results,
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('[Referrals Cron] Critical error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
