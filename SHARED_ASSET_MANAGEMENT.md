# Shared Asset Management System

## Overview

The Shared Asset Management System provides a centralized location for storing and managing assets (logos, images, documents, templates, videos) that can be accessed across all three Dirt Free platforms: CRM, Customer Portal, and Website.

## Features

- **Centralized Storage**: Single source of truth for all brand assets
- **Platform Control**: Specify which platforms can access each asset
- **Categorization**: Organize assets by type and category
- **Tagging**: Add tags for easy searching and filtering
- **Version Control**: Track asset versions and usage
- **Usage Analytics**: Monitor which assets are being used and when
- **Audit Trail**: Complete history of asset uploads, updates, and deletions
- **Access Control**: Role-based permissions for asset management

## Database Structure

### Tables

#### `shared_assets`
Main table storing all asset information:
- Asset metadata (name, description, type, category)
- File information (path, URL, size, MIME type, dimensions)
- Access control (platforms, public/private)
- Versioning (version number, previous version reference)
- Usage tracking (usage count, last used timestamp)
- Metadata and tags

#### `asset_categories`
Predefined asset categories:
- branding
- marketing
- legal
- operations
- training
- templates

### Storage

Assets are stored in the Supabase `shared-assets` storage bucket with the following structure:
```
shared-assets/
├── branding/
├── marketing/
├── legal/
├── operations/
├── training/
├── templates/
└── uncategorized/
```

## Setup Instructions

### 1. Database Setup

Run the SQL migration file to create the necessary tables and policies:

```bash
# Run in Supabase SQL Editor
psql -h your-supabase-url -U postgres -d postgres -f sql/18-shared-asset-management.sql
```

Or execute the SQL file manually in the Supabase Dashboard SQL Editor.

### 2. Storage Bucket Setup

**In Supabase Dashboard:**

1. Go to **Storage** section
2. Click **New bucket**
3. Create bucket with the following settings:
   - **Name**: `shared-assets`
   - **Public**: Yes (checked)
   - **File size limit**: 52428800 (50MB)
   - **Allowed MIME types**:
     - image/jpeg
     - image/png
     - image/gif
     - image/webp
     - image/svg+xml
     - application/pdf
     - video/mp4
     - video/webm
     - application/msword
     - application/vnd.openxmlformats-officedocument.wordprocessingml.document
     - application/vnd.ms-excel
     - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

4. Apply the storage policies from the SQL file (commented section at bottom)

### 3. Verify Installation

Test the setup by:
1. Navigate to `/dashboard/assets` in the CRM
2. Upload a test asset
3. Verify it appears in the asset library
4. Check that the file is in Supabase Storage

## Usage

### In the CRM

#### Accessing the Asset Library

Navigate to **Dashboard → Assets** to view and manage all shared assets.

#### Uploading an Asset

1. Click **Upload Asset** button
2. Select file to upload
3. Fill in required information:
   - **Name**: Descriptive name for the asset
   - **Type**: logo, image, document, template, or video
   - **Category**: Optional categorization
   - **Description**: Optional description
   - **Tags**: Comma-separated tags for easy searching
   - **Platforms**: Select which platforms can access this asset
   - **Public**: Make asset publicly accessible (no authentication required)
4. Click **Upload Asset**

#### Managing Assets

- **View Details**: Click the eye icon or asset card to view full details
- **Edit**: Click edit icon in details modal to update metadata
- **Download**: Click download icon to download the asset
- **Copy URL**: Click copy icon to copy the asset URL to clipboard
- **Delete**: Click delete icon to remove the asset

#### Filtering Assets

Use the toolbar to filter assets by:
- **Search**: Search by name, description, or tags
- **Type**: Filter by asset type (logo, image, document, template, video)
- **Category**: Filter by category (branding, marketing, legal, etc.)

### Using Assets in Code

#### In CRM, Portal, or Website

Import the helper functions:

```typescript
import {
  getAsset,
  getAssetsByType,
  getAssetsByCategory,
  getCompanyLogo,
  getEmailTemplate,
  getBrandingColors,
  getBrandingFonts,
  uploadAsset,
  updateAsset,
  deleteAsset,
} from '@/lib/assets/helper'
```

#### Examples

**Get Company Logo:**
```typescript
// Get primary logo
const logoUrl = await getCompanyLogo('primary')

// Get white logo variant
const whiteLogoUrl = await getCompanyLogo('white')

// Use in component
<img src={logoUrl} alt="Company Logo" />
```

**Get All Marketing Materials:**
```typescript
const marketingAssets = await getAssetsByCategory('marketing', 'website')

marketingAssets.forEach(asset => {
  console.log(asset.name, asset.file_url)
})
```

**Get Branding Colors:**
```typescript
const colors = await getBrandingColors()

// Returns:
// {
//   primary: '#1e40af',
//   secondary: '#64748b',
//   accent: '#f59e0b'
// }

// Use in CSS
<style>{`
  :root {
    --color-primary: ${colors.primary};
    --color-secondary: ${colors.secondary};
    --color-accent: ${colors.accent};
  }
`}</style>
```

**Upload Asset Programmatically:**
```typescript
const file = // ... File object
const asset = await uploadAsset(file, {
  asset_type: 'logo',
  name: 'Company Logo - Primary',
  category: 'branding',
  description: 'Main company logo for light backgrounds',
  platforms: ['crm', 'portal', 'website'],
  tags: ['primary', 'logo', 'main'],
  is_public: true,
})
```

**Update Asset Metadata:**
```typescript
await updateAsset(assetId, {
  name: 'Updated Asset Name',
  description: 'Updated description',
  tags: ['new', 'tags'],
})
```

**Search Assets:**
```typescript
import { searchAssets } from '@/lib/assets/helper'

const results = await searchAssets('carpet')
// Returns all assets matching "carpet" in name or description
```

## API Endpoints

### GET /api/assets

Retrieve assets with optional filtering.

**Query Parameters:**
- `type`: Filter by asset_type (logo, image, document, template, video)
- `category`: Filter by category
- `platform`: Filter by platform (default: 'crm')
- `tags`: Comma-separated tags
- `search`: Search term for name/description

**Response:**
```json
{
  "assets": [
    {
      "id": "uuid",
      "asset_type": "logo",
      "category": "branding",
      "name": "Company Logo",
      "description": "Main company logo",
      "file_url": "https://...",
      "file_size": 12345,
      "mime_type": "image/png",
      "dimensions": { "width": 1920, "height": 1080 },
      "platforms": ["crm", "portal", "website"],
      "tags": ["primary", "logo"],
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/assets

Upload a new asset.

**Form Data:**
- `file`: File to upload (required)
- `asset_type`: Type of asset (required)
- `name`: Asset name (required)
- `category`: Category (optional)
- `description`: Description (optional)
- `platforms`: JSON array of platforms (optional, default: ["crm"])
- `tags`: JSON array of tags (optional)
- `is_public`: Boolean (optional, default: false)

**Response:**
```json
{
  "success": true,
  "asset": { /* asset object */ }
}
```

### GET /api/assets/[id]

Get a single asset by ID and track usage.

### PATCH /api/assets/[id]

Update asset metadata.

**Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "category": "marketing",
  "tags": ["tag1", "tag2"],
  "platforms": ["crm", "portal"],
  "is_public": true
}
```

### DELETE /api/assets/[id]

Delete an asset and its file from storage.

## Security & Permissions

### Row Level Security (RLS)

- **View**: All authenticated users can view assets
- **Upload**: Only admins and managers can upload assets
- **Update**: Only admins and managers can update assets
- **Delete**: Only admins and managers can delete assets

### Storage Policies

- Public assets are accessible to everyone
- All authenticated users can view all assets in storage
- Only admins and managers can upload/update/delete files

## Best Practices

1. **Naming Convention**: Use descriptive names like "Company Logo - Primary" instead of "logo.png"

2. **Tagging**: Add relevant tags for easy searching:
   - Logo variants: 'primary', 'white', 'dark', 'icon'
   - Document types: 'contract', 'terms', 'privacy'
   - Usage context: 'email', 'web', 'print'

3. **Categories**: Use categories to organize assets:
   - **branding**: Logos, colors, fonts, brand guidelines
   - **marketing**: Ads, campaigns, promotional materials
   - **legal**: Contracts, terms, policies
   - **operations**: Process docs, forms, checklists
   - **training**: Training materials, guides
   - **templates**: Email templates, document templates

4. **Platform Selection**: Carefully select which platforms need access:
   - Brand assets usually need access from all platforms
   - Internal documents should only be accessible from CRM
   - Customer-facing templates might only need Portal/Website access

5. **File Optimization**:
   - Compress images before uploading
   - Use appropriate formats (PNG for logos, JPG for photos, SVG for icons)
   - Keep file sizes reasonable (aim for < 1MB for web assets)

6. **Descriptions**: Add clear descriptions to help team members understand:
   - What the asset is
   - When to use it
   - Any usage restrictions

## Integration Examples

### Website Navigation Component

```typescript
import { getCompanyLogo } from '@/lib/assets/helper'
import { useEffect, useState } from 'react'

export function Navigation() {
  const [logoUrl, setLogoUrl] = useState('/logo.png') // fallback

  useEffect(() => {
    getCompanyLogo('primary').then(url => {
      if (url) setLogoUrl(url)
    })
  }, [])

  return (
    <nav>
      <img src={logoUrl} alt="Dirt Free Carpet" className="h-12" />
      {/* rest of navigation */}
    </nav>
  )
}
```

### Portal Layout with Dynamic Branding

```typescript
import { getBrandingColors } from '@/lib/assets/helper'

export default async function RootLayout({ children }) {
  const colors = await getBrandingColors()

  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            --color-primary: ${colors.primary};
            --color-secondary: ${colors.secondary};
            --color-accent: ${colors.accent};
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Email Template with Shared Assets

```typescript
import { getEmailTemplate, getCompanyLogo } from '@/lib/assets/helper'

export async function sendWelcomeEmail(customerEmail: string) {
  const template = await getEmailTemplate('Welcome Email')
  const logoUrl = await getCompanyLogo('white')

  const html = template?.metadata?.html
    .replace('{{LOGO_URL}}', logoUrl)
    .replace('{{CUSTOMER_EMAIL}}', customerEmail)

  // Send email with template...
}
```

## Troubleshooting

### Assets Not Appearing

1. Check RLS policies are correctly applied
2. Verify storage bucket is set to public
3. Check user has authenticated session
4. Verify asset platform settings include the current platform

### Upload Failing

1. Check file size is under 50MB limit
2. Verify MIME type is in allowed list
3. Check user has admin/manager role
4. Review browser console for specific errors

### Permission Denied

1. Verify user has admin or manager role
2. Check RLS policies in Supabase Dashboard
3. Ensure user is properly authenticated

## Monitoring & Analytics

Track asset usage:
- View usage count in asset details
- Check last_used_at timestamp
- Review audit logs for upload/update/delete history

Query most used assets:
```sql
SELECT name, asset_type, usage_count, last_used_at
FROM shared_assets
ORDER BY usage_count DESC
LIMIT 10;
```

## Future Enhancements

Potential improvements for the asset management system:

1. **Image Transformations**: Auto-resize and optimize images on upload
2. **CDN Integration**: Serve assets through CDN for better performance
3. **Bulk Operations**: Upload/delete multiple assets at once
4. **Advanced Search**: Full-text search with filters
5. **Asset Collections**: Group related assets into collections
6. **Approval Workflow**: Require approval before assets go live
7. **AI Tagging**: Automatically tag assets using AI image recognition
8. **Usage Insights**: Detailed analytics on asset usage across platforms
9. **Asset Expiration**: Set expiration dates for time-sensitive assets
10. **Asset Variants**: Link different sizes/formats of the same asset

## Support

For issues or questions about the asset management system:
- Review this documentation
- Check the SQL migration file: `sql/18-shared-asset-management.sql`
- Review API routes: `src/app/api/assets/`
- Check helper functions: `src/lib/assets/helper.ts`
