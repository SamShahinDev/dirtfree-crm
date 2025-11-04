import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  notifyFollowUpDueToday,
  notifyFollowUpOverdue,
  notifyOpportunityExpiring,
} from '@/lib/opportunities/notifications'

/**
 * Opportunity Reminders Cron Job
 *
 * GET /api/cron/opportunity-reminders
 *
 * Scheduled to run daily at 8:00 AM
 *
 * Processes:
 * 1. Follow-ups due today
 * 2. Overdue follow-ups
 * 3. Offers expiring soon
 *
 * Authentication: Cron secret required
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
 * Verify cron authentication
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[Opportunity Reminders] CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron authentication
    if (!verifyCronAuth(request)) {
      return createErrorResponse('unauthorized', 'Invalid authorization', 401)
    }

    console.log('[Opportunity Reminders] Starting daily reminder job...')

    const supabase = await createClient()

    const results = {
      followUpsToday: { processed: 0, sent: 0, errors: 0 },
      followUpsOverdue: { processed: 0, sent: 0, errors: 0, escalated: 0 },
      offersExpiring: { processed: 0, sent: 0, errors: 0 },
    }

    // ========================================================================
    // 1. Process Follow-ups Due Today
    // ========================================================================
    console.log('[Opportunity Reminders] Processing follow-ups due today...')

    const { data: todayUsers, error: todayError } = await (supabase as any).rpc(
      'get_users_with_followups_today'
    )

    if (todayError) {
      console.error('[Opportunity Reminders] Today users error:', todayError)
    } else if (todayUsers && (todayUsers as any[]).length > 0) {
      console.log(`[Opportunity Reminders] Found ${(todayUsers as any[]).length} users with follow-ups today`)

      for (const user of (todayUsers as any[])) {
        try {
          // Get opportunities for this user
          const { data: opportunities } = await supabase
            .from('missed_opportunities')
            .select('id, customer:customers(full_name), opportunity_type, follow_up_scheduled_date')
            .eq('assigned_to_user_id', user.user_id)
            .gte('follow_up_scheduled_date', new Date().toISOString().split('T')[0])
            .lt(
              'follow_up_scheduled_date',
              new Date(Date.now() + 86400000).toISOString().split('T')[0]
            )
            .eq('converted', false)
            .not('status', 'in', '(converted,declined)')

          if (opportunities && opportunities.length > 0) {
            const formattedOpps = opportunities.map((opp: any) => ({
              id: opp.id,
              customer_name: opp.customer?.full_name || 'Unknown',
              opportunity_type: opp.opportunity_type,
              follow_up_scheduled_date: opp.follow_up_scheduled_date,
            }))

            const result = await notifyFollowUpDueToday(user.user_id, formattedOpps)

            results.followUpsToday.processed++
            if (result.success) {
              results.followUpsToday.sent++
            } else {
              results.followUpsToday.errors++
            }
          }
        } catch (error) {
          console.error(`[Opportunity Reminders] Error processing user ${user.user_id}:`, error)
          results.followUpsToday.errors++
        }
      }
    }

    // ========================================================================
    // 2. Process Overdue Follow-ups
    // ========================================================================
    console.log('[Opportunity Reminders] Processing overdue follow-ups...')

    const { data: overdueUsers, error: overdueError } = await (supabase as any).rpc(
      'get_users_with_overdue_followups'
    )

    if (overdueError) {
      console.error('[Opportunity Reminders] Overdue users error:', overdueError)
    } else if (overdueUsers && (overdueUsers as any[]).length > 0) {
      console.log(`[Opportunity Reminders] Found ${(overdueUsers as any[]).length} users with overdue follow-ups`)

      for (const user of (overdueUsers as any[])) {
        try {
          // Get overdue opportunities for this user
          const { data: opportunities } = await supabase
            .from('missed_opportunities')
            .select('id, customer:customers(full_name), opportunity_type, follow_up_scheduled_date')
            .eq('assigned_to_user_id', user.user_id)
            .lt('follow_up_scheduled_date', new Date().toISOString().split('T')[0])
            .eq('converted', false)
            .not('status', 'in', '(converted,declined)')

          if (opportunities && opportunities.length > 0) {
            const formattedOpps = opportunities.map((opp: any) => {
              const scheduledDate = new Date(opp.follow_up_scheduled_date)
              const today = new Date()
              const daysOverdue = Math.floor(
                (today.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24)
              )

              return {
                id: opp.id,
                customer_name: opp.customer?.full_name || 'Unknown',
                opportunity_type: opp.opportunity_type,
                follow_up_scheduled_date: opp.follow_up_scheduled_date,
                days_overdue: daysOverdue,
              }
            })

            // Check if escalation is needed
            const preferences = user.preferences as any
            const maxDaysOverdue = Math.max(...formattedOpps.map((o) => o.days_overdue))
            const shouldEscalate =
              maxDaysOverdue >= (preferences?.overdue_escalation_days || 3)

            const result = await notifyFollowUpOverdue(
              user.user_id,
              formattedOpps,
              shouldEscalate,
              user.manager_id || undefined
            )

            results.followUpsOverdue.processed++
            if (result.success) {
              results.followUpsOverdue.sent++
              if (shouldEscalate && user.manager_id) {
                results.followUpsOverdue.escalated++
              }
            } else {
              results.followUpsOverdue.errors++
            }
          }
        } catch (error) {
          console.error(`[Opportunity Reminders] Error processing overdue user ${user.user_id}:`, error)
          results.followUpsOverdue.errors++
        }
      }
    }

    // ========================================================================
    // 3. Process Offers Expiring Soon
    // ========================================================================
    console.log('[Opportunity Reminders] Processing expiring offers...')

    const { data: expiringOffers, error: expiringError } = await (supabase as any).rpc(
      'get_opportunities_expiring_soon'
    )

    if (expiringError) {
      console.error('[Opportunity Reminders] Expiring offers error:', expiringError)
    } else if (expiringOffers && (expiringOffers as any[]).length > 0) {
      console.log(`[Opportunity Reminders] Found ${(expiringOffers as any[]).length} expiring offers`)

      for (const offer of (expiringOffers as any[])) {
        try {
          // Get offer details
          const { data: offerDetails } = await supabase
            .from('opportunity_offers')
            .select('offer_code')
            .eq('opportunity_id', (offer as any).opportunity_id)
            .single()

          if (offerDetails) {
            const offerData = offer as any
            const offerInfo = offerDetails as any
            const result = await notifyOpportunityExpiring(
              offerData.opportunity_id,
              offerData.assigned_user_id,
              offerData.customer_name,
              offerInfo.offer_code,
              offerData.days_until_expiry
            )

            results.offersExpiring.processed++
            if (result.success) {
              results.offersExpiring.sent++
            } else {
              results.offersExpiring.errors++
            }
          }
        } catch (error) {
          console.error(`[Opportunity Reminders] Error processing expiring offer ${offer.opportunity_id}:`, error)
          results.offersExpiring.errors++
        }
      }
    }

    // ========================================================================
    // Summary
    // ========================================================================
    const duration = Date.now() - startTime
    const totalProcessed =
      results.followUpsToday.processed +
      results.followUpsOverdue.processed +
      results.offersExpiring.processed

    console.log('[Opportunity Reminders] Job completed')
    console.log(`[Opportunity Reminders] Duration: ${duration}ms`)
    console.log(`[Opportunity Reminders] Total processed: ${totalProcessed}`)
    console.log(`[Opportunity Reminders] Follow-ups today: ${results.followUpsToday.sent}/${results.followUpsToday.processed}`)
    console.log(`[Opportunity Reminders] Follow-ups overdue: ${results.followUpsOverdue.sent}/${results.followUpsOverdue.processed} (${results.followUpsOverdue.escalated} escalated)`)
    console.log(`[Opportunity Reminders] Offers expiring: ${results.offersExpiring.sent}/${results.offersExpiring.processed}`)

    return createSuccessResponse({
      message: 'Opportunity reminders processed successfully',
      duration,
      results,
      summary: {
        totalProcessed,
        totalSent:
          results.followUpsToday.sent +
          results.followUpsOverdue.sent +
          results.offersExpiring.sent,
        totalErrors:
          results.followUpsToday.errors +
          results.followUpsOverdue.errors +
          results.offersExpiring.errors,
      },
    })
  } catch (error) {
    console.error('[Opportunity Reminders] Job error:', error)
    return createErrorResponse(
      'job_failed',
      error instanceof Error ? error.message : 'Job execution failed',
      500
    )
  }
}
