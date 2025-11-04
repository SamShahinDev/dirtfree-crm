'use client'

import { useState, useEffect } from 'react'
import {
  Upload,
  Search,
  Filter,
  Grid,
  List,
  Download,
  Trash2,
  Edit,
  Eye,
  Copy,
  FileIcon,
  Image as ImageIcon,
  File,
  Video,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/hooks/use-toast'
import type { SharedAsset } from '@/lib/assets/helper'
import { AssetUploadModal } from './_components/AssetUploadModal'
import { AssetDetailsModal } from './_components/AssetDetailsModal'

export default function AssetsPage() {
  const [assets, setAssets] = useState<SharedAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<SharedAsset | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchAssets()
  }, [selectedCategory, selectedType])

  async function fetchAssets() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        platform: 'crm',
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedType && { type: selectedType }),
      })

      const response = await fetch(`/api/assets?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }

      const data = await response.json()
      setAssets(data.assets || [])
    } catch (error) {
      console.error('Failed to fetch assets:', error)
      toast({
        title: 'Error',
        description: 'Failed to load assets. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery) return true

    const query = searchQuery.toLowerCase()
    return (
      asset.name.toLowerCase().includes(query) ||
      asset.description?.toLowerCase().includes(query) ||
      asset.tags?.some((tag) => tag.toLowerCase().includes(query))
    )
  })

  function handleAssetClick(asset: SharedAsset) {
    setSelectedAsset(asset)
    setDetailsModalOpen(true)
  }

  async function handleDeleteAsset(assetId: string) {
    if (!confirm('Are you sure you want to delete this asset?')) {
      return
    }

    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete asset')
      }

      toast({
        title: 'Success',
        description: 'Asset deleted successfully',
      })

      fetchAssets()
    } catch (error) {
      console.error('Failed to delete asset:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete asset. Please try again.',
        variant: 'destructive',
      })
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copied!',
        description: 'URL copied to clipboard',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy URL',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Asset Library"
          description="Shared assets across all platforms (CRM, Portal, Website)"
        />

        <Button onClick={() => setUploadModalOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Asset
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={selectedType || 'all'}
          onValueChange={(v) => setSelectedType(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="logo">Logo</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="template">Template</SelectItem>
            <SelectItem value="video">Video</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedCategory || 'all'}
          onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="branding">Branding</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
            <SelectItem value="operations">Operations</SelectItem>
            <SelectItem value="training">Training</SelectItem>
            <SelectItem value="templates">Templates</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            variant={view === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setView('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Assets Display */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card className="p-12 text-center">
          <FileIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No assets found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || selectedCategory || selectedType
              ? 'Try adjusting your filters'
              : 'Upload your first asset to get started'}
          </p>
          {!searchQuery && !selectedCategory && !selectedType && (
            <Button onClick={() => setUploadModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Asset
            </Button>
          )}
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onView={handleAssetClick}
              onDelete={handleDeleteAsset}
              onCopyUrl={copyToClipboard}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAssets.map((asset) => (
            <AssetListItem
              key={asset.id}
              asset={asset}
              onView={handleAssetClick}
              onDelete={handleDeleteAsset}
              onCopyUrl={copyToClipboard}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AssetUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          setUploadModalOpen(false)
          fetchAssets()
        }}
      />

      {/* Details Modal */}
      {selectedAsset && (
        <AssetDetailsModal
          open={detailsModalOpen}
          asset={selectedAsset}
          onClose={() => {
            setDetailsModalOpen(false)
            setSelectedAsset(null)
          }}
          onUpdate={fetchAssets}
          onDelete={handleDeleteAsset}
        />
      )}
    </div>
  )
}

function AssetCard({
  asset,
  onView,
  onDelete,
  onCopyUrl,
}: {
  asset: SharedAsset
  onView: (asset: SharedAsset) => void
  onDelete: (id: string) => void
  onCopyUrl: (url: string) => void
}) {
  const getIcon = () => {
    switch (asset.asset_type) {
      case 'logo':
      case 'image':
        return ImageIcon
      case 'video':
        return Video
      case 'document':
        return File
      case 'template':
        return FileText
      default:
        return FileIcon
    }
  }

  const Icon = getIcon()

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div
        className="aspect-video bg-muted flex items-center justify-center cursor-pointer"
        onClick={() => onView(asset)}
      >
        {asset.asset_type === 'image' || asset.asset_type === 'logo' ? (
          <img
            src={asset.file_url}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon className="h-12 w-12 text-muted-foreground" />
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold truncate" title={asset.name}>
          {asset.name}
        </h3>
        {asset.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {asset.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {asset.asset_type}
          </Badge>
          {asset.category && (
            <Badge variant="outline" className="text-xs">
              {asset.category}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => window.open(asset.file_url, '_blank')}
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCopyUrl(asset.file_url)}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onView(asset)}
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(asset.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AssetListItem({
  asset,
  onView,
  onDelete,
  onCopyUrl,
}: {
  asset: SharedAsset
  onView: (asset: SharedAsset) => void
  onDelete: (id: string) => void
  onCopyUrl: (url: string) => void
}) {
  const getIcon = () => {
    switch (asset.asset_type) {
      case 'logo':
      case 'image':
        return ImageIcon
      case 'video':
        return Video
      case 'document':
        return File
      case 'template':
        return FileText
      default:
        return FileIcon
    }
  }

  const Icon = getIcon()

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
          {asset.asset_type === 'image' || asset.asset_type === 'logo' ? (
            <img
              src={asset.file_url}
              alt={asset.name}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <Icon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{asset.name}</h3>
          {asset.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {asset.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              {asset.asset_type}
            </Badge>
            {asset.category && (
              <Badge variant="outline" className="text-xs">
                {asset.category}
              </Badge>
            )}
            {asset.file_size && (
              <span className="text-xs text-muted-foreground">
                {formatFileSize(asset.file_size)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(asset.file_url, '_blank')}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCopyUrl(asset.file_url)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onView(asset)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(asset.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
