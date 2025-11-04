'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, RefreshCw, AlertTriangle } from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { getThread, updateThreadStatus, type ThreadDetail, type PostDetail } from '../actions'
import { PostItem } from './PostItem'
import { PostComposer } from './PostComposer'

interface ThreadViewProps {
  threadId: string
  onThreadDeleted: () => void
}

export function ThreadView({ threadId, onThreadDeleted }: ThreadViewProps) {
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [posts, setPosts] = useState<PostDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Load thread data
  const loadThread = async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await getThread({ threadId })

      if (result.success && result.data) {
        setThread(result.data.thread)
        setPosts(result.data.posts)
      } else {
        setError(result.error || 'Failed to load thread')
      }
    } catch (err) {
      setError('Failed to load thread')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadThread()
  }, [threadId])

  // Handle thread status update
  const handleStatusUpdate = async (newStatus: 'open' | 'acknowledged' | 'resolved') => {
    if (!thread || updatingStatus) return

    setUpdatingStatus(true)
    try {
      const result = await updateThreadStatus({
        threadId: thread.id,
        status: newStatus
      })

      if (result.success) {
        setThread(prev => prev ? { ...prev, status: newStatus } : null)
      } else {
        console.error('Failed to update thread status:', result.error)
      }
    } catch (error) {
      console.error('Error updating thread status:', error)
    } finally {
      setUpdatingStatus(false)
    }
  }

  // Handle post updates
  const handlePostUpdate = () => {
    loadThread() // Reload to get latest data
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="border-b">
          <div className="space-y-2">
            <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error || !thread) {
    return (
      <Card className="h-full">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">{error || 'Thread not found'}</p>
            <Button
              variant="outline"
              onClick={loadThread}
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const canUpdateStatus = true // Admin/dispatcher can update - add role check here

  return (
    <Card className="h-full flex flex-col">
      {/* Thread Header */}
      <CardHeader className="border-b flex-shrink-0">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 mr-4">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {thread.title}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Created by {thread.createdByName || 'Unknown'} {' '}
                {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={cn('border', getStatusColor(thread.status))}>
                {thread.status}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadThread}
                aria-label="Refresh thread"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Status Update (Admin/Dispatcher only) */}
          {canUpdateStatus && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Status:</span>
              <Select
                value={thread.status}
                onValueChange={handleStatusUpdate}
                disabled={updatingStatus}
              >
                <SelectTrigger className="w-40 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>

      {/* Posts */}
      <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No posts in this thread yet.</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <PostItem
              key={post.id}
              post={post}
              isFirst={index === 0}
              onUpdate={handlePostUpdate}
            />
          ))
        )}
      </CardContent>

      {/* Post Composer */}
      <div className="flex-shrink-0 border-t p-6">
        <PostComposer
          threadId={thread.id}
          onPostCreated={handlePostUpdate}
        />
      </div>
    </Card>
  )
}