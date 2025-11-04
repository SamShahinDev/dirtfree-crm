/**
 * Virtual Scrolling Components
 *
 * Uses @tanstack/react-virtual for efficient rendering of large lists.
 * Only renders visible items + overscan, dramatically improving performance
 * for lists with 1000+ items.
 *
 * Benefits:
 * - Constant rendering time regardless of list size
 * - Smooth scrolling even with 10,000+ items
 * - Reduced memory footprint
 */

'use client'

import { useRef, forwardRef, ReactNode } from 'react'
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual'

// =====================================================
// Generic Virtual List
// =====================================================

interface VirtualListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  estimateSize?: number
  overscan?: number
  height?: string | number
  className?: string
  gap?: number
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 100,
  overscan = 5,
  height = '600px',
  className = '',
  gap = 0,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    gap,
  })

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================
// Virtual Opportunity List
// =====================================================

interface Opportunity {
  id: string
  title: string
  customer_name: string
  estimated_value: number
  status: string
  created_at: string
}

interface VirtualOpportunityListProps {
  opportunities: Opportunity[]
  onOpportunityClick?: (opportunity: Opportunity) => void
}

export function VirtualOpportunityList({
  opportunities,
  onOpportunityClick,
}: VirtualOpportunityListProps) {
  return (
    <VirtualList
      items={opportunities}
      estimateSize={120}
      overscan={3}
      height="calc(100vh - 200px)"
      gap={8}
      renderItem={(opportunity, index) => (
        <div
          onClick={() => onOpportunityClick?.(opportunity)}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-900">
                {opportunity.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {opportunity.customer_name}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-green-600">
                ${opportunity.estimated_value?.toLocaleString()}
              </p>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mt-1 inline-block">
                {opportunity.status}
              </span>
            </div>
          </div>
        </div>
      )}
    />
  )
}

// =====================================================
// Virtual Customer List
// =====================================================

interface Customer {
  id: string
  full_name: string
  email: string
  phone?: string
  total_jobs?: number
  total_revenue?: number
}

interface VirtualCustomerListProps {
  customers: Customer[]
  onCustomerClick?: (customer: Customer) => void
}

export function VirtualCustomerList({
  customers,
  onCustomerClick,
}: VirtualCustomerListProps) {
  return (
    <VirtualList
      items={customers}
      estimateSize={100}
      overscan={5}
      height="calc(100vh - 200px)"
      gap={4}
      renderItem={(customer) => (
        <div
          onClick={() => onCustomerClick?.(customer)}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{customer.full_name}</h3>
              <p className="text-sm text-gray-600">{customer.email}</p>
              {customer.phone && (
                <p className="text-sm text-gray-500">{customer.phone}</p>
              )}
            </div>
            {(customer.total_jobs !== undefined || customer.total_revenue !== undefined) && (
              <div className="text-right">
                {customer.total_jobs !== undefined && (
                  <p className="text-sm text-gray-600">
                    {customer.total_jobs} jobs
                  </p>
                )}
                {customer.total_revenue !== undefined && (
                  <p className="font-semibold text-green-600">
                    ${customer.total_revenue.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    />
  )
}

// =====================================================
// Virtual Transaction List
// =====================================================

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'credit' | 'debit'
  status: string
}

interface VirtualTransactionListProps {
  transactions: Transaction[]
  onTransactionClick?: (transaction: Transaction) => void
}

export function VirtualTransactionList({
  transactions,
  onTransactionClick,
}: VirtualTransactionListProps) {
  return (
    <VirtualList
      items={transactions}
      estimateSize={80}
      overscan={10}
      height="500px"
      gap={2}
      renderItem={(transaction) => (
        <div
          onClick={() => onTransactionClick?.(transaction)}
          className="bg-white border-b border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <p className="font-medium text-gray-900">{transaction.description}</p>
              <p className="text-xs text-gray-500">{transaction.date}</p>
            </div>
            <div className="text-right">
              <p
                className={`font-semibold ${
                  transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {transaction.type === 'credit' ? '+' : '-'}$
                {transaction.amount.toLocaleString()}
              </p>
              <span className="text-xs text-gray-500">{transaction.status}</span>
            </div>
          </div>
        </div>
      )}
    />
  )
}

// =====================================================
// Virtual Message Thread
// =====================================================

interface Message {
  id: string
  sender: string
  content: string
  timestamp: string
  isFromCustomer: boolean
}

interface VirtualMessageThreadProps {
  messages: Message[]
}

export function VirtualMessageThread({ messages }: VirtualMessageThreadProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  return (
    <div
      ref={parentRef}
      className="overflow-auto bg-gray-50"
      style={{ height: '400px' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="px-4 py-2"
            >
              <div
                className={`flex ${
                  message.isFromCustomer ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`max-w-md rounded-lg px-4 py-2 ${
                    message.isFromCustomer
                      ? 'bg-white border border-gray-200'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  <p className="text-sm font-medium">{message.sender}</p>
                  <p className="text-sm mt-1">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.isFromCustomer ? 'text-gray-500' : 'text-blue-200'
                    }`}
                  >
                    {message.timestamp}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================
// Virtual Table Rows
// =====================================================

interface VirtualTableProps<T> {
  data: T[]
  columns: Array<{
    key: string
    header: string
    render: (item: T) => ReactNode
    width?: string
  }>
  onRowClick?: (item: T) => void
  rowHeight?: number
  height?: string
}

export function VirtualTable<T>({
  data,
  columns,
  onRowClick,
  rowHeight = 48,
  height = '600px',
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 flex sticky top-0 z-10">
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Virtual Rows */}
      <div ref={parentRef} className="overflow-auto" style={{ height }}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = data[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                onClick={() => onRowClick?.(item)}
                className="absolute top-0 left-0 w-full flex items-center border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${rowHeight}px`,
                }}
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className="px-4 py-2 text-sm text-gray-900"
                    style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
                  >
                    {column.render(item)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// Export All
// =====================================================

export {
  VirtualList,
  VirtualOpportunityList,
  VirtualCustomerList,
  VirtualTransactionList,
  VirtualMessageThread,
  VirtualTable,
}

export type {
  VirtualListProps,
  VirtualOpportunityListProps,
  VirtualCustomerListProps,
  VirtualTransactionListProps,
  VirtualMessageThreadProps,
  VirtualTableProps,
}
