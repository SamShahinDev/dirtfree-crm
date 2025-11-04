'use client'

import { useState } from 'react'
import { Upload, FileText, Image, Download, Trash2, Eye, Calendar } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { FileUpload } from '@/components/ui/file-upload'
import { STORAGE_BUCKETS } from '@/lib/storage/utils'
import type { UploadResult } from '@/lib/hooks/use-file-upload'

interface CustomerDocument {
  id: string
  customerId: string
  filename: string
  originalName: string
  fileUrl: string
  fileType: 'contract' | 'invoice' | 'receipt' | 'photo' | 'other'
  description?: string
  uploadedAt: string
  uploadedBy?: string
  fileSize: number
  mimeType: string
}

interface DocumentUploadProps {
  customerId: string
  documents: CustomerDocument[]
  onDocumentAdded: (document: CustomerDocument) => void
  onDocumentDeleted: (documentId: string) => void
  onDocumentUpdated: (document: CustomerDocument) => void
}

export function DocumentUpload({
  customerId,
  documents,
  onDocumentAdded,
  onDocumentDeleted,
  onDocumentUpdated
}: DocumentUploadProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<CustomerDocument | null>(null)
  const [uploadData, setUploadData] = useState({
    fileUrl: '',
    originalName: '',
    fileType: 'other' as CustomerDocument['fileType'],
    description: ''
  })
  const [uploading, setUploading] = useState(false)

  // Handle file upload completion
  const handleUploadComplete = (result: UploadResult) => {
    if (result.success && result.url) {
      setUploadData(prev => ({
        ...prev,
        fileUrl: result.url!,
        originalName: result.filename || 'uploaded-file'
      }))
      toast.success('File uploaded successfully')
    }
  }

  // Handle file upload error
  const handleUploadError = (error: string) => {
    toast.error(`Upload failed: ${error}`)
  }

  // Submit new document
  const handleSubmitDocument = async () => {
    if (!uploadData.fileUrl || !uploadData.fileType) {
      toast.error('Please select a file and document type')
      return
    }

    setUploading(true)

    try {
      // Create document record
      const newDocument: CustomerDocument = {
        id: `doc_${Date.now()}`, // In real app, this would come from the server
        customerId,
        filename: uploadData.originalName,
        originalName: uploadData.originalName,
        fileUrl: uploadData.fileUrl,
        fileType: uploadData.fileType,
        description: uploadData.description || undefined,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'current-user', // In real app, get from auth
        fileSize: 0, // Would be provided by upload result
        mimeType: 'application/octet-stream' // Would be determined from file
      }

      onDocumentAdded(newDocument)

      // Reset form
      setUploadData({
        fileUrl: '',
        originalName: '',
        fileType: 'other',
        description: ''
      })
      setUploadDialogOpen(false)
      toast.success('Document added successfully')
    } catch (error) {
      console.error('Error adding document:', error)
      toast.error('Failed to add document')
    } finally {
      setUploading(false)
    }
  }

  // Delete document
  const handleDeleteDocument = async (document: CustomerDocument) => {
    if (!confirm(`Are you sure you want to delete "${document.originalName}"?`)) {
      return
    }

    try {
      onDocumentDeleted(document.id)
      toast.success('Document deleted successfully')
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  // View document
  const handleViewDocument = (document: CustomerDocument) => {
    setSelectedDocument(document)
    setViewDialogOpen(true)
  }

  // Download document
  const handleDownloadDocument = async (document: CustomerDocument) => {
    try {
      const response = await fetch(document.fileUrl)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = document.originalName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      window.URL.revokeObjectURL(downloadUrl)
      toast.success('Download started')
    } catch (error) {
      console.error('Failed to download document:', error)
      toast.error('Failed to download document')
    }
  }

  // Get file icon based on type
  const getFileIcon = (fileType: CustomerDocument['fileType'], mimeType?: string) => {
    if (mimeType?.startsWith('image/') || fileType === 'photo') {
      return <Image className="h-5 w-5 text-blue-600" />
    }
    return <FileText className="h-5 w-5 text-gray-600" />
  }

  // Get file type badge color
  const getTypeColor = (fileType: CustomerDocument['fileType']) => {
    switch (fileType) {
      case 'contract':
        return 'bg-purple-100 text-purple-800'
      case 'invoice':
        return 'bg-green-100 text-green-800'
      case 'receipt':
        return 'bg-blue-100 text-blue-800'
      case 'photo':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Customer Documents</h3>
            <p className="text-sm text-gray-600">
              Upload and manage contracts, invoices, photos, and other documents
            </p>
          </div>
          <Button
            onClick={() => setUploadDialogOpen(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        </div>

        {/* Documents List */}
        {documents.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded</h4>
            <p className="text-gray-600 mb-4">Upload your first document to get started</p>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {/* File Icon */}
                <div className="flex-shrink-0">
                  {getFileIcon(document.fileType, document.mimeType)}
                </div>

                {/* Document Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {document.originalName}
                    </h4>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(document.fileType)}`}>
                      {document.fileType}
                    </span>
                  </div>
                  {document.description && (
                    <p className="text-sm text-gray-600 mb-1">{document.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(document.uploadedAt).toLocaleDateString()}
                    </span>
                    <span>{formatFileSize(document.fileSize)}</span>
                    {document.uploadedBy && <span>by {document.uploadedBy}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDocument(document)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadDocument(document)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDocument(document)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>Select File</Label>
              <FileUpload
                bucket={STORAGE_BUCKETS.CUSTOMER_DOCUMENTS || 'customer-documents'}
                accept="all"
                maxFiles={1}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
                disabled={uploading}
              />
              {uploadData.fileUrl && (
                <p className="text-sm text-green-600">File uploaded: {uploadData.originalName}</p>
              )}
            </div>

            {/* Document Type */}
            <div className="space-y-2">
              <Label htmlFor="fileType">Document Type</Label>
              <Select
                value={uploadData.fileType}
                onValueChange={(value: CustomerDocument['fileType']) =>
                  setUploadData(prev => ({ ...prev, fileType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add a description for this document..."
                value={uploadData.description}
                onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitDocument}
              disabled={!uploadData.fileUrl || uploading}
            >
              {uploading ? 'Adding...' : 'Add Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          {selectedDocument && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDocument.originalName}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Document Preview */}
                {selectedDocument.mimeType?.startsWith('image/') ? (
                  <div className="flex justify-center">
                    <img
                      src={selectedDocument.fileUrl}
                      alt={selectedDocument.originalName}
                      className="max-w-full max-h-[400px] object-contain rounded-lg border"
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Preview not available for this file type</p>
                    <Button
                      onClick={() => handleDownloadDocument(selectedDocument)}
                      className="mt-4 gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download to View
                    </Button>
                  </div>
                )}

                {/* Document Details */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Type:</span> {selectedDocument.fileType}
                    </div>
                    <div>
                      <span className="font-medium">Size:</span> {formatFileSize(selectedDocument.fileSize)}
                    </div>
                    <div>
                      <span className="font-medium">Uploaded:</span> {new Date(selectedDocument.uploadedAt).toLocaleDateString()}
                    </div>
                    {selectedDocument.uploadedBy && (
                      <div>
                        <span className="font-medium">By:</span> {selectedDocument.uploadedBy}
                      </div>
                    )}
                  </div>
                  {selectedDocument.description && (
                    <div>
                      <span className="font-medium">Description:</span>
                      <p className="text-gray-600 mt-1">{selectedDocument.description}</p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadDocument(selectedDocument)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}