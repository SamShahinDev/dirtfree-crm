import { getServerSupabase } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { Globe, Database, Cloud, Activity, Clock, TrendingUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

export default async function IntegrationHealthPage() {
  const supabase = await getServerSupabase()

  // Fetch all integrations
  const { data: integrations } = await supabase
    .from('integration_health')
    .select('*')
    .order('integration_type', { ascending: true })
    .order('integration_name', { ascending: true })

  // Group by type
  const grouped = {
    platform:
      integrations?.filter((i) => i.integration_type === 'platform') || [],
    database:
      integrations?.filter((i) => i.integration_type === 'database') || [],
    service:
      integrations?.filter((i) => i.integration_type === 'service') || [],
  }

  // Calculate overall statistics
  const totalIntegrations = integrations?.length || 0
  const healthyCount =
    integrations?.filter((i) => i.status === 'healthy').length || 0
  const degradedCount =
    integrations?.filter((i) => i.status === 'degraded').length || 0
  const downCount =
    integrations?.filter((i) => i.status === 'down').length || 0
  const unknownCount =
    integrations?.filter((i) => i.status === 'unknown').length || 0

  const overallStatus =
    downCount > 0 ? 'down' : degradedCount > 0 ? 'degraded' : 'healthy'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Health Monitoring"
        description="Monitor connectivity and health status of all platforms and services"
      />

      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatusCard
          label="Overall Status"
          status={overallStatus}
          icon={Activity}
          large
        />
        <MetricCard
          label="Healthy"
          value={healthyCount}
          total={totalIntegrations}
          color="green"
        />
        <MetricCard
          label="Degraded"
          value={degradedCount}
          total={totalIntegrations}
          color="yellow"
        />
        <MetricCard
          label="Down"
          value={downCount}
          total={totalIntegrations}
          color="red"
        />
        <MetricCard
          label="Unknown"
          value={unknownCount}
          total={totalIntegrations}
          color="gray"
        />
      </div>

      {/* Platforms */}
      <IntegrationSection
        title="Platforms"
        icon={Globe}
        integrations={grouped.platform}
      />

      {/* Database */}
      <IntegrationSection
        title="Database & Storage"
        icon={Database}
        integrations={grouped.database}
      />

      {/* External Services */}
      <IntegrationSection
        title="External Services"
        icon={Cloud}
        integrations={grouped.service}
      />
    </div>
  )
}

interface IntegrationSectionProps {
  title: string
  icon: any
  integrations: any[]
}

function IntegrationSection({
  title,
  icon: Icon,
  integrations,
}: IntegrationSectionProps) {
  if (integrations.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {integrations.map((integration) => (
            <IntegrationRow key={integration.id} integration={integration} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface IntegrationRowProps {
  integration: any
}

function IntegrationRow({ integration }: IntegrationRowProps) {
  const statusConfig = {
    healthy: {
      color: 'bg-green-500',
      badgeVariant: 'default' as const,
      textColor: 'text-green-600',
    },
    degraded: {
      color: 'bg-yellow-500',
      badgeVariant: 'secondary' as const,
      textColor: 'text-yellow-600',
    },
    down: {
      color: 'bg-red-500',
      badgeVariant: 'destructive' as const,
      textColor: 'text-red-600',
    },
    unknown: {
      color: 'bg-gray-500',
      badgeVariant: 'outline' as const,
      textColor: 'text-gray-600',
    },
  }

  const config = statusConfig[integration.status as keyof typeof statusConfig]

  const isStale =
    new Date(integration.last_check_at).getTime() <
    Date.now() - integration.check_interval_minutes * 2 * 60 * 1000

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 border rounded-lg',
        integration.status === 'down' && 'border-red-200 bg-red-50/50',
        integration.status === 'degraded' &&
          'border-yellow-200 bg-yellow-50/50'
      )}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className={cn('h-3 w-3 rounded-full', config.color)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium">{integration.integration_name}</div>
            {isStale && (
              <Badge variant="outline" className="text-xs">
                Stale
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last checked:{' '}
              {formatDistanceToNow(new Date(integration.last_check_at), {
                addSuffix: true,
              })}
            </div>

            {integration.consecutive_failures > 0 && (
              <div className="text-red-600">
                {integration.consecutive_failures} consecutive failures
              </div>
            )}
          </div>

          {integration.last_error_message && (
            <div className="mt-1 text-sm text-red-600 truncate">
              Error: {integration.last_error_message}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        {integration.response_time_ms !== null && (
          <div className="text-right">
            <div className="text-muted-foreground text-xs">Response Time</div>
            <div
              className={cn(
                'font-medium',
                integration.response_time_ms > 2000 && 'text-yellow-600',
                integration.response_time_ms > 5000 && 'text-red-600'
              )}
            >
              {integration.response_time_ms}ms
            </div>
          </div>
        )}

        {integration.success_rate !== null && (
          <div className="text-right">
            <div className="text-muted-foreground text-xs">
              Success Rate (24h)
            </div>
            <div
              className={cn(
                'font-medium',
                integration.success_rate < 90 && 'text-yellow-600',
                integration.success_rate < 70 && 'text-red-600'
              )}
            >
              {integration.success_rate}%
            </div>
          </div>
        )}

        {integration.uptime_percentage !== null && (
          <div className="text-right">
            <div className="text-muted-foreground text-xs">
              Uptime (30d)
            </div>
            <div
              className={cn(
                'font-medium flex items-center gap-1',
                integration.uptime_percentage < 95 && 'text-yellow-600',
                integration.uptime_percentage < 85 && 'text-red-600'
              )}
            >
              <TrendingUp className="h-3 w-3" />
              {integration.uptime_percentage}%
            </div>
          </div>
        )}

        <Badge variant={config.badgeVariant} className="capitalize">
          {integration.status}
        </Badge>
      </div>
    </div>
  )
}

interface StatusCardProps {
  label: string
  status: 'healthy' | 'degraded' | 'down'
  icon: any
  large?: boolean
}

function StatusCard({ label, status, icon: Icon, large }: StatusCardProps) {
  const config = {
    healthy: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      icon: 'text-green-600',
    },
    degraded: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      icon: 'text-yellow-600',
    },
    down: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      icon: 'text-red-600',
    },
  }

  const c = config[status]

  return (
    <Card className={c.bg}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <Icon className={cn('h-6 w-6', c.icon)} />
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              {label}
            </div>
            <div className={cn('text-2xl font-bold capitalize', c.text)}>
              {status}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface MetricCardProps {
  label: string
  value: number
  total: number
  color: 'green' | 'yellow' | 'red' | 'gray'
}

function MetricCard({ label, value, total, color }: MetricCardProps) {
  const colorConfig = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
  }

  const percentage = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm font-medium text-muted-foreground">
          {label}
        </div>
        <div className={cn('text-3xl font-bold', colorConfig[color])}>
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {percentage}% of {total}
        </div>
      </CardContent>
    </Card>
  )
}
