'use client'

import { useState, useEffect } from 'react'
import { FollowUpCard } from '@/components/opportunities/FollowUpCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  Calendar,
  Clock,
  RefreshCw,
  CheckCircle,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

interface Opportunity {
  id: string
  customer_id: string
  customer: {
    full_name: string
    email: string | null
    phone: string | null
  }
  opportunity_type: string
  estimated_value: number | null
  reason: string | null
  follow_up_scheduled_date: string | null
  assigned_user: {
    full_name: string
  } | null
  created_at: string
  status: string
}

interface FollowUpStats {
  today: number
  overdue: number
  upcoming: number
  totalValue: number
}

export default function FollowUpsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [stats, setStats] = useState<FollowUpStats>({
    today: 0,
    overdue: 0,
    upcoming: 0,
    totalValue: 0,
  })

  useEffect(() => {
    loadFollowUps()
  }, [])

  async function loadFollowUps() {
    try {
      setLoading(true)

      // Fetch opportunities with scheduled follow-ups
      const res = await fetch('/api/opportunities?status=follow_up_scheduled&limit=200')
      if (!res.ok) throw new Error('Failed to load follow-ups')

      const data = await res.json()
      const opps = data.data?.opportunities || []

      setOpportunities(opps)
      calculateStats(opps)
    } catch (error) {
      console.error('Load follow-ups error:', error)
      toast.error('Failed to load follow-ups')
    } finally {
      setLoading(false)
    }
  }

  function calculateStats(opps: Opportunity[]) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const todayOpps = opps.filter((opp) => {
      if (!opp.follow_up_scheduled_date) return false
      const dueDate = new Date(opp.follow_up_scheduled_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() === today.getTime()
    })

    const overdueOpps = opps.filter((opp) => {
      if (!opp.follow_up_scheduled_date) return false
      const dueDate = new Date(opp.follow_up_scheduled_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() < today.getTime()
    })

    const upcomingOpps = opps.filter((opp) => {
      if (!opp.follow_up_scheduled_date) return false
      const dueDate = new Date(opp.follow_up_scheduled_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() >= tomorrow.getTime() && dueDate.getTime() < nextWeek.getTime()
    })

    const totalValue = opps.reduce((sum, opp) => sum + (opp.estimated_value || 0), 0)

    setStats({
      today: todayOpps.length,
      overdue: overdueOpps.length,
      upcoming: upcomingOpps.length,
      totalValue,
    })
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadFollowUps()
    setRefreshing(false)
    toast.success('Follow-ups refreshed')
  }

  function getTodayFollowUps(): Opportunity[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return opportunities.filter((opp) => {
      if (!opp.follow_up_scheduled_date) return false
      const dueDate = new Date(opp.follow_up_scheduled_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() === today.getTime()
    })
  }

  function getOverdueFollowUps(): Opportunity[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return opportunities
      .filter((opp) => {
        if (!opp.follow_up_scheduled_date) return false
        const dueDate = new Date(opp.follow_up_scheduled_date)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate.getTime() < today.getTime()
      })
      .sort((a, b) => {
        const dateA = new Date(a.follow_up_scheduled_date!).getTime()
        const dateB = new Date(b.follow_up_scheduled_date!).getTime()
        return dateA - dateB // Oldest first
      })
  }

  function getUpcomingFollowUps(): { date: string; opportunities: Opportunity[] }[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const upcoming = opportunities.filter((opp) => {
      if (!opp.follow_up_scheduled_date) return false
      const dueDate = new Date(opp.follow_up_scheduled_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() >= tomorrow.getTime() && dueDate.getTime() < nextWeek.getTime()
    })

    // Group by date
    const grouped = upcoming.reduce((acc, opp) => {
      const dateKey = new Date(opp.follow_up_scheduled_date!)
        .toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })

      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push(opp)
      return acc
    }, {} as Record<string, Opportunity[]>)

    return Object.entries(grouped)
      .map(([date, opps]) => ({ date, opportunities: opps }))
      .sort((a, b) => {
        // Sort by date
        const dateA = new Date(a.opportunities[0].follow_up_scheduled_date!).getTime()
        const dateB = new Date(b.opportunities[0].follow_up_scheduled_date!).getTime()
        return dateA - dateB
      })
  }

  const todayFollowUps = getTodayFollowUps()
  const overdueFollowUps = getOverdueFollowUps()
  const upcomingFollowUps = getUpcomingFollowUps()

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Follow-ups</h1>
          <p className="text-muted-foreground mt-1">
            Manage scheduled opportunity follow-ups
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today
                </CardTitle>
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
              <p className="text-xs text-muted-foreground mt-1">Due today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overdue
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
              <p className="text-xs text-muted-foreground mt-1">Past due date</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Upcoming
                </CardTitle>
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.upcoming}</div>
              <p className="text-xs text-muted-foreground mt-1">Next 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Value
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${stats.totalValue.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Potential revenue</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Follow-ups Tabs */}
      <Tabs defaultValue="today" className="space-y-4">
        <TabsList>
          <TabsTrigger value="today" className="relative">
            Today
            {stats.today > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.today}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="relative">
            Overdue
            {stats.overdue > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.overdue}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="relative">
            Upcoming
            {stats.upcoming > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.upcoming}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Today's Follow-ups */}
        <TabsContent value="today" className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : todayFollowUps.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No follow-ups due today</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You're all caught up for today!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {todayFollowUps.map((opp) => (
                <FollowUpCard
                  key={opp.id}
                  opportunity={opp}
                  variant="today"
                  onComplete={loadFollowUps}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Overdue Follow-ups */}
        <TabsContent value="overdue" className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : overdueFollowUps.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
                <p className="text-muted-foreground">No overdue follow-ups</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Great job staying on top of your follow-ups!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {overdueFollowUps.map((opp) => (
                <FollowUpCard
                  key={opp.id}
                  opportunity={opp}
                  variant="overdue"
                  onComplete={loadFollowUps}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Upcoming Follow-ups */}
        <TabsContent value="upcoming" className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : upcomingFollowUps.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No upcoming follow-ups</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Schedule some follow-ups to see them here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {upcomingFollowUps.map((group) => (
                <div key={group.date}>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    {group.date}
                  </h3>
                  <div className="space-y-4">
                    {group.opportunities.map((opp) => (
                      <FollowUpCard
                        key={opp.id}
                        opportunity={opp}
                        variant="upcoming"
                        onComplete={loadFollowUps}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
