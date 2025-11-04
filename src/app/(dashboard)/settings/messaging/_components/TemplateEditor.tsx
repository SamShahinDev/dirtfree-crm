'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import {
  Save,
  RotateCcw,
  Loader2,
  Eye,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

import {
  updateTemplate,
  resetTemplate,
  previewTemplate,
  type TemplateData
} from '../actions'
import type { SampleData } from './MessagingSettings'

export interface TemplateEditorProps {
  template: TemplateData
  sampleData: SampleData
  onTemplateUpdated: () => void
}

export function TemplateEditor({
  template,
  sampleData,
  onTemplateUpdated
}: TemplateEditorProps) {
  const [body, setBody] = useState(template.body)
  const [preview, setPreview] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // Update body when template changes
  useEffect(() => {
    setBody(template.body)
  }, [template.key, template.body])

  // Auto-generate preview
  useEffect(() => {
    const generatePreview = async () => {
      if (!body.trim()) {
        setPreview('')
        return
      }

      setIsPreviewLoading(true)
      try {
        const response = await previewTemplate({
          key: template.key,
          body,
          sampleData
        })

        if (response.ok && response.data) {
          setPreview(response.data.preview)
        } else {
          setPreview('Preview unavailable')
        }
      } catch (error) {
        console.error('Preview error:', error)
        setPreview('Preview error')
      } finally {
        setIsPreviewLoading(false)
      }
    }

    const timeoutId = setTimeout(generatePreview, 300)
    return () => clearTimeout(timeoutId)
  }, [body, sampleData, template.key])

  const handleSave = () => {
    startTransition(async () => {
      try {
        const response = await updateTemplate({
          key: template.key,
          body: body.trim()
        })

        if (response.ok) {
          toast.success('Template updated successfully')
          onTemplateUpdated()
        } else {
          toast.error(response.error || 'Failed to update template')
        }
      } catch (error) {
        console.error('Update error:', error)
        toast.error('Failed to update template')
      }
    })
  }

  const handleReset = () => {
    startTransition(async () => {
      try {
        const response = await resetTemplate({
          key: template.key
        })

        if (response.ok) {
          toast.success('Template reset to default')
          onTemplateUpdated()
        } else {
          toast.error(response.error || 'Failed to reset template')
        }
      } catch (error) {
        console.error('Reset error:', error)
        toast.error('Failed to reset template')
      }
    })
  }

  const hasChanges = body.trim() !== template.body
  const characterCount = body.length
  const isValid = characterCount <= 320 &&
                  body.toLowerCase().includes('reply stop to opt out') &&
                  !/[^\x20-\x7E\s]/.test(body)

  const getCharacterCountColor = () => {
    if (characterCount > 320) return 'text-red-600'
    if (characterCount > 280) return 'text-orange-600'
    return 'text-muted-foreground'
  }

  return (
    <div className="space-y-4">
      {/* Editor */}
      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base flex items-center justify-between">
            Template Editor
            <Badge
              variant={characterCount > 320 ? 'destructive' : 'outline'}
              className={getCharacterCountColor()}
            >
              {characterCount}/320
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-3">
            <Label htmlFor={`editor-${template.key}`}>Message Content</Label>
            <Textarea
              id={`editor-${template.key}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter your SMS template..."
              className="min-h-[120px] font-mono text-sm"
              disabled={isPending}
            />

            {/* Validation Indicators */}
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1">
                {characterCount <= 320 ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-600" />
                )}
                <span>Length OK</span>
              </div>

              <div className="flex items-center gap-1">
                {body.toLowerCase().includes('reply stop to opt out') ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-600" />
                )}
                <span>Opt-out included</span>
              </div>

              <div className="flex items-center gap-1">
                {!/[^\x20-\x7E\s]/.test(body) ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-600" />
                )}
                <span>Plain text only</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="rounded-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 min-h-[80px] border">
            {isPreviewLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Generating preview...</span>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {preview || 'Enter template content to see preview...'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Default Template Reference */}
      {template.isOverridden && template.defaultBody && (
        <Card className="rounded-lg border-dashed">
          <CardHeader className="p-4">
            <CardTitle className="text-base text-muted-foreground">
              Default Template
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              {template.defaultBody}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isPending || !hasChanges || !isValid}
          className="gap-2"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          Save Changes
        </Button>

        {template.isOverridden && (
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isPending}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <RotateCcw className="h-4 w-4" />
            Restore Default
          </Button>
        )}

        {!isValid && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Fix validation errors to save</span>
          </div>
        )}
      </div>
    </div>
  )
}