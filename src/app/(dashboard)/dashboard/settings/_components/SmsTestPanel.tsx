'use client'

import { useState, useTransition, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Loader2, Send, Shield } from 'lucide-react'

import { Templates, type TemplateKey } from '@/app/(comms)/templates'

const SmsTestSchema = z.object({
  to: z.string().min(1, 'Phone number is required'),
  templateKey: z.string().optional(),
  ctx: z.string().optional(),
  customMessage: z.string().optional()
}).refine(
  (data) => data.templateKey || data.customMessage,
  {
    message: 'Either select a template or enter a custom message',
    path: ['customMessage']
  }
)

type SmsTestForm = z.infer<typeof SmsTestSchema>

export function SmsTestPanel() {
  const [isPending, startTransition] = useTransition()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [previewMessage, setPreviewMessage] = useState<string>('')

  const form = useForm<SmsTestForm>({
    resolver: zodResolver(SmsTestSchema),
    defaultValues: {
      to: '',
      templateKey: '',
      ctx: '{}',
      customMessage: ''
    }
  })

  // For now, assume access is granted - RBAC is enforced on the API level
  useEffect(() => {
    setHasAccess(true)
  }, [])

  const watchedValues = form.watch()

  // Update preview when form values change
  useEffect(() => {
    if (watchedValues.templateKey && watchedValues.templateKey in Templates) {
      try {
        const ctx = watchedValues.ctx ? JSON.parse(watchedValues.ctx) : {}
        const template = Templates[watchedValues.templateKey as TemplateKey]
        setPreviewMessage(template(ctx))
      } catch {
        setPreviewMessage('Invalid JSON context')
      }
    } else if (watchedValues.customMessage) {
      setPreviewMessage(watchedValues.customMessage)
    } else {
      setPreviewMessage('')
    }
  }, [watchedValues.templateKey, watchedValues.ctx, watchedValues.customMessage])

  const handleSubmit = (data: SmsTestForm) => {
    startTransition(async () => {
      try {
        const requestBody: Record<string, unknown> = {
          to: data.to
        }

        if (data.templateKey) {
          requestBody.templateKey = data.templateKey
          if (data.ctx) {
            try {
              requestBody.ctx = JSON.parse(data.ctx)
            } catch {
              toast.error('Invalid JSON in context field')
              return
            }
          }
        } else if (data.customMessage) {
          requestBody.body = data.customMessage
        }

        const response = await fetch('/api/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        const result = await response.json()

        if (result.ok) {
          toast.success(`SMS sent successfully! SID: ${result.sid}`)
          form.reset()
        } else {
          toast.error(`Failed to send SMS: ${result.error}`)
        }
      } catch (error) {
        console.error('SMS test error:', error)
        toast.error('Failed to send test SMS')
      }
    })
  }

  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">
          Checking permissions...
        </span>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Dispatcher+ role required to send test SMS messages
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Phone Number */}
          <FormField
            control={form.control}
            name="to"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To Phone Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="(555) 123-4567 or +15551234567"
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormDescription>
                  Enter a phone number to receive the test message
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Template Selection */}
          <FormField
            control={form.control}
            name="templateKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message Template (Optional)</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === 'custom' ? '' : value)}
                  value={field.value || 'custom'}
                  disabled={isPending}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="custom">Custom Message</SelectItem>
                    {Object.keys(Templates).map((key) => (
                      <SelectItem key={key} value={key}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose a template or leave blank to send a custom message
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Template Context */}
          {watchedValues.templateKey && (
            <FormField
              control={form.control}
              name="ctx"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Context (JSON)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='{"customerName": "John Doe", "jobDate": "2024-01-15", "arrivalWindow": "1-3 PM", "company": "Dirt Free Carpet"}'
                      className="min-h-[80px]"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    JSON object with template variables (customerName, jobDate, arrivalWindow, company)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Custom Message */}
          {!watchedValues.templateKey && (
            <FormField
              control={form.control}
              name="customMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter your custom message here..."
                      className="min-h-[80px]"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Custom message to send (max 800 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Message Preview */}
          {previewMessage && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Message Preview:</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {previewMessage}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Character count: {previewMessage.length}
              </p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isPending || !previewMessage}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4" />
            {isPending ? 'Sending...' : 'Send Test SMS'}
          </Button>
        </form>
      </Form>

      {/* Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Messages sent via this tool will appear in communication logs</p>
        <p>• Opt-out rules and rate limiting apply to test messages</p>
        <p>• Use only for testing with valid phone numbers you own</p>
      </div>
    </div>
  )
}