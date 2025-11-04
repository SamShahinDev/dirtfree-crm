import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAchievements, AchievementEventType } from '@/lib/loyalty/achievements'

/**
 * Achievements Processing Cron Job
 *
 * POST /api/cron/process-achievements
 * Runs daily to check all customers for milestone and streak achievements
 * Awards applicable badges automatically
 *
 * Triggered by: Vercel Cron (daily at 3:00 AM)
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
    console.warn('[Achievements Cron] CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Send achievement unlocked email notification
 */
async function sendAchievementEmail(
  customerId: string,
  customerEmail: string,
  customerName: string,
  achievementName: string,
  achievementDescription: string,
  pointsAwarded: number,
  rarity: string
) {
  try {
    // TODO: Integrate with email service (Resend/SendGrid)
    // For now, just log the email that would be sent
    console.log(`[Achievements Cron] Email notification:`, {
      to: customerEmail,
      subject: `Achievement Unlocked: ${achievementName}!`,
      customerId,
      customerName,
      achievementName,
      achievementDescription,
      pointsAwarded,
      rarity,
    })

    // This will be implemented when achievement-unlocked.tsx email template is created
    // await sendEmail({
    //   to: customerEmail,
    //   subject: `Achievement Unlocked: ${achievementName}!`,
    //   react: AchievementUnlockedEmail({
    //     customerName,
    //     achievementName,
    //     achievementDescription,
    //     pointsAwarded,
    //     rarity,
    //   }),
    // })

    return { success: true }
  } catch (error) {
    console.error('[Achievements Cron] Send email error:', error)
    return { success: false, error }
  }
}

/**
 * POST - Process achievements for all customers
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

    console.log('[Achievements Cron] Starting achievement processing...')

    const supabase = await createClient()

    // Get all active customers with loyalty records
    const { data: customers, error: customersError } = await supabase
      .from('customer_loyalty')
      .select(`
        customer_id,
        customers!inner (
          id,
          first_name,
          last_name,
          email
        )
      `)

    if (customersError) {
      console.error('[Achievements Cron] Fetch customers error:', customersError)
      return createErrorResponse(
        'fetch_failed',
        'Failed to fetch customers',
        500
      )
    }

    const results = {
      total_checked: customers?.length || 0,
      achievements_awarded: 0,
      customers_with_new_achievements: 0,
      emails_sent: 0,
      errors: 0,
      awarded_achievements: [] as any[],
      processing_time_ms: 0,
    }

    if (!customers || customers.length === 0) {
      console.log('[Achievements Cron] No customers to check')
      results.processing_time_ms = Date.now() - startTime
      return createSuccessResponse({
        message: 'No customers to check',
        results,
      })
    }

    console.log(`[Achievements Cron] Checking ${customers.length} customers...`)

    // Process each customer
    for (const customer of customers) {
      try {
        const customerId = (customer as any).customer_id
        const customerData = (customer as any).customers

        // Check for milestone achievements (based on service count)
        const milestoneResults = await checkAchievements(
          customerId,
          'service_completed' as AchievementEventType
        )

        // Check for streak achievements (based on booking patterns)
        const streakResults = await checkAchievements(
          customerId,
          'booking_created' as AchievementEventType
        )

        // Combine results
        const allResults = [...milestoneResults, ...streakResults]

        if (allResults.length > 0) {
          results.customers_with_new_achievements++
          results.achievements_awarded += allResults.length

          console.log(
            `[Achievements Cron] Awarded ${allResults.length} achievement(s) to customer ${customerId}`
          )

          // Send emails for each achievement
          for (const result of allResults) {
            if (result.success && result.achievement) {
              const emailResult = await sendAchievementEmail(
                customerId,
                customerData.email,
                `${customerData.first_name} ${customerData.last_name}`,
                result.achievement.achievement_name,
                result.achievement.description,
                result.points_awarded,
                result.achievement.rarity
              )

              if (emailResult.success) {
                results.emails_sent++
              }

              results.awarded_achievements.push({
                customer_id: customerId,
                customer_name: `${customerData.first_name} ${customerData.last_name}`,
                achievement_name: result.achievement.achievement_name,
                achievement_type: result.achievement.achievement_type,
                rarity: result.achievement.rarity,
                points_awarded: result.points_awarded,
                email_sent: emailResult.success,
              })
            }
          }
        }
      } catch (error) {
        console.error(
          `[Achievements Cron] Error processing customer ${(customer as any).customer_id}:`,
          error
        )
        results.errors++
      }
    }

    results.processing_time_ms = Date.now() - startTime

    console.log('[Achievements Cron] Processing complete:', {
      total_checked: results.total_checked,
      achievements_awarded: results.achievements_awarded,
      customers_with_new_achievements: results.customers_with_new_achievements,
      emails_sent: results.emails_sent,
      errors: results.errors,
      processing_time_ms: results.processing_time_ms,
    })

    return createSuccessResponse({
      message: `Processed ${results.total_checked} customers, awarded ${results.achievements_awarded} achievement(s)`,
      results,
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('[Achievements Cron] Critical error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
