'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useCallback, memo } from 'react'
import { cn } from '@/lib/utils'

interface VirtualListProps<T> {
  items: T[]
  height: number | string
  itemHeight: number | ((index: number) => number)
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  className?: string
  gap?: number
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void
  emptyMessage?: string | React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  overscan = 5,
  className = '',
  gap = 0,
  onScroll,
  emptyMessage = 'No items to display',
  header,
  footer
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => {
        if (typeof itemHeight === 'function') {
          return itemHeight(index)
        }
        return itemHeight
      },
      [itemHeight]
    ),
    overscan,
    gap
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  if (items.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center text-gray-500', className)}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={cn('relative overflow-auto', className)}
      style={{ height }}
      onScroll={onScroll}
    >
      {header}
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
      {footer}
    </div>
  )
}

// Memoized version for better performance
export const MemoizedVirtualList = memo(VirtualList) as typeof VirtualList

// Table-specific virtual list
interface VirtualTableProps<T> {
  items: T[]
  height: number | string
  rowHeight: number
  columns: Array<{
    key: string
    header: string | React.ReactNode
    render: (item: T) => React.ReactNode
    width?: string | number
    className?: string
  }>
  onRowClick?: (item: T, index: number) => void
  rowClassName?: (item: T, index: number) => string
  stickyHeader?: boolean
  emptyMessage?: string
}

export function VirtualTable<T extends Record<string, any>>({
  items,
  height,
  rowHeight,
  columns,
  onRowClick,
  rowClassName,
  stickyHeader = true,
  emptyMessage = 'No data available'
}: VirtualTableProps<T>) {
  const renderRow = useCallback(
    (item: T, index: number) => (
      <div
        className={cn(
          'flex border-b border-gray-200 hover:bg-gray-50 cursor-pointer',
          rowClassName?.(item, index)
        )}
        style={{ height: rowHeight }}
        onClick={() => onRowClick?.(item, index)}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className={cn('px-4 py-2 flex items-center', col.className)}
            style={{ width: col.width || `${100 / columns.length}%` }}
          >
            {col.render(item)}
          </div>
        ))}
      </div>
    ),
    [columns, onRowClick, rowClassName, rowHeight]
  )

  const header = (
    <div
      className={cn(
        'flex border-b-2 border-gray-300 bg-gray-50 font-semibold',
        stickyHeader && 'sticky top-0 z-10'
      )}
      style={{ height: rowHeight }}
    >
      {columns.map((col) => (
        <div
          key={col.key}
          className={cn('px-4 py-2 flex items-center', col.className)}
          style={{ width: col.width || `${100 / columns.length}%` }}
        >
          {col.header}
        </div>
      ))}
    </div>
  )

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {header}
      <VirtualList
        items={items}
        height={typeof height === 'number' ? height - rowHeight : `calc(${height} - ${rowHeight}px)`}
        itemHeight={rowHeight}
        renderItem={renderRow}
        emptyMessage={emptyMessage}
      />
    </div>
  )
}

// Infinite scroll wrapper
interface InfiniteVirtualListProps<T> extends Omit<VirtualListProps<T>, 'onScroll'> {
  loadMore: () => void | Promise<void>
  hasMore: boolean
  isLoading?: boolean
  threshold?: number
}

export function InfiniteVirtualList<T>({
  loadMore,
  hasMore,
  isLoading = false,
  threshold = 5,
  ...props
}: InfiniteVirtualListProps<T>) {
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget
      const scrollBottom = element.scrollHeight - element.scrollTop - element.clientHeight

      // Load more when approaching the bottom
      if (scrollBottom < threshold * (typeof props.itemHeight === 'number' ? props.itemHeight : 50) && hasMore && !isLoading) {
        loadMore()
      }
    },
    [hasMore, isLoading, loadMore, threshold, props.itemHeight]
  )

  return (
    <VirtualList
      {...props}
      onScroll={handleScroll}
      footer={
        isLoading && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )
      }
    />
  )
}