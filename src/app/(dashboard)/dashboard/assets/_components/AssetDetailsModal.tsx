'use client'

import { useState } from 'react'
import { Edit, Trash2, Download, Copy, X, Save } from 'lucide-react'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import type { SharedAsset } from '@/lib/assets/helper'
import { updateAsset } from '@/lib/assets/helper'

interface AssetDetailsModalProps {
  open: boolean
  asset: SharedAsset
  onClose: () => void
  onUpdate: () => void
  onDelete: (id: string) => void
}

export function AssetDetailsModal({
  open,
  asset,
  onClose,
  onUpdate,
  onDelete,
}: AssetDetailsModalProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(asset.name)
  const [description, setDescription] = useState(asset.description || '')
  const [category, setCategory] = useState(asset.category || '')
  const [tags, setTags] = useState(asset.tags?.join(', ') || '')
  const [platforms, setPlatforms] = useState<string[]>(asset.platforms)
  const [isPublic, setIsPublic] = useState(asset.is_public)
  const [error, setError] = useState<string | null>(null)

  function handlePlatformToggle(platform: string) {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  async function handleSave() {
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (platforms.length === 0) {
      setError('Please select at least one platform')
      return
    }

    setSaving(true)

    try {
      await updateAsset(asset.id, {
        name,
        description: description || undefined,
        category: category || undefined,
        tags: tags
          ? tags.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
        platforms,
        is_public: isPublic,
      })

      setEditing(false)
      onUpdate()
    } catch (err) {
      console.error('Update failed:', err)
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setName(asset.name)
    setDescription(asset.description || '')
    setCategory(asset.category || '')
    setTags(asset.tags?.join(', ') || '')
    setPlatforms(asset.platforms)
    setIsPublic(asset.is_public)
    setEditing(false)
    setError(null)
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(asset.file_url)
      alert('URL copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  function handleDelete() {
    if (confirm('Are you sure you want to delete this asset?')) {
      onDelete(asset.id)
      onClose()
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Asset Details</span>
            <div className="flex gap-2">
              {!editing && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(asset.file_url, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Preview */}
        {!editing && (asset.asset_type === 'image' || asset.asset_type === 'logo') && (
          <div className="w-full bg-muted rounded-md overflow-hidden">
            <img
              src={asset.file_url}
              alt={asset.name}
              className="w-full h-auto object-contain max-h-96"
            />
          </div>
        )}

        <div className="space-y-4">
          {editing ? (
            <>
              {/* Edit Form */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={category || 'none'}
                  onValueChange={(value) => setCategory(value === 'none' ? '' : value)}
                  disabled={saving}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue placeholder="Select category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="branding">Branding</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="templates">Templates</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tags">Tags</Label>
                <Input
                  id="edit-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., primary, white, icon (comma-separated)"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label>Platforms</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-platform-crm"
                      checked={platforms.includes('crm')}
                      onCheckedChange={() => handlePlatformToggle('crm')}
                      disabled={saving}
                    />
                    <label
                      htmlFor="edit-platform-crm"
                      className="text-sm font-medium"
                    >
                      CRM
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-platform-portal"
                      checked={platforms.includes('portal')}
                      onCheckedChange={() => handlePlatformToggle('portal')}
                      disabled={saving}
                    />
                    <label
                      htmlFor="edit-platform-portal"
                      className="text-sm font-medium"
                    >
                      Customer Portal
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-platform-website"
                      checked={platforms.includes('website')}
                      onCheckedChange={() => handlePlatformToggle('website')}
                      disabled={saving}
                    />
                    <label
                      htmlFor="edit-platform-website"
                      className="text-sm font-medium"
                    >
                      Website
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-is-public"
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(checked as boolean)}
                  disabled={saving}
                />
                <label
                  htmlFor="edit-is-public"
                  className="text-sm font-medium"
                >
                  Make this asset publicly accessible
                </label>
              </div>
            </>
          ) : (
            <>
              {/* View Mode */}
              <div>
                <Label>Name</Label>
                <p className="text-sm mt-1">{asset.name}</p>
              </div>

              {asset.description && (
                <div>
                  <Label>Description</Label>
                  <p className="text-sm mt-1">{asset.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <p className="text-sm mt-1">
                    <Badge variant="secondary">{asset.asset_type}</Badge>
                  </p>
                </div>

                {asset.category && (
                  <div>
                    <Label>Category</Label>
                    <p className="text-sm mt-1">
                      <Badge variant="outline">{asset.category}</Badge>
                    </p>
                  </div>
                )}
              </div>

              {asset.tags && asset.tags.length > 0 && (
                <div>
                  <Label>Tags</Label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {asset.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Platforms</Label>
                <div className="flex gap-2 mt-1">
                  {asset.platforms.map((platform) => (
                    <Badge key={platform} variant="secondary">
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {asset.file_size && (
                  <div>
                    <Label>File Size</Label>
                    <p className="mt-1">{formatFileSize(asset.file_size)}</p>
                  </div>
                )}

                {asset.mime_type && (
                  <div>
                    <Label>MIME Type</Label>
                    <p className="mt-1">{asset.mime_type}</p>
                  </div>
                )}

                {asset.dimensions && (
                  <div>
                    <Label>Dimensions</Label>
                    <p className="mt-1">
                      {asset.dimensions.width} × {asset.dimensions.height}
                    </p>
                  </div>
                )}

                <div>
                  <Label>Usage Count</Label>
                  <p className="mt-1">{asset.usage_count || 0}</p>
                </div>
              </div>

              <div className="text-sm">
                <Label>File URL</Label>
                <div className="flex gap-2 mt-1">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-xs overflow-auto">
                    {asset.file_url}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <Label>Created</Label>
                  <p className="mt-1">{formatDate(asset.created_at)}</p>
                </div>
                <div>
                  <Label>Last Updated</Label>
                  <p className="mt-1">{formatDate(asset.updated_at)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {editing && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
