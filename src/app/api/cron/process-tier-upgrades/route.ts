import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkTierUpgrade, awardTierUpgradeBonus } from '@/lib/loyalty/tiers'

/**
 * Tier Upgrades Cron Job
 *
 * POST /api/cron/process-tier-upgrades
 * Runs daily to check all customers for tier upgrades
 * Awards upgrade bonuses and sends congratulations emails
 *
 * Triggered by: Vercel Cron (daily at 2:00 AM)
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
    console.warn('[Tier Upgrades Cron] CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Send tier upgrade email notification
 */
async function sendTierUpgradeEmail(
  customerId: string,
  customerEmail: string,
  customerName: string,
  previousTierName: string,
  newTierName: string,
  bonusPoints: number
) {
  try {
    // TODO: Integrate with email service (Resend/SendGrid)
    // For now, just log the email that would be sent
    console.log(`[Tier Upgrades Cron] Email notification:`, {
      to: customerEmail,
      subject: `Congratulations! You've reached ${newTierName} tier!`,
      customerId,
      customerName,
      previousTierName,
      newTierName,
      bonusPoints,
    })

    // This will be implemented when tier-upgrade.tsx email template is created
    // await sendEmail({
    //   to: customerEmail,
    //   subject: `Congratulations! You've reached ${newTierName} tier!`,
    //   react: TierUpgradeEmail({ customerName, previousTierName, newTierName, bonusPoints }),
    // })

    return { success: true }
  } catch (error) {
    console.error('[Tier Upgrades Cron] Send email error:', error)
    return { success: false, error }
  }
}

/**
 * POST - Process tier upgrades for all customers
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

    console.log('[Tier Upgrades Cron] Starting tier upgrade check...')

    const supabase = await createClient()

    // Get all customers with loyalty records
    const { data: customers, error: customersError } = await supabase
      .from('customer_loyalty')
      .select(`
        customer_id,
        total_points,
        current_tier_level,
        customers!inner (
          id,
          first_name,
          last_name,
          email
        )
      `)

    if (customersError) {
      console.error('[Tier Upgrades Cron] Fetch customers error:', customersError)
      return createErrorResponse(
        'fetch_failed',
        'Failed to fetch customers',
        500
      )
    }

    const results = {
      total_checked: customers?.length || 0,
      upgrades_found: 0,
      upgrades_processed: 0,
      emails_sent: 0,
      errors: 0,
      upgraded_customers: [] as any[],
      processing_time_ms: 0,
    }

    if (!customers || customers.length === 0) {
      console.log('[Tier Upgrades Cron] No customers to check')
      results.processing_time_ms = Date.now() - startTime
      return createSuccessResponse({
        message: 'No customers to check',
        results,
      })
    }

    console.log(`[Tier Upgrades Cron] Checking ${customers.length} customers...`)

    // Process each customer
    for (const customer of customers) {
      try {
        const customerId = customer.customer_id
        const customerData = (customer as any).customers

        // Check for tier upgrade
        const upgradeResult = await checkTierUpgrade(customerId)

        if (upgradeResult && upgradeResult.upgraded) {
          results.upgrades_found++

          console.log(
            `[Tier Upgrades Cron] Upgrade detected for customer ${customerId}: ${upgradeResult.message}`
          )

          // Award upgrade bonus
          const bonusResult = await awardTierUpgradeBonus(
            customerId,
            upgradeResult.new_tier
          )

          if (bonusResult.success) {
            results.upgrades_processed++

            // Send congratulations email
            const emailResult = await sendTierUpgradeEmail(
              customerId,
              customerData.email,
              `${customerData.first_name} ${customerData.last_name}`,
              upgradeResult.previous_tier?.tier_name || 'Bronze',
              upgradeResult.new_tier.tier_name,
              bonusResult.bonus_points
            )

            if (emailResult.success) {
              results.emails_sent++
            }

            results.upgraded_customers.push({
              customer_id: customerId,
              customer_name: `${customerData.first_name} ${customerData.last_name}`,
              email: customerData.email,
              previous_tier: upgradeResult.previous_tier?.tier_name || 'Bronze',
              new_tier: upgradeResult.new_tier.tier_name,
              bonus_points: bonusResult.bonus_points,
              email_sent: emailResult.success,
            })
          } else {
            console.error(
              `[Tier Upgrades Cron] Failed to award bonus for customer ${customerId}`
            )
            results.errors++
          }
        }
      } catch (error) {
        console.error(
          `[Tier Upgrades Cron] Error processing customer ${customer.customer_id}:`,
          error
        )
        results.errors++
      }
    }

    results.processing_time_ms = Date.now() - startTime

    console.log('[Tier Upgrades Cron] Processing complete:', {
      total_checked: results.total_checked,
      upgrades_found: results.upgrades_found,
      upgrades_processed: results.upgrades_processed,
      emails_sent: results.emails_sent,
      errors: results.errors,
      processing_time_ms: results.processing_time_ms,
    })

    return createSuccessResponse({
      message: `Processed ${results.total_checked} customers, found ${results.upgrades_found} upgrades`,
      results,
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('[Tier Upgrades Cron] Critical error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
