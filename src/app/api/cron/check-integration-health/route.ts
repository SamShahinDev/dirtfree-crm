import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import {
  checkPlatformHealth,
  checkDatabaseHealth,
  checkStorageHealth,
  checkAuthHealth,
  checkStripeHealth,
  checkTwilioHealth,
  checkResendHealth,
  updateIntegrationHealth,
  type HealthCheckResult,
} from '@/lib/monitoring/integration-health'

/**
 * POST /api/cron/check-integration-health
 * Run health checks on all integrations and services
 *
 * Cron schedule: */5 * * * * (every 5 minutes)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await getServerSupabase()
    const checks: HealthCheckResult[] = []
    const errors: any[] = []

    // Get all enabled integrations from database
    const { data: integrations, error: fetchError } = await supabase
      .from('integration_health')
      .select('*')
      .eq('enabled', true)

    if (fetchError) {
      console.error('Failed to fetch integrations:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      )
    }

    // Run health checks for each integration
    for (const integration of integrations || []) {
      try {
        let result: HealthCheckResult | null = null

        switch (integration.integration_name) {
          case 'CRM Platform':
            if (integration.endpoint_url) {
              result = await checkPlatformHealth(
                integration.endpoint_url,
                'CRM Platform'
              )
            } else {
              // Check local health endpoint
              const baseUrl =
                process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
              result = await checkPlatformHealth(
                `${baseUrl}/api/health`,
                'CRM Platform'
              )
            }
            break

          case 'Customer Portal':
            if (integration.endpoint_url) {
              result = await checkPlatformHealth(
                integration.endpoint_url,
                'Customer Portal'
              )
            }
            break

          case 'Marketing Website':
            if (integration.endpoint_url) {
              result = await checkPlatformHealth(
                integration.endpoint_url,
                'Marketing Website'
              )
            }
            break

          case 'Supabase Database':
            result = await checkDatabaseHealth()
            break

          case 'Supabase Storage':
            result = await checkStorageHealth()
            break

          case 'Supabase Auth':
            result = await checkAuthHealth()
            break

          case 'Stripe Payment Gateway':
            result = await checkStripeHealth()
            break

          case 'Twilio SMS Service':
            result = await checkTwilioHealth()
            break

          case 'Resend Email Service':
            result = await checkResendHealth()
            break

          default:
            // Generic platform check if endpoint_url is provided
            if (integration.endpoint_url) {
              result = await checkPlatformHealth(
                integration.endpoint_url,
                integration.integration_name
              )
            }
        }

        if (result) {
          checks.push(result)
          await updateIntegrationHealth(result)
        }
      } catch (error) {
        console.error(
          `Error checking ${integration.integration_name}:`,
          error
        )
        errors.push({
          integration: integration.integration_name,
          error:
            error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Calculate summary statistics
    const summary = {
      total: checks.length,
      healthy: checks.filter((c) => c.status === 'healthy').length,
      degraded: checks.filter((c) => c.status === 'degraded').length,
      down: checks.filter((c) => c.status === 'down').length,
      unknown: checks.filter((c) => c.status === 'unknown').length,
      averageResponseTime:
        checks.length > 0
          ? Math.round(
              checks.reduce((sum, c) => sum + c.responseTime, 0) /
                checks.length
            )
          : 0,
    }

    // Log the health check run
    console.log('Integration health check completed:', summary)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      checks: checks.map((c) => ({
        integration: c.integration,
        status: c.status,
        responseTime: c.responseTime,
        success: c.success,
      })),
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Unexpected error in check-integration-health:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// Allow GET for testing in development
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'GET method not allowed in production' },
      { status: 405 }
    )
  }

  // For development, allow GET with the same logic
  return POST(req)
}
