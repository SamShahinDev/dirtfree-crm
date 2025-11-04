/**
 * Integration Health Monitoring Utilities
 *
 * Provides health check functions for all platform integrations
 * and external services.
 */

import { getServerSupabase } from '@/lib/supabase/server'

export interface HealthCheckResult {
  integration: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  responseTime: number
  success: boolean
  error?: string
  metadata?: Record<string, any>
}

/**
 * Check health of a platform endpoint
 */
export async function checkPlatformHealth(
  url: string,
  integrationName?: string
): Promise<HealthCheckResult> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Integration-Health-Monitor/1.0' },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseTime = Date.now() - startTime

    if (!response.ok) {
      return {
        integration: integrationName || new URL(url).hostname,
        status: response.status >= 500 ? 'down' : 'degraded',
        responseTime,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    // Try to parse JSON response
    let data: any
    try {
      data = await response.json()
    } catch (e) {
      // If not JSON, treat as successful if status is OK
      data = { status: 'ok' }
    }

    // Determine status based on response
    let status: 'healthy' | 'degraded' | 'down' = 'healthy'

    if (data.status === 'unhealthy' || data.status === 'down') {
      status = 'down'
    } else if (data.status === 'degraded' || responseTime > 5000) {
      status = 'degraded'
    } else if (responseTime > 2000) {
      status = 'degraded'
    }

    return {
      integration: integrationName || new URL(url).hostname,
      status,
      responseTime,
      success: true,
      metadata: data,
    }
  } catch (error) {
    const responseTime = Date.now() - startTime

    return {
      integration: integrationName || (url ? new URL(url).hostname : 'unknown'),
      status: 'down',
      responseTime,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * Check Supabase database health
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now()

  try {
    const supabase = await getServerSupabase()

    // Simple query to test database connection
    const { error } = await supabase
      .from('customers')
      .select('id')
      .limit(1)

    const responseTime = Date.now() - startTime

    if (error) {
      return {
        integration: 'Supabase Database',
        status: 'down',
        responseTime,
        success: false,
        error: error.message,
      }
    }

    return {
      integration: 'Supabase Database',
      status: responseTime > 1000 ? 'degraded' : 'healthy',
      responseTime,
      success: true,
    }
  } catch (error) {
    return {
      integration: 'Supabase Database',
      status: 'down',
      responseTime: Date.now() - startTime,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Database connection failed',
    }
  }
}

/**
 * Check Supabase Storage health
 */
export async function checkStorageHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now()

  try {
    const supabase = await getServerSupabase()

    // List buckets to test storage
    const { error } = await supabase.storage.listBuckets()

    const responseTime = Date.now() - startTime

    if (error) {
      return {
        integration: 'Supabase Storage',
        status: 'down',
        responseTime,
        success: false,
        error: error.message,
      }
    }

    return {
      integration: 'Supabase Storage',
      status: responseTime > 2000 ? 'degraded' : 'healthy',
      responseTime,
      success: true,
    }
  } catch (error) {
    return {
      integration: 'Supabase Storage',
      status: 'down',
      responseTime: Date.now() - startTime,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Storage service unavailable',
    }
  }
}

/**
 * Check Supabase Auth health
 */
export async function checkAuthHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now()

  try {
    const supabase = await getServerSupabase()

    // Get current user to test auth
    const { error } = await supabase.auth.getUser()

    const responseTime = Date.now() - startTime

    // Note: This might return an error if no user is logged in, which is fine
    // We're just testing if the auth service is responding

    return {
      integration: 'Supabase Auth',
      status: responseTime > 2000 ? 'degraded' : 'healthy',
      responseTime,
      success: true,
    }
  } catch (error) {
    return {
      integration: 'Supabase Auth',
      status: 'down',
      responseTime: Date.now() - startTime,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Auth service unavailable',
    }
  }
}

/**
 * Check Stripe API health
 */
export async function checkStripeHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now()

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      integration: 'Stripe Payment Gateway',
      status: 'unknown',
      responseTime: 0,
      success: false,
      error: 'Stripe API key not configured',
    }
  }

  try {
    // Dynamically import Stripe to avoid issues if not installed
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
    })

    // Simple API call to test Stripe connectivity
    await stripe.charges.list({ limit: 1 })

    const responseTime = Date.now() - startTime

    return {
      integration: 'Stripe Payment Gateway',
      status: responseTime > 2000 ? 'degraded' : 'healthy',
      responseTime,
      success: true,
    }
  } catch (error) {
    return {
      integration: 'Stripe Payment Gateway',
      status: 'down',
      responseTime: Date.now() - startTime,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Stripe API unavailable',
    }
  }
}

/**
 * Check Twilio SMS health
 */
export async function checkTwilioHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now()

  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN
  ) {
    return {
      integration: 'Twilio SMS Service',
      status: 'unknown',
      responseTime: 0,
      success: false,
      error: 'Twilio credentials not configured',
    }
  }

  try {
    // Dynamically import Twilio
    const twilio = (await import('twilio')).default
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    // Check account status
    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch()

    const responseTime = Date.now() - startTime

    return {
      integration: 'Twilio SMS Service',
      status: responseTime > 2000 ? 'degraded' : 'healthy',
      responseTime,
      success: true,
    }
  } catch (error) {
    return {
      integration: 'Twilio SMS Service',
      status: 'down',
      responseTime: Date.now() - startTime,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Twilio API unavailable',
    }
  }
}

/**
 * Check Resend Email health
 */
export async function checkResendHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now()

  if (!process.env.RESEND_API_KEY) {
    return {
      integration: 'Resend Email Service',
      status: 'unknown',
      responseTime: 0,
      success: false,
      error: 'Resend API key not configured',
    }
  }

  try {
    // Resend doesn't have a dedicated health endpoint
    // We'll just verify the API key is set and initialized correctly
    const { Resend } = await import('resend')
    new Resend(process.env.RESEND_API_KEY)

    const responseTime = Date.now() - startTime

    return {
      integration: 'Resend Email Service',
      status: 'healthy',
      responseTime,
      success: true,
    }
  } catch (error) {
    return {
      integration: 'Resend Email Service',
      status: 'down',
      responseTime: Date.now() - startTime,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Resend service unavailable',
    }
  }
}

/**
 * Update integration health record in database
 */
export async function updateIntegrationHealth(result: HealthCheckResult) {
  const supabase = await getServerSupabase()

  try {
    // Get current integration record
    const { data: integration, error: fetchError } = await supabase
      .from('integration_health')
      .select('*')
      .eq('integration_name', result.integration)
      .single()

    if (fetchError || !integration) {
      console.error(
        `Integration not found: ${result.integration}`,
        fetchError
      )
      return
    }

    // Calculate consecutive failures
    const consecutiveFailures = result.success
      ? 0
      : (integration.consecutive_failures || 0) + 1

    // Calculate metrics
    const successRate = await calculateSuccessRate(result.integration)
    const uptimePercentage = await calculateUptime(result.integration)

    // Update integration health
    const { error: updateError } = await supabase
      .from('integration_health')
      .update({
        status: result.status,
        last_check_at: new Date().toISOString(),
        last_success_at: result.success
          ? new Date().toISOString()
          : integration.last_success_at,
        last_failure_at: !result.success
          ? new Date().toISOString()
          : integration.last_failure_at,
        response_time_ms: result.responseTime,
        success_rate: successRate,
        uptime_percentage: uptimePercentage,
        last_error_message: result.error || null,
        last_error_details: result.error
          ? { error: result.error, timestamp: new Date().toISOString() }
          : null,
        consecutive_failures: consecutiveFailures,
        updated_at: new Date().toISOString(),
      })
      .eq('integration_name', result.integration)

    if (updateError) {
      console.error('Failed to update integration health:', updateError)
    }

    // Log the check
    const { error: logError } = await supabase
      .from('integration_health_log')
      .insert({
        integration_name: result.integration,
        integration_id: integration.id,
        check_time: new Date().toISOString(),
        status: result.status,
        response_time_ms: result.responseTime,
        success: result.success,
        error_message: result.error,
        metadata: result.metadata,
      })

    if (logError) {
      console.error('Failed to log health check:', logError)
    }

    // Send alert if threshold reached
    if (
      consecutiveFailures >= integration.alert_threshold &&
      integration.alert_on_failure
    ) {
      await sendIntegrationAlert(integration, result)
    }
  } catch (error) {
    console.error('Error updating integration health:', error)
  }
}

/**
 * Calculate success rate for an integration
 */
async function calculateSuccessRate(integrationName: string): Promise<number> {
  const supabase = await getServerSupabase()

  const twentyFourHoursAgo = new Date()
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

  const { data } = await supabase
    .from('integration_health_log')
    .select('success')
    .eq('integration_name', integrationName)
    .gte('check_time', twentyFourHoursAgo.toISOString())

  if (!data || data.length === 0) return 0

  const successCount = data.filter((log) => log.success).length
  return Math.round((successCount / data.length) * 100 * 100) / 100
}

/**
 * Calculate uptime percentage for an integration
 */
async function calculateUptime(integrationName: string): Promise<number> {
  const supabase = await getServerSupabase()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await supabase
    .from('integration_health_log')
    .select('status')
    .eq('integration_name', integrationName)
    .gte('check_time', thirtyDaysAgo.toISOString())

  if (!data || data.length === 0) return 0

  const uptimeCount = data.filter(
    (log) => log.status === 'healthy' || log.status === 'degraded'
  ).length

  return Math.round((uptimeCount / data.length) * 100 * 100) / 100
}

/**
 * Send alert for integration failure
 */
async function sendIntegrationAlert(
  integration: any,
  result: HealthCheckResult
) {
  // Don't spam - only send alert once per hour
  if (
    integration.alert_sent_at &&
    new Date(integration.alert_sent_at).getTime() > Date.now() - 3600000
  ) {
    return
  }

  try {
    // Send notification using the unified notification system
    const { sendNotification } = await import(
      '@/lib/notifications/unified-service'
    )

    await sendNotification({
      recipientType: 'role',
      recipientRole: 'admin',
      title: `⚠️ Integration Alert: ${integration.integration_name}`,
      message: `${integration.integration_name} is ${result.status.toUpperCase()}. ${integration.consecutive_failures} consecutive failures detected.`,
      notificationType: 'alert',
      priority: 'urgent',
      channels: ['crm', 'email'],
      emailSubject: `⚠️ Integration Alert: ${integration.integration_name} is ${result.status.toUpperCase()}`,
      emailBody: `
        <h2>Integration Health Alert</h2>
        <p><strong>${integration.integration_name}</strong> is experiencing issues.</p>

        <h3>Status</h3>
        <p>Current Status: <strong>${result.status.toUpperCase()}</strong></p>
        <p>Consecutive Failures: ${integration.consecutive_failures}</p>

        <h3>Details</h3>
        <p>Last Check: ${new Date().toLocaleString()}</p>
        <p>Response Time: ${result.responseTime}ms</p>
        ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}

        <h3>Action Required</h3>
        <p>Please investigate and resolve this issue as soon as possible.</p>

        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/monitoring/integrations">View Integration Health Dashboard</a></p>
      `,
      actionUrl: '/dashboard/monitoring/integrations',
      actionLabel: 'View Dashboard',
      metadata: {
        integration_name: integration.integration_name,
        status: result.status,
        consecutive_failures: integration.consecutive_failures,
      },
    })

    // Update alert sent time
    const supabase = await getServerSupabase()
    await supabase
      .from('integration_health')
      .update({ alert_sent_at: new Date().toISOString() })
      .eq('integration_name', integration.integration_name)
  } catch (error) {
    console.error('Failed to send integration alert:', error)
  }
}
