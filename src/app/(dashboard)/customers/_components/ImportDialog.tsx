'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import Papa from 'papaparse'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: () => void
}

interface ParsedData {
  data: any[]
  errors: Papa.ParseError[]
  meta: Papa.ParseMeta
}

interface ImportResult {
  imported: number
  skipped: number
  errors: number
  details: string[]
}

const EXPECTED_HEADERS = [
  'Name',
  'Email',
  'Phone',
  'Address Line 1',
  'Address Line 2',
  'City',
  'State',
  'Postal Code',
  'Zone',
  'Notes'
]

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file')
      return
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setFile(selectedFile)
    parseCSV(selectedFile)
  }

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedData(results)

        // Validate headers
        const headers = results.meta.fields || []
        const missingHeaders = EXPECTED_HEADERS.filter(h =>
          h === 'Name' ? !headers.some(header => header.toLowerCase().includes('name')) :
          !headers.includes(h)
        )

        if (missingHeaders.length > 0 && !headers.includes('Name')) {
          toast.error('CSV must contain at least a "Name" column')
        } else if (results.data.length === 0) {
          toast.error('CSV file is empty')
        } else {
          toast.success(`Parsed ${results.data.length} rows`)
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error)
        toast.error('Failed to parse CSV file')
      }
    })
  }

  const handleImport = async () => {
    if (!parsedData || !file) return

    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/customers/import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        // Read the error message from the API response
        let errorMessage = 'Import failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If response isn't JSON, use status text
          errorMessage = `Import failed: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      setImportResult(result)

      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} customers`)
        onImportComplete()
      } else {
        toast.warning('No customers were imported')
      }
    } catch (error) {
      console.error('Import error:', error)

      // Display specific error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to import customers'

      // Provide helpful context for common errors
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('authentication required')) {
        toast.error('Authentication required. Please log in and try again.')
      } else if (errorMessage.includes('Forbidden') || errorMessage.includes('role required')) {
        toast.error('You do not have permission to import customers. Contact your administrator.')

        // Set a local state to show permission error in the UI
        setImportResult({
          imported: 0,
          skipped: 0,
          errors: 1,
          details: [
            'Permission denied: Only admin and dispatcher roles can import customers.',
            'Your current role does not have permission to perform bulk imports.',
            'Please contact your system administrator if you need access.'
          ]
        })
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setParsedData(null)
    setImportResult(null)
    setImporting(false)
    onOpenChange(false)
  }

  const previewData = parsedData?.data.slice(0, 5) || []
  const headers = parsedData?.meta.fields || []

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Customers</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import customer data. Required column: Name
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Area */}
          {!file && (
            <Card
              className={`border-2 border-dashed transition-colors cursor-pointer ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Choose a CSV file or drag it here</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Supports CSV files up to 5MB
                </p>
                <Button variant="outline">
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </CardContent>
            </Card>
          )}

          {/* File Selected */}
          {file && !importResult && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <h3 className="font-semibold">{file.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null)
                      setParsedData(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {parsedData && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {parsedData.data.length} rows
                      </Badge>
                      <Badge variant="secondary">
                        {headers.length} columns
                      </Badge>
                      {parsedData.errors.length > 0 && (
                        <Badge variant="destructive">
                          {parsedData.errors.length} parsing errors
                        </Badge>
                      )}
                    </div>

                    {/* Column Mapping Info */}
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium mb-2">Detected columns:</p>
                      <div className="flex flex-wrap gap-1">
                        {headers.map((header, index) => (
                          <Badge key={index} variant="outline">
                            {header}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Preview Table */}
                    {previewData.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Preview (first 5 rows):</h4>
                        <div className="border rounded-md overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {headers.slice(0, 6).map((header) => (
                                  <TableHead key={header} className="whitespace-nowrap">
                                    {header}
                                  </TableHead>
                                ))}
                                {headers.length > 6 && (
                                  <TableHead>+ {headers.length - 6} more</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewData.map((row, index) => (
                                <TableRow key={index}>
                                  {headers.slice(0, 6).map((header) => (
                                    <TableCell key={header} className="whitespace-nowrap">
                                      {row[header] || '-'}
                                    </TableCell>
                                  ))}
                                  {headers.length > 6 && <TableCell>...</TableCell>}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Import Results */}
          {importResult && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold">Import Complete</h3>
                    <p className="text-sm text-muted-foreground">
                      Import finished with the following results:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {importResult.imported}
                    </div>
                    <div className="text-sm text-muted-foreground">Imported</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {importResult.skipped}
                    </div>
                    <div className="text-sm text-muted-foreground">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {importResult.errors}
                    </div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>

                {importResult.details.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Details:</h4>
                    <div className="bg-muted p-3 rounded-md text-sm max-h-32 overflow-y-auto">
                      {importResult.details.map((detail, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          {file && parsedData && !importResult && (
            <Button
              onClick={handleImport}
              disabled={importing || parsedData.data.length === 0}
            >
              {importing ? 'Importing...' : `Import ${parsedData.data.length} Customers`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}