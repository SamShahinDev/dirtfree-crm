'use client'

import { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  MoreHorizontal,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Calendar,
  FileText,
  Image,
  Folder,
  CheckSquare,
  Square
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FileItem {
  id: string
  name: string
  type: 'image' | 'document' | 'other'
  size: number
  url: string
  createdAt: string
  bucket: string
  mimeType: string
  category?: string
  tags?: string[]
}

interface FileManagerProps {
  files: FileItem[]
  onFileSelect?: (file: FileItem) => void
  onFileDelete?: (fileId: string) => void
  onBulkAction?: (action: string, fileIds: string[]) => void
  onFilePreview?: (file: FileItem) => void
  allowMultiSelect?: boolean
  allowBulkActions?: boolean
  compact?: boolean
}

type ViewMode = 'grid' | 'list'
type SortField = 'name' | 'size' | 'createdAt' | 'type'
type SortDirection = 'asc' | 'desc'

export function FileManager({
  files,
  onFileSelect,
  onFileDelete,
  onBulkAction,
  onFilePreview,
  allowMultiSelect = false,
  allowBulkActions = false,
  compact = false
}: FileManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterBucket, setFilterBucket] = useState<string>('all')
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Filter and sort files
  const filteredAndSortedFiles = files
    .filter(file => {
      // Search filter
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      // Type filter
      if (filterType !== 'all' && file.type !== filterType) {
        return false
      }
      // Bucket filter
      if (filterBucket !== 'all' && file.bucket !== filterBucket) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      if (sortField === 'createdAt') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortDirection === 'desc' ? -comparison : comparison
    })

  // Get unique buckets for filter
  const uniqueBuckets = Array.from(new Set(files.map(f => f.bucket)))

  // Handle file selection
  const handleFileSelect = (file: FileItem) => {
    if (allowMultiSelect) {
      const newSelected = new Set(selectedFiles)
      if (newSelected.has(file.id)) {
        newSelected.delete(file.id)
      } else {
        newSelected.add(file.id)
      }
      setSelectedFiles(newSelected)
    } else {
      onFileSelect?.(file)
    }
  }

  // Handle select all
  const handleSelectAll = () => {
    if (selectedFiles.size === filteredAndSortedFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(filteredAndSortedFiles.map(f => f.id)))
    }
  }

  // Handle bulk actions
  const handleBulkAction = (action: string) => {
    if (selectedFiles.size === 0) return
    onBulkAction?.(action, Array.from(selectedFiles))
    setSelectedFiles(new Set())
  }

  // Handle file preview
  const handlePreview = (file: FileItem) => {
    if (onFilePreview) {
      onFilePreview(file)
    } else {
      setPreviewFile(file)
      setPreviewOpen(true)
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

  // Get file icon
  const getFileIcon = (file: FileItem) => {
    if (file.type === 'image') {
      return <Image className="h-5 w-5 text-blue-600" />
    }
    return <FileText className="h-5 w-5 text-gray-600" />
  }

  // Download file
  const downloadFile = async (file: FileItem) => {
    try {
      const response = await fetch(file.url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Failed to download file:', error)
    }
  }

  return (
    <>
      <div className={cn('space-y-4', compact && 'space-y-2')}>
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterBucket} onValueChange={setFilterBucket}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Folders</SelectItem>
                {uniqueBuckets.map(bucket => (
                  <SelectItem key={bucket} value={bucket}>
                    {bucket.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setSortField('name'); setSortDirection('asc') }}>
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField('name'); setSortDirection('desc') }}>
                  Name (Z-A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField('createdAt'); setSortDirection('desc') }}>
                  Newest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField('createdAt'); setSortDirection('asc') }}>
                  Oldest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField('size'); setSortDirection('desc') }}>
                  Largest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField('size'); setSortDirection('asc') }}>
                  Smallest First
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {allowBulkActions && selectedFiles.size > 0 && (
          <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium">
              {selectedFiles.size} file{selectedFiles.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('download')}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkAction('delete')}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedFiles(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        )}

        {/* File Grid/List */}
        {filteredAndSortedFiles.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
            <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
            <p className="text-gray-600">
              {searchQuery ? 'Try adjusting your search terms' : 'No files have been uploaded yet'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={cn(
            'grid gap-4',
            compact ? 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-8' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
          )}>
            {allowMultiSelect && (
              <div className="col-span-full flex items-center gap-2 pb-2">
                <Checkbox
                  checked={selectedFiles.size === filteredAndSortedFiles.length && filteredAndSortedFiles.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label className="text-sm">Select All</Label>
              </div>
            )}
            {filteredAndSortedFiles.map((file) => (
              <div
                key={file.id}
                className={cn(
                  'group relative border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors cursor-pointer',
                  selectedFiles.has(file.id) && 'ring-2 ring-blue-500 border-blue-500'
                )}
                onClick={() => handleFileSelect(file)}
              >
                {allowMultiSelect && (
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={selectedFiles.has(file.id)}
                      onCheckedChange={() => handleFileSelect(file)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* File Preview */}
                <div className={cn(
                  'aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden',
                  compact && 'aspect-square'
                )}>
                  {file.type === 'image' ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getFileIcon(file)
                  )}
                </div>

                {/* File Info */}
                <div className="space-y-1">
                  <p className="text-sm font-medium truncate" title={file.name}>
                    {file.name}
                  </p>
                  {!compact && (
                    <>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePreview(file) }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadFile(file) }}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      {onFileDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onFileDelete(file.id) }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {allowMultiSelect && (
              <div className="flex items-center gap-2 p-2 border-b">
                <Checkbox
                  checked={selectedFiles.size === filteredAndSortedFiles.length && filteredAndSortedFiles.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label className="text-sm">Select All</Label>
              </div>
            )}
            {filteredAndSortedFiles.map((file) => (
              <div
                key={file.id}
                className={cn(
                  'flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer',
                  selectedFiles.has(file.id) && 'ring-2 ring-blue-500 border-blue-500'
                )}
                onClick={() => handleFileSelect(file)}
              >
                {allowMultiSelect && (
                  <Checkbox
                    checked={selectedFiles.has(file.id)}
                    onCheckedChange={() => handleFileSelect(file)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                {/* File Icon/Thumbnail */}
                <div className="flex-shrink-0">
                  {file.type === 'image' ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                      {getFileIcon(file)}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{formatFileSize(file.size)}</span>
                    <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                    <Badge variant="outline" className="text-xs">
                      {file.bucket.replace('-', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); handlePreview(file) }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); downloadFile(file) }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {onFileDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); onFileDelete(file.id) }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          {previewFile && (
            <>
              <DialogHeader>
                <DialogTitle>{previewFile.name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* File Preview */}
                {previewFile.type === 'image' ? (
                  <div className="flex justify-center">
                    <img
                      src={previewFile.url}
                      alt={previewFile.name}
                      className="max-w-full max-h-[400px] object-contain rounded-lg border"
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Preview not available for this file type</p>
                    <Button
                      onClick={() => downloadFile(previewFile)}
                      className="mt-4 gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download to View
                    </Button>
                  </div>
                )}

                {/* File Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Size:</span> {formatFileSize(previewFile.size)}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {previewFile.mimeType}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {new Date(previewFile.createdAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Folder:</span> {previewFile.bucket.replace('-', ' ')}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}