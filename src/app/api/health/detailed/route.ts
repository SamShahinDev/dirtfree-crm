/**
 * Detailed Health Check Endpoint
 *
 * Checks all critical system dependencies and returns comprehensive health status.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  error?: string
  details?: any
}

interface HealthReport {
  timestamp: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, HealthCheck>
  uptime?: number
  version?: string
}

export async function GET() {
  const startTime = Date.now()

  const checks: HealthReport = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {},
    version: process.env.npm_package_version || '1.0.0',
  }

  // Database health check
  checks.checks.database = await checkDatabase()

  // Stripe health check (if configured)
  if (process.env.STRIPE_SECRET_KEY) {
    checks.checks.stripe = await checkStripe()
  }

  // Twilio health check (if configured)
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    checks.checks.twilio = await checkTwilio()
  }

  // Email service check (if configured)
  if (process.env.RESEND_API_KEY) {
    checks.checks.email = await checkEmail()
  }

  // Cache health check
  checks.checks.cache = await checkCache()

  // Memory health check
  checks.checks.memory = checkMemory()

  // File system check
  checks.checks.filesystem = await checkFileSystem()

  // Calculate overall uptime
  if (process.uptime) {
    checks.uptime = Math.floor(process.uptime())
  }

  // Determine overall status
  const unhealthyServices = Object.values(checks.checks).filter(
    (check) => check.status === 'unhealthy'
  )

  const degradedServices = Object.values(checks.checks).filter(
    (check) => check.status === 'degraded'
  )

  if (unhealthyServices.length > 0) {
    checks.status = 'unhealthy'
  } else if (degradedServices.length > 0) {
    checks.status = 'degraded'
  }

  // Add total response time
  const totalResponseTime = Date.now() - startTime
  checks.checks.overall = {
    status: checks.status,
    responseTime: totalResponseTime,
    details: {
      totalChecks: Object.keys(checks.checks).length - 1,
      healthyChecks: Object.values(checks.checks).filter((c) => c.status === 'healthy')
        .length,
      degradedChecks: degradedServices.length,
      unhealthyChecks: unhealthyServices.length,
    },
  }

  // Return appropriate status code
  const statusCode = checks.status === 'healthy' ? 200 : 503

  return NextResponse.json(checks, { status: statusCode })
}

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<HealthCheck> {
  try {
    const start = Date.now()
    const supabase = await createClient()

    const { error } = await supabase.from('customers').select('id').limit(1)

    const responseTime = Date.now() - start

    if (error) {
      return {
        status: 'unhealthy',
        responseTime,
        error: error.message,
      }
    }

    // Warn if response time is slow
    const status = responseTime > 1000 ? 'degraded' : 'healthy'

    return {
      status,
      responseTime,
      details: {
        type: 'supabase',
        warningThreshold: 1000,
      },
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message,
    }
  }
}

/**
 * Check Stripe API connectivity
 */
async function checkStripe(): Promise<HealthCheck> {
  try {
    const start = Date.now()

    // Dynamic import to avoid issues if Stripe is not installed
    const Stripe = require('stripe')
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // Lightweight API call to check connectivity
    await stripe.balance.retrieve()

    const responseTime = Date.now() - start

    return {
      status: responseTime > 2000 ? 'degraded' : 'healthy',
      responseTime,
      details: {
        service: 'stripe',
      },
    }
  } catch (error) {
    return {
      status: 'degraded', // Not critical if Stripe is down
      error: (error as Error).message,
      details: {
        service: 'stripe',
        note: 'Payment processing may be affected',
      },
    }
  }
}

/**
 * Check Twilio API connectivity
 */
async function checkTwilio(): Promise<HealthCheck> {
  try {
    const start = Date.now()

    const twilio = require('twilio')
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    // Check account status
    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch()

    const responseTime = Date.now() - start

    return {
      status: responseTime > 2000 ? 'degraded' : 'healthy',
      responseTime,
      details: {
        service: 'twilio',
      },
    }
  } catch (error) {
    return {
      status: 'degraded', // Not critical if Twilio is down
      error: (error as Error).message,
      details: {
        service: 'twilio',
        note: 'SMS/voice features may be affected',
      },
    }
  }
}

/**
 * Check email service connectivity
 */
async function checkEmail(): Promise<HealthCheck> {
  try {
    const start = Date.now()

    // For Resend, we just verify the API key is set
    // Making actual API calls in health checks can trigger rate limits

    const hasApiKey = !!process.env.RESEND_API_KEY

    const responseTime = Date.now() - start

    return {
      status: hasApiKey ? 'healthy' : 'degraded',
      responseTime,
      details: {
        service: 'resend',
        configured: hasApiKey,
      },
    }
  } catch (error) {
    return {
      status: 'degraded',
      error: (error as Error).message,
      details: {
        service: 'resend',
        note: 'Email sending may be affected',
      },
    }
  }
}

/**
 * Check in-memory cache health
 */
async function checkCache(): Promise<HealthCheck> {
  try {
    // Check if cache module exists
    let cacheStats = {
      available: false,
      size: 0,
    }

    try {
      const { caches } = await import('@/lib/cache/redis-cache')

      cacheStats = {
        available: true,
        size:
          (caches.customers?.size || 0) +
          (caches.promotions?.size || 0) +
          (caches.opportunities?.size || 0),
      }
    } catch {
      // Cache not available
    }

    return {
      status: cacheStats.available ? 'healthy' : 'degraded',
      details: {
        ...cacheStats,
        note: !cacheStats.available ? 'Cache not configured' : undefined,
      },
    }
  } catch (error) {
    return {
      status: 'degraded',
      error: (error as Error).message,
    }
  }
}

/**
 * Check memory usage
 */
function checkMemory(): HealthCheck {
  try {
    const memoryUsage = process.memoryUsage()

    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)
    const usagePercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (usagePercentage > 90) {
      status = 'unhealthy'
    } else if (usagePercentage > 75) {
      status = 'degraded'
    }

    return {
      status,
      details: {
        heapUsedMB,
        heapTotalMB,
        usagePercentage,
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      },
    }
  } catch (error) {
    return {
      status: 'degraded',
      error: (error as Error).message,
    }
  }
}

/**
 * Check file system access
 */
async function checkFileSystem(): Promise<HealthCheck> {
  try {
    const fs = require('fs').promises
    const path = require('path')

    // Try to write and read a temp file
    const tempPath = path.join('/tmp', `health-check-${Date.now()}.txt`)
    const testData = 'health-check-test'

    await fs.writeFile(tempPath, testData)
    const readData = await fs.readFile(tempPath, 'utf-8')
    await fs.unlink(tempPath)

    const status = readData === testData ? 'healthy' : 'degraded'

    return {
      status,
      details: {
        writable: true,
        readable: true,
      },
    }
  } catch (error) {
    return {
      status: 'degraded',
      error: (error as Error).message,
      details: {
        note: 'File operations may be affected',
      },
    }
  }
}
