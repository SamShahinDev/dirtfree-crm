'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { DocumentUpload } from '@/components/customer/document-upload'
import {
  createCustomerDocument,
  updateCustomerDocument,
  deleteCustomerDocument,
  type CustomerDocument
} from './actions'

interface Customer {
  id: string
  name: string
  email?: string | null
  phone_e164?: string | null
}

interface CustomerDocumentsContentProps {
  customer: Customer
  initialDocuments: CustomerDocument[]
}

export function CustomerDocumentsContent({
  customer,
  initialDocuments
}: CustomerDocumentsContentProps) {
  const [documents, setDocuments] = useState<CustomerDocument[]>(initialDocuments)
  const [isPending, startTransition] = useTransition()

  // Handle adding a new document
  const handleDocumentAdded = (newDocument: CustomerDocument) => {
    startTransition(async () => {
      try {
        const result = await createCustomerDocument({
          customerId: customer.id,
          filename: newDocument.filename,
          originalName: newDocument.originalName,
          fileUrl: newDocument.fileUrl,
          fileType: newDocument.fileType,
          description: newDocument.description || undefined,
          fileSize: newDocument.fileSize,
          mimeType: newDocument.mimeType
        })

        if (result.success && result.data) {
          setDocuments(prev => [result.data!, ...prev])
          toast.success('Document uploaded successfully')
        } else {
          toast.error(result.error || 'Failed to upload document')
        }
      } catch (error) {
        console.error('Error uploading document:', error)
        toast.error('An error occurred while uploading the document')
      }
    })
  }

  // Handle updating a document
  const handleDocumentUpdated = (updatedDocument: CustomerDocument) => {
    startTransition(async () => {
      try {
        const result = await updateCustomerDocument({
          id: updatedDocument.id,
          fileType: updatedDocument.fileType,
          description: updatedDocument.description || undefined
        })

        if (result.success && result.data) {
          setDocuments(prev =>
            prev.map(doc => doc.id === result.data!.id ? result.data! : doc)
          )
          toast.success('Document updated successfully')
        } else {
          toast.error(result.error || 'Failed to update document')
        }
      } catch (error) {
        console.error('Error updating document:', error)
        toast.error('An error occurred while updating the document')
      }
    })
  }

  // Handle deleting a document
  const handleDocumentDeleted = (documentId: string) => {
    startTransition(async () => {
      try {
        const result = await deleteCustomerDocument({
          id: documentId,
          customerId: customer.id
        })

        if (result.success) {
          setDocuments(prev => prev.filter(doc => doc.id !== documentId))
          toast.success('Document deleted successfully')
        } else {
          toast.error(result.error || 'Failed to delete document')
        }
      } catch (error) {
        console.error('Error deleting document:', error)
        toast.error('An error occurred while deleting the document')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Customer Info */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">{customer.name}</h2>
        <div className="flex gap-6 text-sm text-muted-foreground">
          {customer.email && (
            <div>
              <span className="font-medium">Email:</span> {customer.email}
            </div>
          )}
          {customer.phone_e164 && (
            <div>
              <span className="font-medium">Phone:</span> {customer.phone_e164}
            </div>
          )}
        </div>
      </div>

      {/* Document Upload Component */}
      <DocumentUpload
        customerId={customer.id}
        documents={documents}
        onDocumentAdded={handleDocumentAdded}
        onDocumentDeleted={handleDocumentDeleted}
        onDocumentUpdated={handleDocumentUpdated}
      />
    </div>
  )
}