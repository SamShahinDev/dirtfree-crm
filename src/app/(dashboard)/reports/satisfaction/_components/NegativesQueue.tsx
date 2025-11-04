'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, Phone, Calendar, User, Plus, CheckCircle } from 'lucide-react'
import Link from 'next/link'

import { useFilterContext } from '@/components/filters/FilterProvider'
import { listUnresolvedNegatives, type UnresolvedNegative } from '../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function NegativesQueue() {
  const { filters } = useFilterContext()
  const [negatives, setNegatives] = useState<UnresolvedNegative[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadNegatives() {
      try {
        setLoading(true)
        setError(null)

        const result = await listUnresolvedNegatives({
          zone: filters.zone || undefined,
          technicianId: filters.technicianId || undefined
        })

        setNegatives(result)
      } catch (err) {
        console.error('Error loading unresolved negatives:', err)
        setError('Failed to load unresolved negatives')
      } finally {
        setLoading(false)
      }
    }

    loadNegatives()
  }, [filters])

  const getScoreColor = (score: number) => {
    if (score <= 2) return 'text-red-700 bg-red-100 border-red-200'
    return 'text-orange-700 bg-orange-100 border-orange-200'
  }

  const getDaysAgo = (dateString: string) => {
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-base">
            <AlertTriangle className="w-4 h-4 mr-2 text-orange-600" />
            Unresolved Negatives
            {negatives.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {negatives.length}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {loading ? (
          <div className="space-y-3 px-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="px-6 py-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        ) : negatives.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">All caught up!</p>
            <p className="text-xs text-gray-400">No unresolved negative feedback</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {negatives.map((negative) => (
              <div key={negative.id} className="px-6 py-4 hover:bg-red-25 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Customer and Score */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-gray-900 truncate">
                          {negative.customerName}
                        </h4>
                        <Badge
                          className={cn('px-2 py-0.5 text-xs font-bold border', getScoreColor(negative.score))}
                        >
                          Score: {negative.score}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {getDaysAgo(negative.respondedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Feedback */}
                    {negative.feedback && (
                      <p className="text-sm text-gray-700 mb-3 p-2 bg-gray-50 rounded border-l-2 border-red-300 italic">
                        "{negative.feedback}"
                      </p>
                    )}

                    {/* Meta Information */}
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
                      {negative.jobDate && (
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Job: {format(new Date(negative.jobDate), 'MMM d')}
                        </div>
                      )}

                      {negative.technicianName && (
                        <div className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {negative.technicianName}
                        </div>
                      )}

                      {negative.zone && (
                        <Badge variant="outline" className="text-xs">
                          {negative.zone}
                        </Badge>
                      )}

                      {negative.customerPhone && (
                        <div className="flex items-center">
                          <Phone className="w-3 h-3 mr-1" />
                          {negative.customerPhone}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {negative.existingReminderId ? (
                        <Link href={`/reminders/${negative.existingReminderId}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            View Reminder
                          </Button>
                        </Link>
                      ) : (
                        <Link
                          href={`/reminders?create=true&type=follow_up&customerId=${negative.customerId}&jobId=${negative.jobId}`}
                        >
                          <Button
                            size="sm"
                            className="text-xs h-7 bg-red-600 hover:bg-red-700"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Create Follow-up
                          </Button>
                        </Link>
                      )}

                      <Link href={`/customers/${negative.customerId}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 text-gray-600 hover:text-gray-900"
                        >
                          View Customer
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}