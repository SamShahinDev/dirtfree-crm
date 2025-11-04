/**
 * Invoices Header Component
 * Displays invoice statistics and overview information
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/types/invoice'

// =============================================================================
// TYPES
// =============================================================================

interface InvoiceStats {
  totalCount: number
  totalValue: number
  draftCount: number
  sentCount: number
  paidCount: number
  voidCount: number
  paidValue: number
}

interface InvoicesHeaderProps {
  stats: InvoiceStats
}

// =============================================================================
// COMPONENTS
// =============================================================================

function StatCard({
  title,
  value,
  subtitle,
  color = 'blue',
}: {
  title: string
  value: string | number
  subtitle?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
  }

  const accentColors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
  }

  return (
    <Card className={`border-2 ${colorClasses[color]}`}>
      <CardContent className="p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className={`text-2xl font-bold ${accentColors[color]}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs opacity-70">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InvoicesHeader({ stats }: InvoicesHeaderProps) {
  const paidPercentage = stats.totalCount > 0
    ? Math.round((stats.paidCount / stats.totalCount) * 100)
    : 0

  const averageInvoiceValue = stats.totalCount > 0
    ? Math.round(stats.totalValue / stats.totalCount)
    : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Invoices"
        value={stats.totalCount.toLocaleString()}
        subtitle={`${formatCurrency(averageInvoiceValue)} average`}
        color="blue"
      />

      <StatCard
        title="Total Value"
        value={formatCurrency(stats.totalValue)}
        subtitle={`${stats.totalCount} invoice${stats.totalCount !== 1 ? 's' : ''}`}
        color="blue"
      />

      <StatCard
        title="Paid Invoices"
        value={stats.paidCount.toLocaleString()}
        subtitle={`${formatCurrency(stats.paidValue)} collected (${paidPercentage}%)`}
        color="green"
      />

      <StatCard
        title="Outstanding"
        value={(stats.sentCount + stats.draftCount).toLocaleString()}
        subtitle={`${stats.sentCount} sent, ${stats.draftCount} draft`}
        color="yellow"
      />
    </div>
  )
}