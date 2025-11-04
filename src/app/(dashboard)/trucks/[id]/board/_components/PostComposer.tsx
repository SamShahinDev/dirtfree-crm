'use client'

import { useState } from 'react'
import { Send, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileUpload } from '@/components/ui/file-upload'
import { STORAGE_BUCKETS } from '@/lib/storage/utils'
import { createPost } from '../actions'
import type { UploadResult } from '@/lib/hooks/use-file-upload'

interface PostComposerProps {
  threadId: string
  onPostCreated: () => void
}

type PostKind = 'need' | 'issue' | 'note' | 'update'

export function PostComposer({ threadId, onPostCreated }: PostComposerProps) {
  const [kind, setKind] = useState<PostKind>('note')
  const [body, setBody] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Handle photo upload completion
  const handleUploadComplete = (result: UploadResult) => {
    if (result.success && result.url) {
      setImageUrls(prev => [...prev, result.url!])
      toast.success('Photo uploaded successfully')
    }
  }

  // Handle photo upload error
  const handleUploadError = (error: string) => {
    toast.error(`Upload failed: ${error}`)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!body.trim()) {
      toast.error('Please enter a message')
      return
    }

    setSubmitting(true)

    try {
      const result = await createPost({
        threadId,
        kind,
        body: body.trim(),
        urgent: urgent && (kind === 'need' || kind === 'issue'),
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined
      })

      if (result.success) {
        // Reset form
        setBody('')
        setKind('note')
        setUrgent(false)
        setImageUrls([])

        toast.success('Post created successfully')
        onPostCreated()
      } else {
        toast.error(result.error || 'Failed to create post')
      }
    } catch (error) {
      console.error('Error creating post:', error)
      toast.error('An error occurred while creating the post')
    } finally {
      setSubmitting(false)
    }
  }

  const getKindDescription = (kind: PostKind) => {
    switch (kind) {
      case 'need':
        return 'Request help or resources'
      case 'issue':
        return 'Report a problem or concern'
      case 'note':
        return 'Share information or observations'
      case 'update':
        return 'Provide status or progress update'
    }
  }

  const canBeUrgent = kind === 'need' || kind === 'issue'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Post Kind */}
      <div className="space-y-2">
        <Label htmlFor="kind">Post Type</Label>
        <Select value={kind} onValueChange={(value: PostKind) => setKind(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="need">Need - {getKindDescription('need')}</SelectItem>
            <SelectItem value="issue">Issue - {getKindDescription('issue')}</SelectItem>
            <SelectItem value="note">Note - {getKindDescription('note')}</SelectItem>
            <SelectItem value="update">Update - {getKindDescription('update')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Message Body */}
      <div className="space-y-2">
        <Label htmlFor="body">Message</Label>
        <Textarea
          id="body"
          placeholder={`Write your ${kind}...`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          className="resize-none"
        />
        <div className="text-xs text-gray-500 text-right">
          {body.length}/2000 characters
        </div>
      </div>

      {/* Photo Upload */}
      <div className="space-y-2">
        <Label>Attach Photos (optional)</Label>
        <div className="text-xs text-gray-500 mb-2">
          Upload up to 3 photos to document the issue or update
        </div>
        <FileUpload
          bucket={STORAGE_BUCKETS.VEHICLE_PHOTOS}
          accept="images"
          maxFiles={3}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
        />
        {imageUrls.length > 0 && (
          <div className="text-xs text-green-600">
            {imageUrls.length} photo{imageUrls.length === 1 ? '' : 's'} uploaded
          </div>
        )}
      </div>

      {/* Urgent Checkbox (only for needs/issues) */}
      {canBeUrgent && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="urgent"
            checked={urgent}
            onCheckedChange={(checked) => setUrgent(!!checked)}
          />
          <Label
            htmlFor="urgent"
            className="text-sm font-medium flex items-center cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 mr-1 text-orange-500" />
            Mark as urgent (creates reminder)
          </Label>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={submitting || !body.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Posting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Post {kind}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}