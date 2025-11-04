'use client'

import { useState, useEffect } from 'react'
import { Check, AlertTriangle, Clock, User, ImageIcon, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Image from 'next/image'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { PhotoGallery } from '@/components/ui/photo-gallery'
import { cn } from '@/lib/utils'
import { updatePostStatus, type PostDetail } from '../actions'

interface PostItemProps {
  post: PostDetail
  isFirst: boolean
  onUpdate: () => void
}

export function PostItem({ post, isFirst, onUpdate }: PostItemProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Get signed URL for photo if available
  useEffect(() => {
    if (post.photoKey && !imageError) {
      fetch(`/api/uploads/sign?key=${encodeURIComponent(post.photoKey)}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.url) {
            setImageUrl(data.url)
          }
        })
        .catch(() => setImageError(true))
    }
  }, [post.photoKey, imageError])

  // Handle status update
  const handleStatusUpdate = async (newStatus: 'open' | 'acknowledged' | 'resolved') => {
    if (updating) return

    setUpdating(true)
    try {
      const result = await updatePostStatus({
        postId: post.id,
        status: newStatus
      })

      if (result.success) {
        onUpdate()
      } else {
        console.error('Failed to update post status:', result.error)
      }
    } catch (error) {
      console.error('Error updating post status:', error)
    } finally {
      setUpdating(false)
    }
  }

  const getKindColor = (kind: string) => {
    switch (kind) {
      case 'need':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'issue':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'note':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'update':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

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

  const canUpdateStatus = true // Add role-based logic here

  return (
    <Card className={cn(
      'border-l-4',
      post.urgent && 'border-l-red-500 bg-red-25',
      !post.urgent && 'border-l-gray-200'
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Post Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Badge className={cn('border', getKindColor(post.kind))}>
              {post.kind}
            </Badge>
            {post.urgent && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Urgent
              </Badge>
            )}
            <Badge variant="secondary" className={getStatusColor(post.status)}>
              {post.status}
            </Badge>
            {post.reminderId && (
              <Badge variant="outline" className="text-xs">
                <ExternalLink className="w-3 h-3 mr-1" />
                Reminder Created
              </Badge>
            )}
          </div>
          <div className="text-xs text-gray-500 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </div>
        </div>

        {/* Post Body */}
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-900 whitespace-pre-wrap">{post.body}</p>
        </div>

        {/* Photos */}
        {(post.imageUrls && post.imageUrls.length > 0) && (
          <div className="mt-3">
            <PhotoGallery
              photos={post.imageUrls.map((url, index) => ({ url, alt: `Post photo ${index + 1}` }))}
              size="md"
              maxPreviewImages={3}
            />
          </div>
        )}

        {/* Legacy single photo support */}
        {!post.imageUrls && post.photoKey && (
          <div className="mt-3">
            {imageUrl && !imageError ? (
              <div className="relative inline-block">
                <Image
                  src={imageUrl}
                  alt="Post attachment"
                  width={300}
                  height={200}
                  className="rounded-lg border shadow-sm object-cover max-w-full h-auto"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="flex items-center p-3 bg-gray-50 border border-gray-200 rounded-lg max-w-xs">
                <ImageIcon className="w-5 h-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600">
                  {imageError ? 'Failed to load image' : 'Loading image...'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Post Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center text-xs text-gray-500">
            <User className="w-3 h-3 mr-1" />
            {post.createdByName || 'Unknown'}
          </div>

          {/* Status Control */}
          {canUpdateStatus && post.status !== 'resolved' && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-600">Status:</span>
              <Select
                value={post.status}
                onValueChange={handleStatusUpdate}
                disabled={updating}
              >
                <SelectTrigger className="w-32 h-7 text-xs">
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
      </CardContent>
    </Card>
  )
}