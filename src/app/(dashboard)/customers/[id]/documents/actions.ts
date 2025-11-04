'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Types
export interface CustomerDocument {
  id: string
  customerId: string
  filename: string
  originalName: string
  fileUrl: string
  fileType: 'contract' | 'invoice' | 'receipt' | 'photo' | 'other'
  description?: string | null
  uploadedAt: string
  uploadedBy?: string | null
  fileSize: number
  mimeType: string
}

// Validation schemas
const CreateDocumentSchema = z.object({
  customerId: z.string().uuid(),
  filename: z.string().min(1),
  originalName: z.string().min(1),
  fileUrl: z.string().url(),
  fileType: z.enum(['contract', 'invoice', 'receipt', 'photo', 'other']),
  description: z.string().optional(),
  fileSize: z.number().default(0),
  mimeType: z.string().default('application/octet-stream')
})

const UpdateDocumentSchema = z.object({
  id: z.string().uuid(),
  fileType: z.enum(['contract', 'invoice', 'receipt', 'photo', 'other']).optional(),
  description: z.string().optional()
})

const DeleteDocumentSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid()
})

// Action result type
type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Get all documents for a customer
 */
export async function getCustomerDocuments(customerId: string): Promise<ActionResult<CustomerDocument[]>> {
  try {
    const supabase = await createClient()

    const { data: documents, error } = await supabase
      .from('customer_documents')
      .select(`
        id,
        customer_id,
        filename,
        original_name,
        file_url,
        file_type,
        description,
        uploaded_at,
        uploaded_by,
        file_size,
        mime_type
      `)
      .eq('customer_id', customerId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching customer documents:', error)
      return { success: false, error: 'Failed to fetch documents' }
    }

    const formattedDocuments: CustomerDocument[] = documents.map(doc => ({
      id: doc.id,
      customerId: doc.customer_id,
      filename: doc.filename,
      originalName: doc.original_name,
      fileUrl: doc.file_url,
      fileType: doc.file_type as CustomerDocument['fileType'],
      description: doc.description,
      uploadedAt: doc.uploaded_at,
      uploadedBy: doc.uploaded_by,
      fileSize: doc.file_size,
      mimeType: doc.mime_type
    }))

    return { success: true, data: formattedDocuments }
  } catch (error) {
    console.error('Error in getCustomerDocuments:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Create a new customer document
 */
export async function createCustomerDocument(input: z.infer<typeof CreateDocumentSchema>): Promise<ActionResult<CustomerDocument>> {
  try {
    const validatedInput = CreateDocumentSchema.parse(input)
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    const { data: document, error } = await supabase
      .from('customer_documents')
      .insert({
        customer_id: validatedInput.customerId,
        filename: validatedInput.filename,
        original_name: validatedInput.originalName,
        file_url: validatedInput.fileUrl,
        file_type: validatedInput.fileType,
        description: validatedInput.description,
        uploaded_by: user.id,
        file_size: validatedInput.fileSize,
        mime_type: validatedInput.mimeType
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating customer document:', error)
      return { success: false, error: 'Failed to create document record' }
    }

    const formattedDocument: CustomerDocument = {
      id: document.id,
      customerId: document.customer_id,
      filename: document.filename,
      originalName: document.original_name,
      fileUrl: document.file_url,
      fileType: document.file_type as CustomerDocument['fileType'],
      description: document.description,
      uploadedAt: document.uploaded_at,
      uploadedBy: document.uploaded_by,
      fileSize: document.file_size,
      mimeType: document.mime_type
    }

    revalidatePath(`/customers/${validatedInput.customerId}`)
    return { success: true, data: formattedDocument }
  } catch (error) {
    console.error('Error in createCustomerDocument:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input data' }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update a customer document
 */
export async function updateCustomerDocument(input: z.infer<typeof UpdateDocumentSchema>): Promise<ActionResult<CustomerDocument>> {
  try {
    const validatedInput = UpdateDocumentSchema.parse(input)
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    const updateData: any = {}
    if (validatedInput.fileType) updateData.file_type = validatedInput.fileType
    if (validatedInput.description !== undefined) updateData.description = validatedInput.description

    const { data: document, error } = await supabase
      .from('customer_documents')
      .update(updateData)
      .eq('id', validatedInput.id)
      .eq('uploaded_by', user.id) // Only allow updating own documents
      .select()
      .single()

    if (error) {
      console.error('Error updating customer document:', error)
      return { success: false, error: 'Failed to update document' }
    }

    const formattedDocument: CustomerDocument = {
      id: document.id,
      customerId: document.customer_id,
      filename: document.filename,
      originalName: document.original_name,
      fileUrl: document.file_url,
      fileType: document.file_type as CustomerDocument['fileType'],
      description: document.description,
      uploadedAt: document.uploaded_at,
      uploadedBy: document.uploaded_by,
      fileSize: document.file_size,
      mimeType: document.mime_type
    }

    revalidatePath(`/customers/${document.customer_id}`)
    return { success: true, data: formattedDocument }
  } catch (error) {
    console.error('Error in updateCustomerDocument:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input data' }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a customer document
 */
export async function deleteCustomerDocument(input: z.infer<typeof DeleteDocumentSchema>): Promise<ActionResult> {
  try {
    const validatedInput = DeleteDocumentSchema.parse(input)
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    // First get the document to check permissions and get file info
    const { data: document, error: fetchError } = await supabase
      .from('customer_documents')
      .select('uploaded_by, file_url')
      .eq('id', validatedInput.id)
      .single()

    if (fetchError || !document) {
      return { success: false, error: 'Document not found' }
    }

    // Check if user owns the document
    if (document.uploaded_by !== user.id) {
      return { success: false, error: 'Not authorized to delete this document' }
    }

    // Delete the database record
    const { error: deleteError } = await supabase
      .from('customer_documents')
      .delete()
      .eq('id', validatedInput.id)

    if (deleteError) {
      console.error('Error deleting customer document:', deleteError)
      return { success: false, error: 'Failed to delete document' }
    }

    // TODO: Delete the actual file from storage
    // This would involve extracting the file path from the URL and calling:
    // await supabase.storage.from('customer-documents').remove([filePath])

    revalidatePath(`/customers/${validatedInput.customerId}`)
    return { success: true }
  } catch (error) {
    console.error('Error in deleteCustomerDocument:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input data' }
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get document statistics for a customer
 */
export async function getCustomerDocumentStats(customerId: string): Promise<ActionResult<{
  totalDocuments: number
  documentsByType: Record<string, number>
  totalSize: number
}>> {
  try {
    const supabase = await createClient()

    const { data: documents, error } = await supabase
      .from('customer_documents')
      .select('file_type, file_size')
      .eq('customer_id', customerId)

    if (error) {
      console.error('Error fetching document stats:', error)
      return { success: false, error: 'Failed to fetch document statistics' }
    }

    const stats = {
      totalDocuments: documents.length,
      documentsByType: documents.reduce((acc, doc) => {
        acc[doc.file_type] = (acc[doc.file_type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      totalSize: documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0)
    }

    return { success: true, data: stats }
  } catch (error) {
    console.error('Error in getCustomerDocumentStats:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}