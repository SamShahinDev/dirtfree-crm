'use client'

import { useState } from 'react'
import { Send, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { createThread } from '../actions'
import type { UploadResult } from '@/lib/hooks/use-file-upload'

interface NewThreadDialogProps {
  truckId: string
  onSuccess: (threadId: string) => void
  onCancel: () => void
}

type PostKind = 'need' | 'issue' | 'note' | 'update'

export function NewThreadDialog({ truckId, onSuccess, onCancel }: NewThreadDialogProps) {
  const [title, setTitle] = useState('')
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
    console.log('[NewThreadDialog] Starting submission...')

    if (!title.trim()) {
      toast.error('Please enter a thread title')
      return
    }

    if (!body.trim()) {
      toast.error('Please enter a message')
      return
    }

    setSubmitting(true)

    try {
      const formData = {
        truckId,
        title: title.trim(),
        firstPost: {
          kind,
          body: body.trim(),
          urgent: urgent && (kind === 'need' || kind === 'issue'),
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined
        }
      }

      console.log('[NewThreadDialog] Form data prepared:', formData)
      console.log('[NewThreadDialog] Truck ID:', truckId)
      console.log('[NewThreadDialog] User inputs:', {
        title: title.trim(),
        kind,
        body: body.trim(),
        urgent,
        imageUrlsCount: imageUrls.length
      })

      console.log('[NewThreadDialog] Calling createThread...')
      const result = await createThread(formData)

      console.log('[NewThreadDialog] Server response received:', {
        success: result.success,
        hasData: !!result.data,
        hasError: !!result.error,
        result
      })

      if (result.success && result.data) {
        console.log('[NewThreadDialog] Success! Thread created:', result.data)
        toast.success('Thread created successfully!')
        onSuccess(result.data.threadId)
      } else {
        console.error('[NewThreadDialog] Server returned error:', result.error)
        const errorMessage = result.error || 'Failed to create thread'
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('[NewThreadDialog] Caught exception:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error(`Failed to create thread: ${errorMessage}`)
    } finally {
      console.log('[NewThreadDialog] Submission complete, setting submitting to false')
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
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Thread Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Thread Title
          </Label>
          <Input
            id="title"
            placeholder="What's this thread about?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full"
          />
          <div className="text-xs text-gray-500 text-right">
            {title.length}/200 characters
          </div>
        </div>

        {/* Post Kind */}
        <div className="space-y-2">
          <Label htmlFor="kind" className="block text-sm font-medium text-gray-700">
            First Post Type
          </Label>
          <Select value={kind} onValueChange={(value: PostKind) => setKind(value)}>
            <SelectTrigger className="w-full">
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
          <Label htmlFor="body" className="block text-sm font-medium text-gray-700">
            Message
          </Label>
          <Textarea
            id="body"
            placeholder={`Write your ${kind}...`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={2000}
            className="resize-none w-full"
          />
          <div className="text-xs text-gray-500 text-right">
            {body.length}/2000 characters
          </div>
        </div>

        {/* Photo Upload */}
        <div className="space-y-2">
          <Label className="block text-sm font-medium text-gray-700">
            Attach Photos (optional)
          </Label>
          <div className="text-xs text-gray-500 mb-2">
            Upload up to 3 photos to help document the issue or situation
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

        {/* Actions */}
        <div className="flex justify-end items-center pt-6 border-t border-gray-200">
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Create Thread
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}