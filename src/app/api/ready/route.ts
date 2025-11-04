import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

interface DependencyCheck {
  name: string
  status: 'pass' | 'fail'
  responseTime?: number
  error?: string
}

interface ReadinessResponse {
  status: 'ready' | 'not_ready'
  timestamp: string
  service: string
  version: string
  checks: {
    [key: string]: DependencyCheck
  }
  overall: 'pass' | 'fail'
}

async function checkSupabase(): Promise<DependencyCheck> {
  const startTime = Date.now()

  try {
    const supabase = getServerSupabase()
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single()

    const responseTime = Date.now() - startTime

    // We expect this might fail if no users exist, so we check for specific connection errors
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      return {
        name: 'supabase',
        status: 'fail',
        responseTime,
        error: error.message
      }
    }

    return {
      name: 'supabase',
      status: 'pass',
      responseTime
    }
  } catch (error) {
    return {
      name: 'supabase',
      status: 'fail',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkTwilio(): Promise<DependencyCheck> {
  const startTime = Date.now()

  try {
    // Check if Twilio credentials are configured
    const twilioSid = process.env.TWILIO_ACCOUNT_SID
    const twilioToken = process.env.TWILIO_AUTH_TOKEN

    if (!twilioSid || !twilioToken) {
      return {
        name: 'twilio',
        status: 'fail',
        responseTime: Date.now() - startTime,
        error: 'Twilio credentials not configured'
      }
    }

    // Basic validation - don't make actual API call for readiness
    const isValidSid = twilioSid.startsWith('AC') && twilioSid.length === 34
    const isValidToken = twilioToken.length === 32

    if (!isValidSid || !isValidToken) {
      return {
        name: 'twilio',
        status: 'fail',
        responseTime: Date.now() - startTime,
        error: 'Invalid Twilio credentials format'
      }
    }

    return {
      name: 'twilio',
      status: 'pass',
      responseTime: Date.now() - startTime
    }
  } catch (error) {
    return {
      name: 'twilio',
      status: 'fail',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkEnvironment(): Promise<DependencyCheck> {
  const startTime = Date.now()

  try {
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]

    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar])

    if (missingVars.length > 0) {
      return {
        name: 'environment',
        status: 'fail',
        responseTime: Date.now() - startTime,
        error: `Missing environment variables: ${missingVars.join(', ')}`
      }
    }

    return {
      name: 'environment',
      status: 'pass',
      responseTime: Date.now() - startTime
    }
  } catch (error) {
    return {
      name: 'environment',
      status: 'fail',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function GET() {
  try {
    // Run all dependency checks in parallel
    const [supabaseCheck, twilioCheck, envCheck] = await Promise.all([
      checkSupabase(),
      checkTwilio(),
      checkEnvironment()
    ])

    const checks = {
      supabase: supabaseCheck,
      twilio: twilioCheck,
      environment: envCheck
    }

    // Determine overall status
    const allPassed = Object.values(checks).every(check => check.status === 'pass')
    const overall = allPassed ? 'pass' : 'fail'
    const status = allPassed ? 'ready' : 'not_ready'

    const response: ReadinessResponse = {
      status,
      timestamp: new Date().toISOString(),
      service: 'dirt-free-crm',
      version: process.env.npm_package_version || '1.0.0',
      checks,
      overall
    }

    return NextResponse.json(response, {
      status: allPassed ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    const errorResponse: ReadinessResponse = {
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      service: 'dirt-free-crm',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        system: {
          name: 'system',
          status: 'fail',
          error: error instanceof Error ? error.message : 'Unknown system error'
        }
      },
      overall: 'fail'
    }

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}