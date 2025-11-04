/**
 * Invoice Payment History Component
 * Displays payment attempts and history for an invoice
 */

'use client'

import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CreditCardIcon,
} from 'lucide-react'
import { formatCurrency } from '@/types/invoice'

// =============================================================================
// TYPES
// =============================================================================

interface Payment {
  id: string
  provider: string
  provider_ref: string
  amount_cents: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'canceled'
  provider_data?: {
    event_type?: string
    failure_reason?: string
    payment_method?: string[]
  }
  processed_at?: string | null
  created_at: string
}

interface InvoicePaymentHistoryProps {
  payments: Payment[]
}

// =============================================================================
// COMPONENT
// =============================================================================

export function InvoicePaymentHistory({ payments }: InvoicePaymentHistoryProps) {
  if (!payments.length) {
    return null
  }

  const getStatusIcon = (status: Payment['status']) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircleIcon className="h-4 w-4 text-red-600" />
      case 'pending':
        return <ClockIcon className="h-4 w-4 text-yellow-600" />
      case 'canceled':
        return <XCircleIcon className="h-4 w-4 text-gray-600" />
      default:
        return <CreditCardIcon className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'canceled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusLabel = (status: Payment['status']) => {
    switch (status) {
      case 'succeeded':
        return 'Succeeded'
      case 'failed':
        return 'Failed'
      case 'pending':
        return 'Pending'
      case 'canceled':
        return 'Canceled'
      default:
        return status
    }
  }

  const getProviderDisplayName = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'stripe':
        return 'Stripe'
      case 'paypal':
        return 'PayPal'
      case 'square':
        return 'Square'
      default:
        return provider
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>
          {payments.length} payment attempt{payments.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-start justify-between p-4 border rounded-lg"
            >
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {getStatusIcon(payment.status)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge
                      variant="outline"
                      className={getStatusColor(payment.status)}
                    >
                      {getStatusLabel(payment.status)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      via {getProviderDisplayName(payment.provider)}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {format(new Date(payment.created_at), 'MMM d, yyyy h:mm a')}
                    {payment.processed_at && payment.processed_at !== payment.created_at && (
                      <span className="ml-2">
                        (processed {format(new Date(payment.processed_at), 'h:mm a')})
                      </span>
                    )}
                  </p>

                  {/* Payment method info */}
                  {payment.provider_data?.payment_method && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Payment methods: {payment.provider_data.payment_method.join(', ')}
                    </p>
                  )}

                  {/* Failure reason */}
                  {payment.status === 'failed' && payment.provider_data?.failure_reason && (
                    <p className="text-xs text-red-600 mt-1">
                      {payment.provider_data.failure_reason}
                    </p>
                  )}

                  {/* Reference ID */}
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    Ref: {payment.provider_ref}
                  </p>
                </div>
              </div>

              <div className="text-right ml-4">
                <p className="font-semibold">
                  {formatCurrency(payment.amount_cents)}
                </p>
                <p className="text-xs text-muted-foreground uppercase">
                  {payment.currency}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}