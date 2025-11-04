'use client'

import { useState, useEffect } from 'react'
import { Search, MessageSquare, Clock, AlertTriangle, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { listThreads, type ThreadSummary } from '../actions'

interface ThreadListProps {
  truckId: string
  selectedThreadId: string | null
  onSelectThread: (threadId: string) => void
}

export function ThreadList({ truckId, selectedThreadId, onSelectThread }: ThreadListProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'acknowledged' | 'resolved'>('all')
  const [error, setError] = useState<string | null>(null)


  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      try {
        setLoading(true)
        setError(null)

        const result = await listThreads({
          truckId,
          status: statusFilter === 'all' ? undefined : statusFilter
        })

        // Handle wrapped action result format: { success: true, data: [...] } or { success: false, error: '...' }
        if (result && typeof result === 'object' && 'success' in result) {
          if (result.success && result.data) {
            setThreads(result.data)
          } else if (!result.success) {
            setError(result.error || 'Failed to load threads')
          } else {
            setThreads([])
          }
        }
        // Fallback for direct array return (in case action framework changes)
        else if (result && Array.isArray(result)) {
          setThreads(result)
        } else {
          setThreads([])
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load threads'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadThreads()
  }, [truckId, statusFilter])

  // Filter threads based on search query
  const filteredThreads = threads.filter(thread =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800'
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="text-center py-8">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 text-sm">{error}</p>
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-500 mt-2">
                Debug: Loading={loading.toString()},
                Threads={threads.length},
                Error={error || 'none'},
                TruckId={truckId}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardContent className="p-4 space-y-4 h-full flex flex-col">
        {/* Search and Filter */}
        <div className="space-y-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 relative z-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="relative z-10 cursor-pointer">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="relative z-50">
              <SelectItem value="all">All Threads</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredThreads.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">
                {searchQuery || statusFilter !== 'all' ? 'No threads match your filters' : 'No threads yet'}
              </p>
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 mt-2">
                  Debug: Loading={loading.toString()},
                  TotalThreads={threads.length},
                  FilteredThreads={filteredThreads.length},
                  Error={error || 'none'},
                  SearchQuery={searchQuery},
                  StatusFilter={statusFilter}
                </div>
              )}
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <Button
                key={thread.id}
                variant="ghost"
                className={cn(
                  'w-full h-auto p-3 justify-start text-left relative z-10 cursor-pointer',
                  selectedThreadId === thread.id && 'bg-blue-50 border-blue-200'
                )}
                onClick={() => onSelectThread(thread.id)}
              >
                <div className="w-full space-y-2">
                  {/* Thread Title */}
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium text-sm truncate flex-1 mr-2">
                      {thread.title}
                    </h4>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', getStatusColor(thread.status))}
                    >
                      {thread.status}
                    </Badge>
                  </div>

                  {/* Thread Meta */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        {thread.postCount}
                      </span>
                      {thread.urgentCount > 0 && (
                        <span className="flex items-center text-red-600">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {thread.urgentCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {thread.lastActivity
                        ? formatDistanceToNow(new Date(thread.lastActivity), { addSuffix: true })
                        : formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })
                      }
                    </div>
                  </div>

                  {/* Created by */}
                  <div className="text-xs text-gray-400">
                    by {thread.createdByName || 'Unknown'}
                  </div>
                </div>
              </Button>
            ))
          )}
        </div>

        {/* Stats */}
        <div className="flex-shrink-0 pt-2 border-t border-gray-200">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{filteredThreads.length} threads</span>
            <span>
              {filteredThreads.filter(t => t.status === 'open').length} open
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}