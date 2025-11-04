'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Shield, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

import { reauthSchema, type ReauthForm } from '@/lib/auth/schemas'
import { reauthenticate } from '@/app/(auth)/actions'

interface StepUpDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  title?: string
  description?: string
}

export function StepUpDialog({
  open,
  onClose,
  onSuccess,
  title = 'Confirm your identity',
  description = 'This action requires recent authentication. Please enter your password to continue.',
}: StepUpDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ReauthForm>({
    resolver: zodResolver(reauthSchema),
    defaultValues: {
      password: '',
    },
  })

  async function onSubmit(data: ReauthForm) {
    setIsLoading(true)

    try {
      const result = await reauthenticate(data.password)

      if (result.success) {
        toast.success('Authentication confirmed')
        form.reset()
        onSuccess()
        onClose()
      } else {
        toast.error(result.error || 'Invalid password')
        form.setError('password', {
          message: result.error || 'Invalid password',
        })
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
      console.error('Step-up authentication error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function handleClose() {
    if (!isLoading) {
      form.reset()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => isLoading && e.preventDefault()}
        onEscapeKeyDown={(e) => isLoading && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            {title}
          </DialogTitle>
          <DialogDescription className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <span>{description}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your current password"
                      autoComplete="current-password"
                      autoFocus
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage aria-live="polite" />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Verifying...' : 'Confirm'}
              </Button>
            </div>
          </form>
        </Form>

        <div className="text-xs text-muted-foreground mt-4">
          <p>
            For your security, sensitive actions require recent authentication.
            Your session will be valid for 10 minutes after confirmation.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook for managing step-up dialog state
export function useStepUpDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [resolvePromise, setResolvePromise] = useState<((success: boolean) => void) | null>(null)

  const showStepUpDialog = (): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolvePromise(() => resolve)
      setIsOpen(true)
    })
  }

  const handleSuccess = () => {
    if (resolvePromise) {
      resolvePromise(true)
      setResolvePromise(null)
    }
  }

  const handleClose = () => {
    if (resolvePromise) {
      resolvePromise(false)
      setResolvePromise(null)
    }
    setIsOpen(false)
  }

  return {
    isOpen,
    showStepUpDialog,
    handleSuccess,
    handleClose,
  }
}