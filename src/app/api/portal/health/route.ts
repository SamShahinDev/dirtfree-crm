import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import Stripe from 'stripe'
import twilio from 'twilio'

/**
 * Portal Health Check API
 *
 * GET /api/portal/health
 * - Returns comprehensive system health status
 * - Checks database, Stripe, Twilio, and email service connectivity
 * - Includes response times and last incident information
 *
 * No authentication required (public endpoint for monitoring)
 */

const API_VERSION = 'v1'

/**
 * Component status
 */
type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy'

/**
 * Component health info
 */
interface ComponentHealth {
  status: ComponentStatus
  responseTime?: number
  message?: string
  lastChecked: string
}

/**
 * Overall system status
 */
interface SystemHealth {
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage'
  components: {
    api: ComponentHealth
    database: ComponentHealth
    stripe: ComponentHealth
    twilio: ComponentHealth
    email: ComponentHealth
  }
  lastIncident?: {
    component: string
    status: string
    message: string
    timestamp: string
  }
  timestamp: string
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const startTime = Date.now()

  try {
    const supabase = getServiceSupabase()

    // Simple query to check connection
    const { error } = await supabase.from('customers').select('id').limit(1)

    const responseTime = Date.now() - startTime

    if (error) {
      return {
        status: 'unhealthy',
        responseTime,
        message: error.message,
        lastChecked: new Date().toISOString(),
      }
    }

    // Check response time thresholds
    if (responseTime > 1000) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Slow response time',
        lastChecked: new Date().toISOString(),
      }
    }

    return {
      status: 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    }
  }
}

/**
 * Check Stripe connectivity
 */
async function checkStripe(): Promise<ComponentHealth> {
  const startTime = Date.now()

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        status: 'unhealthy',
        message: 'Stripe not configured',
        lastChecked: new Date().toISOString(),
      }
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // @ts-ignore - Using older API version for compatibility
      apiVersion: '2024-12-18.acacia',
    })

    // Test API call - retrieve balance
    await stripe.balance.retrieve()

    const responseTime = Date.now() - startTime

    if (responseTime > 2000) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Slow response time',
        lastChecked: new Date().toISOString(),
      }
    }

    return {
      status: 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Stripe API error',
      lastChecked: new Date().toISOString(),
    }
  }
}

/**
 * Check Twilio connectivity
 */
async function checkTwilio(): Promise<ComponentHealth> {
  const startTime = Date.now()

  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return {
        status: 'degraded',
        message: 'Twilio not configured',
        lastChecked: new Date().toISOString(),
      }
    }

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    // Test API call - fetch account
    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch()

    const responseTime = Date.now() - startTime

    if (responseTime > 2000) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Slow response time',
        lastChecked: new Date().toISOString(),
      }
    }

    return {
      status: 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Twilio API error',
      lastChecked: new Date().toISOString(),
    }
  }
}

/**
 * Check email service (Resend)
 */
async function checkEmail(): Promise<ComponentHealth> {
  const startTime = Date.now()

  try {
    if (!process.env.RESEND_API_KEY) {
      return {
        status: 'degraded',
        message: 'Resend not configured',
        lastChecked: new Date().toISOString(),
      }
    }

    // Test API call - verify API key by fetching domains
    const response = await fetch('https://api.resend.com/domains', {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
    })

    const responseTime = Date.now() - startTime

    if (!response.ok) {
      return {
        status: 'unhealthy',
        responseTime,
        message: `HTTP ${response.status}: ${response.statusText}`,
        lastChecked: new Date().toISOString(),
      }
    }

    if (responseTime > 2000) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Slow response time',
        lastChecked: new Date().toISOString(),
      }
    }

    return {
      status: 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Email service error',
      lastChecked: new Date().toISOString(),
    }
  }
}

/**
 * Get last incident from database
 */
async function getLastIncident() {
  try {
    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('system_status')
      .select('component, status, message, started_at')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return undefined
    }

    return {
      component: (data as any).component,
      status: (data as any).status,
      message: (data as any).message || 'No message provided',
      timestamp: (data as any).started_at,
    }
  } catch (error) {
    console.error('[Health Check] Error fetching last incident:', error)
    return undefined
  }
}

/**
 * Calculate overall system status
 */
function calculateOverallStatus(components: SystemHealth['components']): SystemHealth['status'] {
  const statuses = Object.values(components).map(c => c.status)

  // If any component is unhealthy, system has partial outage
  if (statuses.filter(s => s === 'unhealthy').length >= 2) {
    return 'major_outage'
  }

  if (statuses.includes('unhealthy')) {
    return 'partial_outage'
  }

  // If multiple components are degraded
  if (statuses.filter(s => s === 'degraded').length >= 2) {
    return 'degraded'
  }

  if (statuses.includes('degraded')) {
    return 'degraded'
  }

  return 'operational'
}

/**
 * Log health check to database
 */
async function logHealthCheck(components: SystemHealth['components']) {
  try {
    const supabase = getServiceSupabase()

    // Log each component
    for (const [component, health] of Object.entries(components)) {
      await supabase.rpc('log_health_check', {
        p_component: component,
        p_status: health.status,
        p_response_time_ms: health.responseTime || null,
        p_error_message: health.message || null,
      } as any)
    }
  } catch (error) {
    console.error('[Health Check] Error logging health check:', error)
  }
}

/**
 * GET - Health check
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()

    // Check all components in parallel
    const [database, stripe, twilio, email] = await Promise.all([
      checkDatabase(),
      checkStripe(),
      checkTwilio(),
      checkEmail(),
    ])

    const apiResponseTime = Date.now() - startTime

    const components = {
      api: {
        status: 'healthy' as ComponentStatus,
        responseTime: apiResponseTime,
        lastChecked: new Date().toISOString(),
      },
      database,
      stripe,
      twilio,
      email,
    }

    // Calculate overall status
    const overallStatus = calculateOverallStatus(components)

    // Get last incident
    const lastIncident = await getLastIncident()

    const health: SystemHealth = {
      status: overallStatus,
      components,
      lastIncident,
      timestamp: new Date().toISOString(),
    }

    // Log health check asynchronously (don't wait)
    logHealthCheck(components).catch(err => {
      console.error('[Health Check] Failed to log:', err)
    })

    // Return appropriate HTTP status based on system health
    const httpStatus = overallStatus === 'operational' ? 200 :
                      overallStatus === 'degraded' ? 200 :
                      overallStatus === 'partial_outage' ? 503 :
                      503

    return NextResponse.json(
      {
        success: true,
        data: health,
        version: API_VERSION,
      },
      { status: httpStatus }
    )

  } catch (error) {
    console.error('[Health Check] GET /api/portal/health error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'health_check_failed',
        message: error instanceof Error ? error.message : 'Internal server error',
        version: API_VERSION,
      },
      { status: 500 }
    )
  }
}
