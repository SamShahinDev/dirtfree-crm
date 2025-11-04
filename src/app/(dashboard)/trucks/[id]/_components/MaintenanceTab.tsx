'use client'

import { useState, useEffect } from 'react'
import { Calendar, FileText, Upload, Download, Clock, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useUpload } from '@/lib/storage/useUpload'
import { listObjects } from '@/lib/storage'
import { formatMaintenanceDate, formatDate } from '@/lib/trucks/format'
import type { MaintenanceRecord } from '@/types/truck'

interface MaintenanceTabProps {
  truckId: string
  canManage: boolean
}

interface MaintenanceDocument {
  name: string
  key: string
  createdAt: string
  size?: number
}

export function MaintenanceTab({ truckId, canManage }: MaintenanceTabProps) {
  const [uploading, setUploading] = useState(false)
  const [documents, setDocuments] = useState<MaintenanceDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const { upload } = useUpload()

  // Placeholder maintenance records (in production, these would come from the database)
  const maintenanceRecords: MaintenanceRecord[] = [
    {
      id: '1',
      truckId,
      date: '2024-01-15',
      type: 'scheduled',
      description: 'Oil change and filter replacement',
      cost: 125.50,
      documentKey: null,
      createdAt: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      truckId,
      date: '2023-11-20',
      type: 'inspection',
      description: 'Annual safety inspection',
      cost: 75.00,
      documentKey: null,
      createdAt: '2023-11-20T14:30:00Z'
    },
    {
      id: '3',
      truckId,
      date: '2023-09-05',
      type: 'emergency',
      description: 'Brake pad replacement',
      cost: 350.00,
      documentKey: null,
      createdAt: '2023-09-05T16:45:00Z'
    }
  ]

  // Load existing maintenance documents
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch(`/api/storage/list?prefix=maintenance/${truckId}/`)
        if (response.ok) {
          const data = await response.json()
          setDocuments(data.files || [])
        }
      } catch (error) {
        console.error('Error loading documents:', error)
      } finally {
        setLoadingDocs(false)
      }
    }

    loadDocuments()
  }, [truckId])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setUploading(true)

    try {
      const result = await upload({
        file,
        kind: 'maintenance',
        entityId: truckId
      })

      toast.success('Maintenance document uploaded successfully')

      // Add to documents list
      setDocuments(prev => [
        ...prev,
        {
          name: file.name,
          key: result.key,
          createdAt: new Date().toISOString(),
          size: file.size
        }
      ])

      // Clear the input
      event.target.value = ''
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const getSignedUrl = async (key: string, filename: string) => {
    try {
      const response = await fetch(`/api/uploads/sign?key=${encodeURIComponent(key)}&ttl=300`)
      const data = await response.json()

      if (data.ok && data.url) {
        // Open in new tab
        window.open(data.url, '_blank')
      } else {
        toast.error('Failed to generate download link')
      }
    } catch (error) {
      toast.error('Failed to get document')
    }
  }

  const getMaintenanceTypeBadge = (type: MaintenanceRecord['type']) => {
    switch (type) {
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>
      case 'emergency':
        return <Badge className="bg-red-100 text-red-800">Emergency</Badge>
      case 'inspection':
        return <Badge className="bg-purple-100 text-purple-800">Inspection</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Next Maintenance */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Maintenance Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Next Scheduled Maintenance</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatMaintenanceDate('2024-03-15')}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
            </div>

            {canManage && (
              <Button variant="outline" className="w-full relative z-10 cursor-pointer" disabled>
                Schedule Maintenance
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Maintenance History */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Maintenance History</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {maintenanceRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell>{getMaintenanceTypeBadge(record.type)}</TableCell>
                    <TableCell>{record.description}</TableCell>
                    <TableCell className="text-right">
                      {record.cost ? (
                        <span className="font-medium">${record.cost.toFixed(2)}</span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No maintenance records found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Documents */}
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Maintenance Documents
            </CardTitle>
            {canManage && (
              <div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="maintenance-upload"
                />
                <label htmlFor="maintenance-upload">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    asChild
                    className="relative z-10"
                  >
                    <span className="cursor-pointer relative z-10">
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload PDF'}
                    </span>
                  </Button>
                </label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingDocs ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div
                  key={doc.key || index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{doc.name}</p>
                      <p className="text-xs text-gray-500">
                        Uploaded {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => getSignedUrl(doc.key, doc.name)}
                    aria-label={`Download ${doc.name}`}
                    className="relative z-10 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No maintenance documents uploaded</p>
              {canManage && (
                <p className="text-sm text-gray-400 mt-1">
                  Upload PDFs of service records, invoices, and reports
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}