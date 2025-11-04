'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  DollarSign
} from 'lucide-react'
import { getPaymentMetrics } from '@/lib/analytics/revenue'

export function PaymentStatus() {
  const [data, setData] = useState<any>({
    metrics: {
      total: 0,
      paid: 0,
      pending: 0,
      overdue: 0,
      draft: 0
    },
    amounts: {
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      overdueAmount: 0
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const paymentData = await getPaymentMetrics()
      setData(paymentData)
    } catch (error) {
      console.error('Failed to load payment metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-50'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      case 'overdue':
        return 'text-red-600 bg-red-50'
      case 'draft':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-5 w-5" />
      case 'pending':
        return <Clock className="h-5 w-5" />
      case 'overdue':
        return <AlertCircle className="h-5 w-5" />
      case 'draft':
        return <XCircle className="h-5 w-5" />
      default:
        return <DollarSign className="h-5 w-5" />
    }
  }

  const collectionRate = data.metrics.total > 0
    ? Math.round((data.metrics.paid / data.metrics.total) * 100)
    : 0

  const overdueRate = data.metrics.total > 0
    ? Math.round((data.metrics.overdue / data.metrics.total) * 100)
    : 0

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Payment Status</h2>
        <Badge variant="secondary">This Month</Badge>
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                status: 'paid',
                label: 'Paid',
                count: data.metrics.paid,
                amount: data.amounts.paidAmount
              },
              {
                status: 'pending',
                label: 'Pending',
                count: data.metrics.pending,
                amount: data.amounts.pendingAmount
              },
              {
                status: 'overdue',
                label: 'Overdue',
                count: data.metrics.overdue,
                amount: data.amounts.overdueAmount
              },
              {
                status: 'draft',
                label: 'Draft',
                count: data.metrics.draft,
                amount: 0
              }
            ].map((item) => (
              <div
                key={item.status}
                className={`p-4 rounded-lg ${getStatusColor(item.status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  {getStatusIcon(item.status)}
                  <span className="text-2xl font-bold">{item.count}</span>
                </div>
                <p className="text-sm font-medium">{item.label}</p>
                {item.amount > 0 && (
                  <p className="text-xs mt-1">{formatCurrency(item.amount)}</p>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Collection Rate</span>
                <span className="text-2xl font-bold text-green-600">
                  {collectionRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${collectionRate}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {data.metrics.paid} of {data.metrics.total} invoices collected
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Overdue Rate</span>
                <span className={`text-2xl font-bold ${overdueRate > 10 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {overdueRate}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${overdueRate > 10 ? 'bg-red-600' : 'bg-yellow-600'}`}
                  style={{ width: `${overdueRate}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {data.metrics.overdue} invoices overdue
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <DollarSign className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Total Outstanding</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(data.amounts.pendingAmount + data.amounts.overdueAmount)}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Collected This Month</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(data.amounts.paidAmount)}
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}