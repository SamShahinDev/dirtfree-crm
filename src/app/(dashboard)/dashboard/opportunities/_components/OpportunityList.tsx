/**
 * Opportunity List Component
 * Server Component that renders a table of opportunities
 */

import { VirtualTable } from '@/components/VirtualList'

interface Opportunity {
  id: string
  title: string
  status: string
  estimated_value: number
  created_at: string
  customers?: {
    id: string
    full_name: string
    email: string
    phone?: string
  }
}

interface OpportunityListProps {
  opportunities: Opportunity[]
}

export function OpportunityList({ opportunities }: OpportunityListProps) {
  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    qualified: 'bg-purple-100 text-purple-800',
    proposal: 'bg-yellow-100 text-yellow-800',
    negotiation: 'bg-orange-100 text-orange-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800',
  }

  const columns = [
    {
      key: 'title',
      header: 'Opportunity',
      width: '300px',
      render: (opp: Opportunity) => (
        <div>
          <div className="font-semibold text-gray-900">{opp.title}</div>
          <div className="text-sm text-gray-500">
            {opp.customers?.full_name || 'No customer'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      render: (opp: Opportunity) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            statusColors[opp.status] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {opp.status.charAt(0).toUpperCase() + opp.status.slice(1)}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Estimated Value',
      width: '150px',
      render: (opp: Opportunity) => (
        <div className="font-semibold text-green-600">
          ${opp.estimated_value?.toLocaleString() || '0'}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      width: '200px',
      render: (opp: Opportunity) => (
        <div className="text-sm">
          {opp.customers?.email && (
            <div className="text-gray-600">{opp.customers.email}</div>
          )}
          {opp.customers?.phone && (
            <div className="text-gray-500">{opp.customers.phone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      width: '150px',
      render: (opp: Opportunity) => (
        <div className="text-sm text-gray-600">
          {new Date(opp.created_at).toLocaleDateString()}
        </div>
      ),
    },
  ]

  if (opportunities.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="text-gray-400 mb-2">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          No opportunities found
        </h3>
        <p className="text-gray-500">
          Get started by creating your first opportunity.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <VirtualTable
        data={opportunities}
        columns={columns}
        onRowClick={(opp) => {
          console.log('Clicked opportunity:', opp.id)
          // Navigate to opportunity detail page
        }}
        rowHeight={72}
        height="calc(100vh - 450px)"
      />
    </div>
  )
}
