'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  Users,
  CreditCard,
  Activity,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  Briefcase,
  AlertCircle,
  Package,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  FileText,
  Home,
  MapPin,
  Star
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScheduleJobModal } from '@/components/dashboard/schedule-job-modal';
import { DashboardDatePicker } from '@/components/dashboard/dashboard-date-picker';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  getDashboardStats,
  getTodaysJobs,
  getRecentActivity,
  getTopTechnicians
} from './actions';

// Enhanced chart data (kept for revenue chart - placeholder for future monthly tracking)
const revenueData = [
  { month: 'Jan', revenue: 42500, jobs: 187, profit: 15200 },
  { month: 'Feb', revenue: 39800, jobs: 165, profit: 14100 },
  { month: 'Mar', revenue: 45200, jobs: 198, profit: 16800 },
  { month: 'Apr', revenue: 43700, jobs: 189, profit: 15900 },
  { month: 'May', revenue: 48900, jobs: 214, profit: 18200 },
  { month: 'Jun', revenue: 51200, jobs: 223, profit: 19500 },
  { month: 'Jul', revenue: 49800, jobs: 217, profit: 18700 },
];

// Helper function to get icon and colors for activity types
function getActivityIcon(type: string) {
  switch (type) {
    case 'job_completed':
      return { icon: CheckCircle, iconColor: 'text-green-600', bgColor: 'bg-green-50' };
    case 'new_customer':
      return { icon: Users, iconColor: 'text-blue-600', bgColor: 'bg-blue-50' };
    case 'job_scheduled':
      return { icon: Calendar, iconColor: 'text-purple-600', bgColor: 'bg-purple-50' };
    case 'update':
      return { icon: Activity, iconColor: 'text-orange-600', bgColor: 'bg-orange-50' };
    default:
      return { icon: Activity, iconColor: 'text-gray-600', bgColor: 'bg-gray-50' };
  }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const router = useRouter();

  // State for real data
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeJobs: 0,
    newCustomers: 0,
    satisfactionRate: 0,
    totalCustomers: 0,
    serviceDistribution: [] as Array<{
      name: string;
      value: number;
      revenue: number;
      color: string;
    }>
  });
  const [todaysJobs, setTodaysJobs] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [topTechnicians, setTopTechnicians] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);

        const [statsResult, jobsResult, activityResult, techsResult] = await Promise.all([
          getDashboardStats({}),
          getTodaysJobs({}),
          getRecentActivity({}),
          getTopTechnicians({})
        ]);

        if (statsResult.success) setStats(statsResult.data);
        if (jobsResult.success) setTodaysJobs(jobsResult.data);
        if (activityResult.success) setRecentActivity(activityResult.data);
        if (techsResult.success) setTopTechnicians(techsResult.data);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your business today.
          </p>
        </div>
        <div className="relative z-20 flex items-center gap-2">
          <DashboardDatePicker />
          <ScheduleJobModal />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-all duration-200 border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-2">
              <span className="ml-1">last 30 days</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeJobs}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-2">
              <span className="ml-1">scheduled or in progress</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newCustomers}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-2">
              <span className="ml-1">this month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction Rate</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.satisfactionRate}%</div>
            <div className="flex items-center text-xs text-muted-foreground mt-2">
              <span className="ml-1">customer satisfaction</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="col-span-full lg:col-span-4 hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>Monthly revenue and profit trends</CardDescription>
              </div>
              <Tabs value={timeRange} onValueChange={setTimeRange} className="w-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="7d" className="text-xs px-2">7D</TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs px-2">30D</TabsTrigger>
                  <TabsTrigger value="90d" className="text-xs px-2">90D</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right Side Content */}
        <div className="col-span-full lg:col-span-3 space-y-6">
          {/* Service Distribution */}
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle>Service Distribution</CardTitle>
              <CardDescription>Revenue by service type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.serviceDistribution.length > 0 ? (
                  stats.serviceDistribution.map((service) => (
                    <div key={service.name}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: service.color }}
                          />
                          <span className="text-sm font-medium">{service.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          ${service.revenue.toLocaleString()}
                        </span>
                      </div>
                      <Progress
                        value={service.value}
                        className="h-2"
                        style={{
                          ['--progress-background' as any]: service.color + '20',
                          ['--progress-foreground' as any]: service.color,
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No service data yet
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Revenue</span>
                  <span className="text-lg font-bold">${stats.totalRevenue.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today's Schedule Summary */}
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
              <CardDescription>Upcoming jobs and appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Jobs Scheduled</p>
                      <p className="text-xs text-muted-foreground">For today</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">{todaysJobs.length}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Completed</p>
                      <p className="text-xs text-muted-foreground">Successfully finished</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-green-600">
                    {todaysJobs.filter(j => j.status === 'completed').length}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <Truck className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">In Progress</p>
                      <p className="text-xs text-muted-foreground">Currently active</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">
                    {todaysJobs.filter(j => j.status === 'in_progress').length}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completion rate</span>
                  <span className="font-medium">
                    {todaysJobs.length > 0
                      ? `${Math.round((todaysJobs.filter(j => j.status === 'completed').length / todaysJobs.length) * 100)}%`
                      : '0%'
                    }
                  </span>
                </div>
                <Progress
                  value={todaysJobs.length > 0
                    ? (todaysJobs.filter(j => j.status === 'completed').length / todaysJobs.length) * 100
                    : 0
                  }
                  className="mt-2 h-2"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Technicians */}
        <Card className="hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>Best technicians this month</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                View All
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topTechnicians.length > 0 ? (
                topTechnicians.map((tech, index) => (
                  <div key={tech.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "flex items-center justify-center h-8 w-8 rounded-full font-semibold text-sm",
                        index === 0 && "bg-yellow-100 text-yellow-700",
                        index === 1 && "bg-gray-100 text-gray-700",
                        index === 2 && "bg-orange-100 text-orange-700",
                        index > 2 && "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{tech.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{tech.name}</p>
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                          <span>{tech.jobs} jobs</span>
                          <span className="flex items-center">
                            <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                            {tech.rating}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${tech.revenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">revenue</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No technician performance data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates from your business</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                View All
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => {
                  const { icon: Icon, iconColor, bgColor } = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={cn("mt-0.5 rounded-full p-2", bgColor)}>
                        <Icon className={cn("h-4 w-4", iconColor)} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.description}
                        </p>
                        {activity.customer && (
                          <p className="text-xs font-medium">
                            {activity.customer}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {activity.time}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Jobs Table */}
      <Card className="hover:shadow-lg transition-all duration-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upcoming Jobs</CardTitle>
              <CardDescription>Scheduled appointments for today</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('View Calendar clicked!');
                router.push('/schedule/calendar');
              }}
              className="relative z-10 cursor-pointer"
            >
              <Calendar className="mr-2 h-4 w-4 pointer-events-none" />
              <span className="pointer-events-none">View Calendar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Time</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Service</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {todaysJobs.length > 0 ? (
                  todaysJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{job.time}</td>
                      <td className="px-4 py-3">{job.customer}</td>
                      <td className="px-4 py-3">{job.service}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={job.status === 'scheduled' ? 'default' : 'secondary'}
                          className={cn(
                            job.status === 'scheduled' && "bg-green-100 text-green-700 hover:bg-green-200",
                            job.status === 'in_progress' && "bg-blue-100 text-blue-700 hover:bg-blue-200",
                            job.status === 'completed' && "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          )}
                        >
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/jobs/${job.id}`)}>
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No jobs scheduled for today
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}