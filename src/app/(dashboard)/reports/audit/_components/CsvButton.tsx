'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { log, createComponentContext } from '@/lib/obs/log'
import type { AuditFilters } from './AuditLogExplorer'

interface CsvButtonProps {
  filters: AuditFilters
}

export function CsvButton({ filters }: CsvButtonProps) {
  const [downloading, setDownloading] = useState(false)
  const logger = log.child(createComponentContext('CsvButton'))

  const handleDownload = async () => {
    setDownloading(true)

    try {
      logger.info('Starting audit CSV download', { filters })

      // Build query parameters
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value))
        }
      })

      // Remove pagination for CSV export (we want all results)
      params.delete('page')
      params.delete('size')

      const url = `/api/reports/audit?${params.toString()}`

      // Create a temporary link to trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = '' // Let the server set the filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      logger.info('Audit CSV download initiated', { url })
    } catch (error) {
      logger.error('Failed to download audit CSV', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={downloading}
      variant="outline"
      className="gap-2"
    >
      {downloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export CSV
    </Button>
  )
}