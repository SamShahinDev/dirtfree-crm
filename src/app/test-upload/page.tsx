'use client'

import { useState } from 'react'
import { FileUpload, ImageUpload } from '@/components/ui/file-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, AlertCircle, Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { UploadResult } from '@/lib/hooks/use-file-upload'

export default function TestUploadPage() {
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [selectedBucket, setSelectedBucket] = useState('job-photos')

  const buckets = [
    { value: 'job-photos', label: 'Job Photos', description: 'Before/after job images' },
    { value: 'vehicle-photos', label: 'Vehicle Photos', description: 'Truck and equipment photos' },
    { value: 'customer-documents', label: 'Customer Documents', description: 'Contracts and documents' },
    { value: 'maintenance-records', label: 'Maintenance Records', description: 'Service receipts and records' }
  ]

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResults(prev => [result, ...prev])
    if (result.success) {
      toast.success(`File uploaded successfully!`)
    }
  }

  const handleUploadError = (error: string) => {
    toast.error(`Upload failed: ${error}`)
  }

  const copyUrlToClipboard = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success('URL copied to clipboard!')
  }

  const clearResults = () => {
    setUploadResults([])
    toast.success('Results cleared')
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-8 relative z-0">
      <div className="text-center">
        <h1 className="text-3xl font-bold">File Upload Test</h1>
        <p className="text-muted-foreground mt-2">
          Test file uploads to different Supabase storage buckets
        </p>
      </div>

      {/* Bucket Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Storage Bucket</CardTitle>
          <CardDescription>
            Choose which bucket to upload files to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {buckets.map((bucket) => (
              <Button
                key={bucket.value}
                variant={selectedBucket === bucket.value ? 'default' : 'outline'}
                className="h-auto p-4 text-left justify-start relative z-10 cursor-pointer"
                onClick={() => setSelectedBucket(bucket.value)}
              >
                <div>
                  <div className="font-medium">{bucket.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {bucket.description}
                  </div>
                </div>
              </Button>
            ))}
          </div>
          <div className="mt-4">
            <Badge variant="secondary">
              Current bucket: {selectedBucket}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Upload Components */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 relative z-10">
          <TabsTrigger value="general" className="relative z-10 cursor-pointer">General Upload</TabsTrigger>
          <TabsTrigger value="image" className="relative z-10 cursor-pointer">Image Upload</TabsTrigger>
          <TabsTrigger value="multiple" className="relative z-10 cursor-pointer">Multiple Files</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General File Upload</CardTitle>
              <CardDescription>
                Upload any supported file type (images or documents based on bucket)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                bucket={selectedBucket}
                accept={selectedBucket.includes('photo') ? 'images' : 'documents'}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Image Upload with Preview</CardTitle>
              <CardDescription>
                Upload images with immediate preview (works best with photo buckets)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                bucket={selectedBucket}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multiple" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Multiple File Upload</CardTitle>
              <CardDescription>
                Upload multiple files at once (up to 5 files)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                bucket={selectedBucket}
                accept={selectedBucket.includes('photo') ? 'images' : 'documents'}
                maxFiles={5}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Results */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Upload Results</CardTitle>
            <CardDescription>
              View all upload attempts and their results
            </CardDescription>
          </div>
          {uploadResults.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearResults} className="relative z-10 cursor-pointer">
              Clear Results
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {uploadResults.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No uploads yet. Try uploading a file above!
            </p>
          ) : (
            <div className="space-y-3">
              {uploadResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-3 p-3 border rounded-lg"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">
                        {result.success ? 'Success' : 'Failed'}
                      </span>
                      {result.fileName && (
                        <Badge variant="secondary" className="text-xs">
                          {result.fileName}
                        </Badge>
                      )}
                    </div>

                    {result.success && result.url && (
                      <div className="mt-1 flex items-center space-x-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 truncate">
                          {result.url}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyUrlToClipboard(result.url!)}
                          className="h-7 w-7 p-0 flex-shrink-0 relative z-10 cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {result.error && (
                      <p className="text-xs text-red-600 mt-1">
                        {result.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Before Testing:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Make sure you've created the storage buckets in Supabase</li>
              <li>Set the buckets to "Public" for now</li>
              <li>Configure any necessary RLS policies</li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium mb-2">Supported File Types:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li><strong>Photo buckets:</strong> JPEG, PNG, WebP, GIF (up to 5MB)</li>
              <li><strong>Document buckets:</strong> PDF, TXT, DOC, DOCX (up to 5MB)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">Testing Steps:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Select a bucket above</li>
              <li>Choose an upload method (General, Image, or Multiple)</li>
              <li>Drag & drop or click to select files</li>
              <li>Watch the upload progress</li>
              <li>Check the results below</li>
              <li>Verify files appear in Supabase storage dashboard</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}