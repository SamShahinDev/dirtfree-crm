'use client'

import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CsvButtonProps {
  reportType: 'jobs-by-status' | 'jobs-by-technician' | 'upcoming-reminders'
  filters: Record<string, any>
  disabled?: boolean
  className?: string
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
}

export function CsvButton({
  reportType,
  filters,
  disabled = false,
  className = '',
  size = 'default',
  variant = 'outline'
}: CsvButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const getReportDisplayName = () => {
    switch (reportType) {
      case 'jobs-by-status':
        return 'Jobs by Status'
      case 'jobs-by-technician':
        return 'Jobs by Technician'
      case 'upcoming-reminders':
        return 'Upcoming Reminders'
      default:
        return 'Report'
    }
  }

  const generateFilename = () => {
    const reportName = reportType.replace(/-/g, '_')
    const timestamp = format(new Date(), 'yyyy-MM-dd')
    return `${reportName}_${timestamp}.csv`
  }

  const buildQueryString = () => {
    const params = new URLSearchParams()

    // Add all filters to query string
    Object.entries(filters).forEach(([key, value]) => {
      if (value != null && value !== '' && value !== undefined) {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(','))
          }
        } else {
          params.set(key, String(value))
        }
      }
    })

    return params.toString()
  }

  const handleDownload = async () => {
    if (isDownloading || disabled) return

    setIsDownloading(true)

    try {
      const queryString = buildQueryString()
      const url = `/api/reports/${reportType}?${queryString}`

      // Create a temporary link and trigger download
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `HTTP ${response.status}`)
      }

      // Get the CSV content
      const csvContent = await response.blob()

      // Create download link
      const downloadUrl = window.URL.createObjectURL(csvContent)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = generateFilename()

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      window.URL.revokeObjectURL(downloadUrl)

      toast.success(`${getReportDisplayName()} exported successfully`)

    } catch (error) {
      console.error('CSV download error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to download CSV'

      if (errorMessage.includes('unauthorized') || errorMessage.includes('403')) {
        toast.error('You do not have permission to download this report')
      } else if (errorMessage.includes('400')) {
        toast.error('Invalid report parameters. Please check your filters.')
      } else {
        toast.error(`Failed to download CSV: ${errorMessage}`)
      }
    } finally {
      setIsDownloading(false)
    }
  }

  const getButtonContent = () => {
    if (isDownloading) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="ml-2">Exporting...</span>
        </>
      )
    }

    return (
      <>
        <Download className="w-4 h-4" />
        <span className="ml-2">Export CSV</span>
      </>
    )
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={disabled || isDownloading}
      variant={variant}
      size={size}
      className={cn('flex items-center', className)}
      title={`Export ${getReportDisplayName()} as CSV`}
    >
      {getButtonContent()}
    </Button>
  )
}

// Compact CSV button for toolbar use
export function CompactCsvButton({
  reportType,
  filters,
  disabled = false,
  className = ''
}: Pick<CsvButtonProps, 'reportType' | 'filters' | 'disabled' | 'className'>) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (isDownloading || disabled) return

    setIsDownloading(true)

    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value != null && value !== '' && value !== undefined) {
          if (Array.isArray(value)) {
            if (value.length > 0) {
              params.set(key, value.join(','))
            }
          } else {
            params.set(key, String(value))
          }
        }
      })

      const url = `/api/reports/${reportType}?${params.toString()}`
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/csv' },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const csvContent = await response.blob()
      const downloadUrl = window.URL.createObjectURL(csvContent)
      const link = document.createElement('a')

      link.href = downloadUrl
      link.download = `${reportType.replace(/-/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      toast.success('CSV exported successfully')

    } catch (error) {
      console.error('CSV download error:', error)
      toast.error('Failed to download CSV')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={disabled || isDownloading}
      variant="ghost"
      size="sm"
      className={cn('h-8 w-8 p-0', className)}
      title="Export as CSV"
    >
      {isDownloading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileText className="w-4 h-4" />
      )}
    </Button>
  )
}

// Utility to validate filters before CSV download
export const validateFiltersForCsv = (
  reportType: string,
  filters: Record<string, any>
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  switch (reportType) {
    case 'jobs-by-status':
    case 'jobs-by-technician':
      if (!filters.from || !filters.to) {
        errors.push('Date range (from and to dates) is required')
      }
      if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
        errors.push('From date must be before or equal to to date')
      }
      break

    case 'upcoming-reminders':
      if (!filters.horizonDays || filters.horizonDays < 1) {
        errors.push('Valid horizon days is required')
      }
      break

    default:
      errors.push('Unknown report type')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}