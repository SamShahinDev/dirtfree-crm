// Website Analytics Dashboard
// Track website performance and conversions directly in the CRM

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Eye,
  Users,
  TrendingUp,
  Percent,
  MousePointerClick,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsSummary {
  total_sessions: number;
  total_page_views: number;
  total_conversions: number;
  conversion_rate: number;
  avg_pages_per_session: number;
  avg_session_duration: number;
}

interface TopPage {
  path: string;
  views: number;
}

interface TopSource {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  conversions: number;
}

interface ConversionFunnel {
  stage: string;
  count: number;
  conversion_rate: number;
}

interface RecentConversion {
  id: string;
  session_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  ended_at: string;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  jobs?: {
    id: string;
    service_type: string;
    estimated_price: number;
  };
}

// ============================================================================
// Main Page Component
// ============================================================================

export default async function WebsiteAnalyticsPage() {
  const supabase = createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get date range (last 7 days)
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // ========================================================================
  // Fetch Analytics Data
  // ========================================================================

  const [
    { data: summary },
    { data: topPages },
    { data: topSources },
    { data: conversionFunnel },
    { data: recentConversions },
  ] = await Promise.all([
    // Get summary stats
    supabase.rpc('get_analytics_summary', {
      start_date: sevenDaysAgo.toISOString(),
      end_date: today.toISOString(),
    }),

    // Get top pages
    supabase.rpc('get_top_pages', { days: 7 }),

    // Get top traffic sources
    supabase.rpc('get_top_sources', { days: 30 }),

    // Get conversion funnel
    supabase.rpc('get_conversion_funnel', { days: 7 }),

    // Get recent conversions
    supabase
      .from('website_sessions')
      .select(
        `
        *,
        customers (id, first_name, last_name, email),
        jobs (id, service_type, estimated_price)
      `
      )
      .eq('converted', true)
      .order('ended_at', { ascending: false })
      .limit(10),
  ]);

  // Default values if queries fail
  const stats: AnalyticsSummary = summary?.[0] || {
    total_sessions: 0,
    total_page_views: 0,
    total_conversions: 0,
    conversion_rate: 0,
    avg_pages_per_session: 0,
    avg_session_duration: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Website Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Track website performance and conversions (Last 7 days)
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Page Views */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_page_views?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.avg_pages_per_session?.toFixed(1) || 0} pages per session
            </p>
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_sessions?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg duration: {Math.floor((stats.avg_session_duration || 0) / 60)}m{' '}
              {(stats.avg_session_duration || 0) % 60}s
            </p>
          </CardContent>
        </Card>

        {/* Conversions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_conversions?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">Bookings completed</p>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.conversion_rate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">Sessions to bookings</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      {conversionFunnel && conversionFunnel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>
              Track how users move through the booking process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conversionFunnel.map((stage: ConversionFunnel) => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium">{stage.stage}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({stage.count?.toLocaleString() || 0})
                      </span>
                    </div>
                    <Badge variant="secondary">{stage.conversion_rate?.toFixed(1) || 0}%</Badge>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${stage.conversion_rate || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Top Pages (Last 7 Days)
            </CardTitle>
            <CardDescription>Most visited pages on your website</CardDescription>
          </CardHeader>
          <CardContent>
            {topPages && topPages.length > 0 ? (
              <div className="space-y-4">
                {topPages.map((page: TopPage) => (
                  <div key={page.path} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MousePointerClick className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{page.path || '/'}</span>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {page.views?.toLocaleString() || 0} views
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No page view data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Traffic Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Traffic Sources (Last 30 Days)
            </CardTitle>
            <CardDescription>Where your visitors are coming from</CardDescription>
          </CardHeader>
          <CardContent>
            {topSources && topSources.length > 0 ? (
              <div className="space-y-4">
                {topSources.map((source: TopSource, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {source.source || 'Direct'}
                        {source.medium && ` / ${source.medium}`}
                      </div>
                      {source.campaign && (
                        <div className="text-xs text-muted-foreground">{source.campaign}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{source.sessions?.toLocaleString() || 0} sessions</div>
                      <div className="text-xs text-muted-foreground">
                        {source.conversions?.toLocaleString() || 0} conversions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No traffic source data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Conversions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Recent Conversions
          </CardTitle>
          <CardDescription>Latest bookings from the website</CardDescription>
        </CardHeader>
        <CardContent>
          {recentConversions && recentConversions.length > 0 ? (
            <div className="space-y-4">
              {recentConversions.map((conversion: RecentConversion) => (
                <div key={conversion.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {conversion.customers ? (
                        <div>
                          <div className="font-medium">
                            {conversion.customers.first_name} {conversion.customers.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {conversion.customers.email}
                          </div>
                        </div>
                      ) : (
                        <div className="font-medium text-muted-foreground">Unknown Customer</div>
                      )}

                      {conversion.jobs && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Service: {conversion.jobs.service_type}
                          {conversion.jobs.estimated_price && (
                            <span className="ml-2">
                              • ${conversion.jobs.estimated_price}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          Source: {conversion.utm_source || 'Direct'}
                        </Badge>
                        {conversion.utm_medium && (
                          <Badge variant="outline" className="text-xs">
                            {conversion.utm_medium}
                          </Badge>
                        )}
                        {conversion.utm_campaign && (
                          <Badge variant="outline" className="text-xs">
                            {conversion.utm_campaign}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <Badge variant="default" className="bg-green-600">
                        Converted
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {conversion.ended_at
                          ? format(new Date(conversion.ended_at), 'MMM d, yyyy')
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Conversions Yet</h3>
              <p className="text-muted-foreground">
                Conversions will appear here once customers complete bookings
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
