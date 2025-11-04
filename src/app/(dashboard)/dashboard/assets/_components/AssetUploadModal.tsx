'use client'

import { useState } from 'react'
import { Upload, X } from 'lucide-react'
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
import { uploadAsset } from '@/lib/assets/helper'

interface AssetUploadModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AssetUploadModal({
  open,
  onClose,
  onSuccess,
}: AssetUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [assetType, setAssetType] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [tags, setTags] = useState<string>('')
  const [platforms, setPlatforms] = useState<string[]>(['crm'])
  const [isPublic, setIsPublic] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      // Auto-fill name if empty
      if (!name) {
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, '')
        setName(fileName)
      }
    }
  }

  function handlePlatformToggle(platform: string) {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!file || !name || !assetType) {
      setError('Please fill in all required fields')
      return
    }

    if (platforms.length === 0) {
      setError('Please select at least one platform')
      return
    }

    setUploading(true)

    try {
      await uploadAsset(file, {
        asset_type: assetType as any,
        name,
        category: category || undefined,
        description: description || undefined,
        platforms,
        tags: tags
          ? tags.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
        is_public: isPublic,
      })

      // Reset form
      setFile(null)
      setName('')
      setDescription('')
      setAssetType('')
      setCategory('')
      setTags('')
      setPlatforms(['crm'])
      setIsPublic(false)

      onSuccess()
    } catch (err) {
      console.error('Upload failed:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleClose() {
    if (!uploading) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload New Asset</DialogTitle>
          <DialogDescription>
            Upload a new asset to the shared library
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">
              File <span className="text-destructive">*</span>
            </Label>
            <div className="border-2 border-dashed rounded-md p-6 text-center">
              <input
                type="file"
                id="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label
                htmlFor="file"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                {file ? (
                  <>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Click to upload</p>
                    <p className="text-sm text-muted-foreground">
                      Maximum file size: 50MB
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Asset Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Asset Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Company Logo - Primary"
              disabled={uploading}
              required
            />
          </div>

          {/* Asset Type */}
          <div className="space-y-2">
            <Label htmlFor="asset-type">
              Asset Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={assetType}
              onValueChange={setAssetType}
              disabled={uploading}
              required
            >
              <SelectTrigger id="asset-type">
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="logo">Logo</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={uploading}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="branding">Branding</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="templates">Templates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this asset..."
              rows={3}
              disabled={uploading}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., primary, white, icon (comma-separated)"
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple tags with commas
            </p>
          </div>

          {/* Platforms */}
          <div className="space-y-2">
            <Label>
              Platforms <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="platform-crm"
                  checked={platforms.includes('crm')}
                  onCheckedChange={() => handlePlatformToggle('crm')}
                  disabled={uploading}
                />
                <label
                  htmlFor="platform-crm"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  CRM
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="platform-portal"
                  checked={platforms.includes('portal')}
                  onCheckedChange={() => handlePlatformToggle('portal')}
                  disabled={uploading}
                />
                <label
                  htmlFor="platform-portal"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Customer Portal
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="platform-website"
                  checked={platforms.includes('website')}
                  onCheckedChange={() => handlePlatformToggle('website')}
                  disabled={uploading}
                />
                <label
                  htmlFor="platform-website"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Website
                </label>
              </div>
            </div>
          </div>

          {/* Public Access */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-public"
              checked={isPublic}
              onCheckedChange={(checked) => setIsPublic(checked as boolean)}
              disabled={uploading}
            />
            <label
              htmlFor="is-public"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Make this asset publicly accessible
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Asset
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
