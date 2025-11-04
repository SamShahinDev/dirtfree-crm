import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import { getAllFeatureFlags } from '@/lib/portal/feature-flags'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Portal Status API
 *
 * GET /api/portal/status
 * - Returns portal operational status
 * - Includes maintenance mode, feature flags, version, known issues
 * - Used by portal to determine available features and display banners
 *
 * No authentication required (public endpoint)
 */

const API_VERSION = 'v1'

/**
 * Maintenance window
 */
interface MaintenanceWindow {
  id: string
  title: string
  description: string | null
  scheduledStart: string
  scheduledEnd: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  affectsPortal: boolean
  affectsCRM: boolean
}

/**
 * Known issue
 */
interface KnownIssue {
  component: string
  status: string
  message: string | null
  since: string
}

/**
 * Portal status response
 */
interface PortalStatus {
  maintenanceMode: boolean
  currentMaintenance?: MaintenanceWindow
  upcomingMaintenance: MaintenanceWindow[]
  featureFlags: Record<string, boolean>
  version: {
    app: string
    api: string
    build: string | null
    deployedAt: string | null
  }
  knownIssues: KnownIssue[]
  systemStatus: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance'
  timestamp: string
}

/**
 * Get version information from package.json
 */
function getVersionInfo() {
  try {
    const packagePath = join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))

    return {
      app: packageJson.version || '1.0.0',
      api: API_VERSION,
      build: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || null,
      deployedAt: process.env.VERCEL_DEPLOYMENT_TIME || null,
    }
  } catch (error) {
    console.error('[Status] Error reading version:', error)
    return {
      app: '1.0.0',
      api: API_VERSION,
      build: null,
      deployedAt: null,
    }
  }
}

/**
 * Check if currently in maintenance mode
 */
async function checkMaintenanceMode(): Promise<{
  inMaintenance: boolean
  currentWindow?: MaintenanceWindow
}> {
  try {
    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('maintenance_windows')
      .select('*')
      .eq('status', 'in_progress')
      .eq('affects_portal', true)
      .single()

    if (error || !data) {
      return { inMaintenance: false }
    }

    return {
      inMaintenance: true,
      currentWindow: {
        id: (data as any).id,
        title: (data as any).title,
        description: (data as any).description,
        scheduledStart: (data as any).scheduled_start,
        scheduledEnd: (data as any).scheduled_end,
        status: (data as any).status,
        affectsPortal: (data as any).affects_portal,
        affectsCRM: (data as any).affects_crm,
      },
    }
  } catch (error) {
    console.error('[Status] Error checking maintenance mode:', error)
    return { inMaintenance: false }
  }
}

/**
 * Get upcoming maintenance windows
 */
async function getUpcomingMaintenance(): Promise<MaintenanceWindow[]> {
  try {
    const supabase = getServiceSupabase()

    const { data, error } = await supabase.rpc('get_upcoming_maintenance', {
      p_hours_ahead: 168, // 7 days
    } as any)

    if (error || !data) {
      return []
    }

    return (data as any[]).map((window: any) => ({
      id: window.id,
      title: window.title,
      description: window.description,
      scheduledStart: window.scheduled_start,
      scheduledEnd: window.scheduled_end,
      status: window.status,
      affectsPortal: window.affects_portal,
      affectsCRM: window.affects_crm,
    }))
  } catch (error) {
    console.error('[Status] Error fetching upcoming maintenance:', error)
    return []
  }
}

/**
 * Get known issues (unresolved system status)
 */
async function getKnownIssues(): Promise<KnownIssue[]> {
  try {
    const supabase = getServiceSupabase()

    const { data, error } = await supabase.rpc('get_system_status')

    if (error || !data) {
      return []
    }

    return (data as any[])
      .filter((status: any) => status.status !== 'operational')
      .map((status: any) => ({
        component: status.component,
        status: status.status,
        message: status.message,
        since: status.since,
      }))
  } catch (error) {
    console.error('[Status] Error fetching known issues:', error)
    return []
  }
}

/**
 * Get feature flags as simple key-value pairs
 */
async function getFeatureFlagsStatus(): Promise<Record<string, boolean>> {
  try {
    const flags = await getAllFeatureFlags()

    const flagsStatus: Record<string, boolean> = {}
    for (const flag of flags) {
      flagsStatus[flag.key] = flag.enabled && flag.rolloutPercentage === 100
    }

    return flagsStatus
  } catch (error) {
    console.error('[Status] Error fetching feature flags:', error)
    return {}
  }
}

/**
 * Calculate overall system status
 */
function calculateSystemStatus(
  inMaintenance: boolean,
  knownIssues: KnownIssue[]
): PortalStatus['systemStatus'] {
  if (inMaintenance) {
    return 'maintenance'
  }

  const criticalIssues = knownIssues.filter(
    issue => issue.status === 'major_outage'
  )
  const partialIssues = knownIssues.filter(
    issue => issue.status === 'partial_outage'
  )
  const degradedIssues = knownIssues.filter(
    issue => issue.status === 'degraded'
  )

  if (criticalIssues.length > 0) {
    return 'major_outage'
  }

  if (partialIssues.length > 0) {
    return 'partial_outage'
  }

  if (degradedIssues.length > 0) {
    return 'degraded'
  }

  return 'operational'
}

/**
 * GET - Portal status
 */
export async function GET(request: NextRequest) {
  try {
    // Get all status information in parallel
    const [
      maintenance,
      upcomingMaintenance,
      knownIssues,
      featureFlags,
    ] = await Promise.all([
      checkMaintenanceMode(),
      getUpcomingMaintenance(),
      getKnownIssues(),
      getFeatureFlagsStatus(),
    ])

    const version = getVersionInfo()

    const systemStatus = calculateSystemStatus(
      maintenance.inMaintenance,
      knownIssues
    )

    const status: PortalStatus = {
      maintenanceMode: maintenance.inMaintenance,
      currentMaintenance: maintenance.currentWindow,
      upcomingMaintenance: upcomingMaintenance.filter(
        w => w.affectsPortal && w.status === 'scheduled'
      ),
      featureFlags,
      version,
      knownIssues,
      systemStatus,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(
      {
        success: true,
        data: status,
        version: API_VERSION,
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('[Status] GET /api/portal/status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'status_check_failed',
        message: error instanceof Error ? error.message : 'Internal server error',
        version: API_VERSION,
      },
      { status: 500 }
    )
  }
}
