import { getServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/health
 * Health check endpoint for CRM platform
 * Returns overall system health and subsystem status
 */
export async function GET() {
  const startTime = Date.now()
  const checks: Record<string, any> = {}

  // Check database connectivity
  try {
    const supabase = await getServerSupabase()
    const dbStartTime = Date.now()
    const { error } = await supabase.from('customers').select('id').limit(1)
    const dbResponseTime = Date.now() - dbStartTime

    checks.database = {
      status: error ? 'unhealthy' : dbResponseTime > 1000 ? 'degraded' : 'healthy',
      responseTime: dbResponseTime,
      error: error?.message,
    }
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database check failed',
    }
  }

  // Check storage
  try {
    const supabase = await getServerSupabase()
    const storageStartTime = Date.now()
    const { error } = await supabase.storage.listBuckets()
    const storageResponseTime = Date.now() - storageStartTime

    checks.storage = {
      status: error ? 'unhealthy' : storageResponseTime > 2000 ? 'degraded' : 'healthy',
      responseTime: storageResponseTime,
      error: error?.message,
    }
  } catch (error) {
    checks.storage = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Storage check failed',
    }
  }

  // Check auth service
  try {
    const supabase = await getServerSupabase()
    const authStartTime = Date.now()
    await supabase.auth.getUser()
    const authResponseTime = Date.now() - authStartTime

    checks.auth = {
      status: authResponseTime > 2000 ? 'degraded' : 'healthy',
      responseTime: authResponseTime,
    }
  } catch (error) {
    checks.auth = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Auth check failed',
    }
  }

  // Determine overall status
  const unhealthyCount = Object.values(checks).filter(
    (c: any) => c.status === 'unhealthy'
  ).length
  const degradedCount = Object.values(checks).filter(
    (c: any) => c.status === 'degraded'
  ).length

  let overallStatus = 'healthy'
  if (unhealthyCount > 0) {
    overallStatus = 'unhealthy'
  } else if (degradedCount > 0) {
    overallStatus = 'degraded'
  }

  const totalResponseTime = Date.now() - startTime

  return Response.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    responseTime: totalResponseTime,
    checks,
  })
}
