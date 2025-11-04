# File Upload System

A secure file upload system for the Dirt Free Carpet CRM that handles images and PDFs with RBAC, sanitization, and audit logging.

## Overview

The upload system provides:
- **Private Supabase Storage** with signed URL access only
- **MIME type validation** and file type sniffing
- **File sanitization** including EXIF removal and format normalization
- **Size limits** and security measures
- **Role-based access control** (RBAC)
- **Audit logging** for all uploads
- **Short-TTL signed URLs** for secure access

## Configuration

Add these environment variables to your `.env.local`:

```bash
# Uploads Configuration
UPLOADS_BUCKET=uploads                 # Storage bucket name
UPLOADS_MAX_BYTES=5242880             # 5MB file size limit
UPLOADS_SIGNED_TTL=300                # 5 minutes URL expiry
```

## Database Setup

Run the storage setup SQL to create the private bucket:

```bash
# Apply the storage bucket configuration
supabase db push sql/storage_uploads_bucket.sql
```

This creates:
- Private `uploads` bucket in Supabase Storage
- Appropriate RLS policies for security
- MIME type restrictions at the bucket level

## Supported File Types

### Images
- **JPEG** (`.jpg`, `.jpeg`) - Optimized to 80% quality
- **PNG** (`.png`) - Compressed with level 8
- **WebP** (`.webp`) - Optimized to 80% quality
- **GIF** (`.gif`) - Passed through (animation preserved)
- **HEIC** (`.heic`) - Converted to JPEG automatically

### Documents
- **PDF** (`.pdf`) - Validated and passed through

All other file types are rejected with a 415 error.

## Upload Categories

Files are organized by category (`kind`):

- **`truck`** - Photos of vehicles, maintenance records
- **`tool`** - Equipment photos and documentation
- **`thread`** - Images attached to conversation threads
- **`maintenance`** - Maintenance schedules, reports, PDFs

## API Usage

### Upload Endpoint

**POST** `/api/uploads`

Upload a file with multipart form data:

```javascript
const formData = new FormData()
formData.append('file', fileInput.files[0])
formData.append('kind', 'truck')           // Required: upload category
formData.append('entityId', 'truck-uuid')  // Required: related entity ID

const response = await fetch('/api/uploads', {
  method: 'POST',
  body: formData
})

const result = await response.json()
if (result.ok) {
  console.log('Upload successful:', {
    key: result.key,        // Storage key
    url: result.url,        // Signed download URL
    mime: result.mime,      // Final MIME type
    size: result.size       // Final file size
  })
}
```

#### Response Format

**Success (200):**
```json
{
  "ok": true,
  "key": "truck/abc123/2024/01/xyz789.jpg",
  "url": "https://storage.supabase.co/object/sign/uploads/...",
  "mime": "image/jpeg",
  "size": 245760
}
```

**Error (400/401/403/413/415/500):**
```json
{
  "ok": false,
  "error": "File too large. Maximum size is 5MB"
}
```

#### Status Codes

- **200** - Upload successful
- **400** - Invalid input (missing file, kind, entityId)
- **401** - Authentication required
- **403** - Insufficient permissions
- **413** - File too large (>5MB)
- **415** - Unsupported file type
- **500** - Server error

### Re-sign Endpoint

**GET** `/api/uploads/sign?key=...&ttl=...`

Generate a fresh signed URL for an existing file:

```javascript
const response = await fetch('/api/uploads/sign?key=truck/abc123/2024/01/xyz789.jpg&ttl=600')
const result = await response.json()

if (result.ok) {
  console.log('New signed URL:', result.url)
  console.log('Expires in:', result.expiresIn, 'seconds')
}
```

#### Parameters

- **`key`** (required) - The storage object key
- **`ttl`** (optional) - TTL in seconds (1-3600, default: 300)

## Client Usage

### React Hook

Use the `useUpload` hook for easy uploads:

```typescript
import { useUpload } from '@/lib/storage/useUpload'

function UploadComponent() {
  const { upload, isUploading, progress, error } = useUpload()

  const handleUpload = async (file: File) => {
    try {
      const result = await upload({
        file,
        kind: 'truck',
        entityId: 'truck-123',
        onProgress: (progress) => console.log(`${progress}% complete`)
      })

      console.log('Upload complete:', result)
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  return (
    <div>
      {isUploading && <div>Uploading... {progress}%</div>}
      {error && <div>Error: {error}</div>}
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
    </div>
  )
}
```

### Batch Uploads

For multiple files:

```typescript
import { useBatchUpload } from '@/lib/storage/useUpload'

function BatchUploadComponent() {
  const { uploadFiles, uploads, overallProgress, isUploading } = useBatchUpload()

  const handleBatchUpload = async (files: FileList) => {
    const fileArray = Array.from(files).map(file => ({
      file,
      kind: 'tool' as const,
      entityId: 'tool-456'
    }))

    try {
      const results = await uploadFiles(fileArray)
      console.log('All uploads complete:', results)
    } catch (error) {
      console.error('Batch upload failed:', error)
    }
  }

  return (
    <div>
      {isUploading && <div>Uploading... {overallProgress}%</div>}
      <input
        type="file"
        multiple
        onChange={(e) => handleBatchUpload(e.target.files)}
      />
    </div>
  )
}
```

## Server-Side Usage

### Storage Helpers

```typescript
import { putObject, getSignedUrl, allowedMime } from '@/lib/storage'

// Upload a file
const { key } = await putObject({
  key: 'truck/abc123/2024/01/file.jpg',
  bytes: buffer,
  contentType: 'image/jpeg'
})

// Generate signed URL
const url = await getSignedUrl({
  key,
  expiresInSec: 300
})

// Check MIME type
if (allowedMime('image/jpeg')) {
  // Proceed with upload
}
```

### File Sanitization

```typescript
import { sanitizeUpload } from '@/lib/storage/sanitize'

const result = await sanitizeUpload({
  bytes: fileBuffer,
  sniffedExt: 'jpg',
  mime: 'image/jpeg'
})

console.log('Sanitized file:', {
  output: result.output,     // Clean Buffer
  outMime: result.outMime,   // Final MIME type
  outExt: result.outExt      // Final extension
})
```

### Object Keys

```typescript
import { buildObjectKey, parseObjectKey } from '@/lib/storage/keys'

// Generate structured key
const key = buildObjectKey({
  kind: 'truck',
  entityId: 'abc123',
  ext: 'jpg'
})
// Result: "truck/abc123/2024/01/xyz789abc.jpg"

// Parse existing key
const parsed = parseObjectKey(key)
if (parsed) {
  console.log('Kind:', parsed.kind)        // 'truck'
  console.log('Entity:', parsed.entityId)  // 'abc123'
  console.log('Year:', parsed.year)        // '2024'
}
```

## Security Features

### File Sanitization

**Images:**
- EXIF metadata stripped completely
- Auto-rotation based on EXIF orientation
- HEIC files converted to JPEG
- Max dimensions enforced (3000px)
- Quality optimization (80% JPEG, level 8 PNG)

**PDFs:**
- Signature validation (`%PDF` header check)
- Pass-through with basic validation
- Future: metadata stripping, malware scanning

### Access Control

**Role Permissions:**
- **Admin** - Full access to all uploads
- **Dispatcher** - Full access to all uploads
- **Technician** - Upload access (entity-specific restrictions in P7.3)

**Bucket Security:**
- Private bucket (no public access)
- All access via signed URLs only
- Server-side upload/download exclusively

### File Validation

- **Magic number detection** with `file-type` library
- **MIME type cross-checking** between header and detected type
- **Size limits** enforced (5MB default)
- **Extension whitelist** - only allowed types accepted

## Audit Logging

All uploads are logged to the `audit_logs` table:

```sql
INSERT INTO audit_logs (action, entity, entity_id, meta) VALUES (
  'upload_object',
  'truck',
  'abc123',
  {
    "key": "truck/abc123/2024/01/xyz789.jpg",
    "mime": "image/jpeg",
    "size": 245760,
    "original_name": "photo.jpg",
    "original_size": 512000
  }
)
```

**Privacy:** No PII or file contents are logged, only metadata.

## Storage Structure

Files are organized in a hierarchical structure:

```
uploads/
├── truck/
│   └── {entityId}/
│       └── {year}/
│           └── {month}/
│               └── {nanoid}.{ext}
├── tool/
│   └── {entityId}/...
├── thread/
│   └── {entityId}/...
└── maintenance/
    └── {entityId}/...
```

**Example:** `truck/abc123/2024/01/K2nX9mP4qR5s.jpg`

## Error Handling

### Common Errors

**File too large:**
```json
{
  "ok": false,
  "error": "File too large. Maximum size is 5MB"
}
```

**Unsupported type:**
```json
{
  "ok": false,
  "error": "Unsupported file type: application/msword. Allowed types: image/jpeg, image/png, image/webp, image/gif, image/heic, application/pdf"
}
```

**Authentication required:**
```json
{
  "ok": false,
  "error": "Authentication required"
}
```

### Client Error Handling

The `useUpload` hook automatically shows toast notifications for errors and handles common error scenarios with user-friendly messages.

## Command Line Testing

### Upload Test

```bash
# Upload a file
curl -X POST \
  -H "Authorization: Bearer <your-jwt-token>" \
  -F "file=@/path/to/image.jpg" \
  -F "kind=truck" \
  -F "entityId=test-truck-123" \
  http://localhost:3000/api/uploads
```

### Re-sign Test

```bash
# Get a fresh signed URL
curl -X GET \
  -H "Authorization: Bearer <your-jwt-token>" \
  "http://localhost:3000/api/uploads/sign?key=truck/test-truck-123/2024/01/abc123.jpg&ttl=600"
```

## Performance Considerations

- **Image processing** with Sharp is CPU-intensive - consider offloading for high-volume usage
- **Concurrent uploads** are limited to 3 per batch to prevent overwhelming the server
- **File size limits** prevent memory exhaustion from large files
- **Signed URL caching** reduces repeated generation costs

## Future Enhancements

1. **P7.3 Entity Access Control** - Strict validation that technicians can only access their assigned entities
2. **PDF Metadata Stripping** - Use pdf-lib to remove metadata from PDFs
3. **Malware Scanning** - Integrate virus scanning for uploaded files
4. **Image Analysis** - Auto-tagging, face detection, OCR capabilities
5. **CDN Integration** - CloudFront or similar for global file delivery
6. **Background Processing** - Queue-based processing for large files
7. **Thumbnail Generation** - Auto-generate thumbnails for images
8. **File Versioning** - Support for file updates and version history