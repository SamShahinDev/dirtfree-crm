'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Star, MessageCircle, User, Calendar, ExternalLink } from 'lucide-react'
import Link from 'next/link'

import { useFilterContext } from '@/components/filters/FilterProvider'
import { listRecentResponses, type RecentResponse } from '../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function ResponsesTable() {
  const { filters } = useFilterContext()
  const [responses, setResponses] = useState<RecentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadResponses() {
      try {
        setLoading(true)
        setError(null)

        const result = await listRecentResponses({
          zone: filters.zone || undefined,
          technicianId: filters.technicianId || undefined,
          limit: 25
        })

        setResponses(result)
      } catch (err) {
        console.error('Error loading recent responses:', err)
        setError('Failed to load responses')
      } finally {
        setLoading(false)
      }
    }

    loadResponses()
  }, [filters])

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600 bg-green-50'
    if (score >= 3) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const renderStars = (score: number) => {
    return (
      <div className="flex space-x-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'w-3 h-3',
              star <= score
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-base">
          <MessageCircle className="w-4 h-4 mr-2" />
          Latest Responses
        </CardTitle>
      </CardHeader>

      <CardContent className="px-0">
        {loading ? (
          <div className="space-y-3 px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="px-6 py-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        ) : responses.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <MessageCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No survey responses found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {responses.map((response) => (
              <div key={response.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Customer and Score */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-gray-900 truncate">
                          {response.customerName}
                        </h4>
                        <Badge
                          variant="secondary"
                          className={cn('px-2 py-0.5 text-xs font-bold', getScoreColor(response.score))}
                        >
                          {response.score}
                        </Badge>
                      </div>
                      {renderStars(response.score)}
                    </div>

                    {/* Feedback */}
                    {response.feedback && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        "{response.feedback}"
                      </p>
                    )}

                    {/* Meta Information */}
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {format(new Date(response.date), 'MMM d, h:mm a')}
                      </div>

                      {response.technicianName && (
                        <div className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {response.technicianName}
                        </div>
                      )}

                      {response.zone && (
                        <Badge variant="outline" className="text-xs">
                          {response.zone}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <Link
                      href={`/customers/${response.customerId}`}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="View customer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
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