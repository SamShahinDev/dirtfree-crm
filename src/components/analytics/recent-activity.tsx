import { getRecentActivityAction } from '@/app/actions/analytics'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  UserPlus,
  Star,
  AlertCircle
} from 'lucide-react'
import { formatDistance } from 'date-fns'
import { cn } from '@/lib/utils'

interface Activity {
  id: string
  type: 'job_completed' | 'job_cancelled' | 'payment_received' | 'new_customer' | 'review_received' | 'job_scheduled'
  title: string
  description: string
  timestamp: Date
  user?: {
    name: string
    avatar?: string
    initials: string
  }
  metadata?: {
    amount?: number
    rating?: number
    jobId?: string
    customerId?: string
  }
}

export async function RecentActivity() {
  const activities = await getRecentActivityAction()

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'job_completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'job_cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'payment_received':
        return <DollarSign className="h-4 w-4 text-green-600" />
      case 'new_customer':
        return <UserPlus className="h-4 w-4 text-blue-500" />
      case 'review_received':
        return <Star className="h-4 w-4 text-yellow-500" />
      case 'job_scheduled':
        return <Calendar className="h-4 w-4 text-purple-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'job_completed':
        return 'bg-green-50 border-green-200'
      case 'job_cancelled':
        return 'bg-red-50 border-red-200'
      case 'payment_received':
        return 'bg-green-50 border-green-200'
      case 'new_customer':
        return 'bg-blue-50 border-blue-200'
      case 'review_received':
        return 'bg-yellow-50 border-yellow-200'
      case 'job_scheduled':
        return 'bg-purple-50 border-purple-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          <p className="text-sm text-gray-500 mt-1">
            Latest updates across your business
          </p>
        </div>
        <button className="text-sm text-blue-600 hover:text-blue-700">
          View All
        </button>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={cn(
                'flex gap-4 p-4 rounded-lg border',
                getActivityColor(activity.type)
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {activity.description}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 mt-2">
                      {activity.metadata?.amount && (
                        <Badge variant="secondary" className="text-xs">
                          ${activity.metadata.amount}
                        </Badge>
                      )}
                      {activity.metadata?.rating && (
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                'h-3 w-3',
                                i < activity.metadata.rating!
                                  ? 'text-yellow-500 fill-current'
                                  : 'text-gray-300'
                              )}
                            />
                          ))}
                        </div>
                      )}
                      {activity.user && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-xs">
                              {activity.user.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-gray-600">
                            {activity.user.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                    {formatDistance(activity.timestamp, new Date(), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Activity Summary */}
      <div className="mt-6 pt-6 border-t">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-sm font-semibold">{activities.filter(a => a.type === 'job_completed').length}</span>
            </div>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="h-3 w-3 text-purple-500" />
              <span className="text-sm font-semibold">{activities.filter(a => a.type === 'job_scheduled').length}</span>
            </div>
            <p className="text-xs text-gray-500">Scheduled</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign className="h-3 w-3 text-green-600" />
              <span className="text-sm font-semibold">{activities.filter(a => a.type === 'payment_received').length}</span>
            </div>
            <p className="text-xs text-gray-500">Payments</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <UserPlus className="h-3 w-3 text-blue-500" />
              <span className="text-sm font-semibold">{activities.filter(a => a.type === 'new_customer').length}</span>
            </div>
            <p className="text-xs text-gray-500">New Customers</p>
          </div>
        </div>
      </div>
    </Card>
  )
}