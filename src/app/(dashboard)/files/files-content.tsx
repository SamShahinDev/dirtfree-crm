'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileManager } from '@/components/file-manager/file-manager'
import { deleteFiles, type FileItem } from './actions'

interface FilesContentProps {
  initialFiles: FileItem[]
}

export function FilesContent({ initialFiles }: FilesContentProps) {
  const [files, setFiles] = useState<FileItem[]>(initialFiles)
  const [isPending, startTransition] = useTransition()

  // Handle file deletion
  const handleFileDelete = (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return
    }

    startTransition(async () => {
      try {
        const result = await deleteFiles([fileId])

        if (result.success) {
          setFiles(prev => prev.filter(file => file.id !== fileId))
          toast.success('File deleted successfully')
        } else {
          toast.error(result.error || 'Failed to delete file')
        }
      } catch (error) {
        console.error('Error deleting file:', error)
        toast.error('An error occurred while deleting the file')
      }
    })
  }

  // Handle bulk actions
  const handleBulkAction = (action: string, fileIds: string[]) => {
    if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete ${fileIds.length} file${fileIds.length === 1 ? '' : 's'}?`)) {
        return
      }

      startTransition(async () => {
        try {
          const result = await deleteFiles(fileIds)

          if (result.success) {
            setFiles(prev => prev.filter(file => !fileIds.includes(file.id)))
            toast.success(`${fileIds.length} file${fileIds.length === 1 ? '' : 's'} deleted successfully`)
          } else {
            toast.error(result.error || 'Failed to delete files')
          }
        } catch (error) {
          console.error('Error deleting files:', error)
          toast.error('An error occurred while deleting the files')
        }
      })
    } else if (action === 'download') {
      // Handle bulk download
      toast.info('Bulk download feature coming soon')
    }
  }

  // Handle file preview
  const handleFilePreview = (file: FileItem) => {
    // For now, just open in new tab
    window.open(file.url, '_blank')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Files</CardTitle>
      </CardHeader>
      <CardContent>
        <FileManager
          files={files}
          onFileDelete={handleFileDelete}
          onBulkAction={handleBulkAction}
          onFilePreview={handleFilePreview}
          allowMultiSelect={true}
          allowBulkActions={true}
        />
      </CardContent>
    </Card>
  )
}