/**
 * Shared Asset Helper Utilities
 *
 * These utilities provide easy access to shared assets across all platforms.
 * Can be used in CRM, Portal, and Website applications.
 */

export interface SharedAsset {
  id: string
  asset_type: 'logo' | 'image' | 'document' | 'template' | 'video'
  category: string | null
  name: string
  description: string | null
  file_path: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  dimensions: { width: number; height: number } | null
  platforms: string[]
  is_public: boolean
  version: number
  previous_version_id: string | null
  tags: string[] | null
  metadata: Record<string, any> | null
  usage_count: number
  last_used_at: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Get a single asset by ID
 * @param assetId - The UUID of the asset
 * @returns The asset object
 */
export async function getAsset(assetId: string): Promise<SharedAsset> {
  const response = await fetch(`/api/assets/${assetId}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Asset not found')
  }

  const data = await response.json()
  return data.asset
}

/**
 * Get all assets of a specific type
 * @param type - The asset type (logo, image, document, template, video)
 * @param platform - The platform filter (default: 'crm')
 * @returns Array of assets
 */
export async function getAssetsByType(
  type: SharedAsset['asset_type'],
  platform: string = 'crm'
): Promise<SharedAsset[]> {
  const response = await fetch(`/api/assets?type=${type}&platform=${platform}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch assets')
  }

  const data = await response.json()
  return data.assets || []
}

/**
 * Get all assets in a specific category
 * @param category - The category name (branding, marketing, legal, operations, etc.)
 * @param platform - The platform filter (default: 'crm')
 * @returns Array of assets
 */
export async function getAssetsByCategory(
  category: string,
  platform: string = 'crm'
): Promise<SharedAsset[]> {
  const response = await fetch(
    `/api/assets?category=${category}&platform=${platform}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch assets')
  }

  const data = await response.json()
  return data.assets || []
}

/**
 * Get assets by tags
 * @param tags - Array of tags to search for
 * @param platform - The platform filter (default: 'crm')
 * @returns Array of assets matching any of the tags
 */
export async function getAssetsByTags(
  tags: string[],
  platform: string = 'crm'
): Promise<SharedAsset[]> {
  const tagsParam = tags.join(',')
  const response = await fetch(
    `/api/assets?tags=${tagsParam}&platform=${platform}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch assets')
  }

  const data = await response.json()
  return data.assets || []
}

/**
 * Search assets by name or description
 * @param searchTerm - The search term
 * @param platform - The platform filter (default: 'crm')
 * @returns Array of matching assets
 */
export async function searchAssets(
  searchTerm: string,
  platform: string = 'crm'
): Promise<SharedAsset[]> {
  const response = await fetch(
    `/api/assets?search=${encodeURIComponent(searchTerm)}&platform=${platform}`
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to search assets')
  }

  const data = await response.json()
  return data.assets || []
}

/**
 * Get the company logo by variant
 * @param variant - Logo variant (primary, white, icon, etc.)
 * @param platform - The platform filter (default: 'all')
 * @returns The logo URL or null if not found
 */
export async function getCompanyLogo(
  variant: 'primary' | 'white' | 'icon' | 'dark' = 'primary',
  platform: string = 'all'
): Promise<string | null> {
  try {
    const logos = await getAssetsByType('logo', platform)
    const logo = logos.find((l) => l.tags?.includes(variant))
    return logo?.file_url || null
  } catch (error) {
    console.error('Failed to get company logo:', error)
    return null
  }
}

/**
 * Get an email template by name
 * @param templateName - The name of the template
 * @param platform - The platform filter (default: 'all')
 * @returns The template asset or null if not found
 */
export async function getEmailTemplate(
  templateName: string,
  platform: string = 'all'
): Promise<SharedAsset | null> {
  try {
    const templates = await getAssetsByCategory('templates', platform)
    const template = templates.find((t) => t.name === templateName)
    return template || null
  } catch (error) {
    console.error('Failed to get email template:', error)
    return null
  }
}

/**
 * Get branding colors from the brand asset
 * @returns Object with color values or default colors
 */
export async function getBrandingColors(): Promise<{
  primary: string
  secondary: string
  accent: string
  [key: string]: string
}> {
  try {
    const branding = await getAssetsByCategory('branding', 'all')
    const colorsAsset = branding.find((a) => a.name === 'Brand Colors')

    if (colorsAsset?.metadata?.colors) {
      return colorsAsset.metadata.colors
    }

    // Return default colors if not found
    return {
      primary: '#1e40af',
      secondary: '#64748b',
      accent: '#f59e0b',
    }
  } catch (error) {
    console.error('Failed to get branding colors:', error)
    // Return default colors on error
    return {
      primary: '#1e40af',
      secondary: '#64748b',
      accent: '#f59e0b',
    }
  }
}

/**
 * Get branding fonts from the brand asset
 * @returns Object with font family names or defaults
 */
export async function getBrandingFonts(): Promise<{
  primary: string
  secondary: string
  heading: string
  [key: string]: string
}> {
  try {
    const branding = await getAssetsByCategory('branding', 'all')
    const fontsAsset = branding.find((a) => a.name === 'Brand Fonts')

    if (fontsAsset?.metadata?.fonts) {
      return fontsAsset.metadata.fonts
    }

    // Return default fonts if not found
    return {
      primary: 'Inter, system-ui, sans-serif',
      secondary: 'Georgia, serif',
      heading: 'Inter, system-ui, sans-serif',
    }
  } catch (error) {
    console.error('Failed to get branding fonts:', error)
    // Return default fonts on error
    return {
      primary: 'Inter, system-ui, sans-serif',
      secondary: 'Georgia, serif',
      heading: 'Inter, system-ui, sans-serif',
    }
  }
}

/**
 * Get all marketing materials
 * @param platform - The platform filter (default: 'all')
 * @returns Array of marketing assets
 */
export async function getMarketingMaterials(
  platform: string = 'all'
): Promise<SharedAsset[]> {
  return getAssetsByCategory('marketing', platform)
}

/**
 * Get all legal documents
 * @param platform - The platform filter (default: 'all')
 * @returns Array of legal document assets
 */
export async function getLegalDocuments(
  platform: string = 'all'
): Promise<SharedAsset[]> {
  return getAssetsByCategory('legal', platform)
}

/**
 * Get all operational documents
 * @param platform - The platform filter (default: 'all')
 * @returns Array of operational document assets
 */
export async function getOperationalDocuments(
  platform: string = 'all'
): Promise<SharedAsset[]> {
  return getAssetsByCategory('operations', platform)
}

/**
 * Get all training materials
 * @param platform - The platform filter (default: 'all')
 * @returns Array of training material assets
 */
export async function getTrainingMaterials(
  platform: string = 'all'
): Promise<SharedAsset[]> {
  return getAssetsByCategory('training', platform)
}

/**
 * Upload a new asset
 * @param file - The file to upload
 * @param metadata - Asset metadata
 * @returns The created asset
 */
export async function uploadAsset(
  file: File,
  metadata: {
    asset_type: SharedAsset['asset_type']
    name: string
    category?: string
    description?: string
    platforms?: string[]
    tags?: string[]
    is_public?: boolean
  }
): Promise<SharedAsset> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('asset_type', metadata.asset_type)
  formData.append('name', metadata.name)

  if (metadata.category) {
    formData.append('category', metadata.category)
  }

  if (metadata.description) {
    formData.append('description', metadata.description)
  }

  if (metadata.platforms) {
    formData.append('platforms', JSON.stringify(metadata.platforms))
  }

  if (metadata.tags) {
    formData.append('tags', JSON.stringify(metadata.tags))
  }

  if (metadata.is_public !== undefined) {
    formData.append('is_public', String(metadata.is_public))
  }

  const response = await fetch('/api/assets', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload asset')
  }

  const data = await response.json()
  return data.asset
}

/**
 * Update an existing asset's metadata
 * @param assetId - The asset ID
 * @param updates - Fields to update
 * @returns The updated asset
 */
export async function updateAsset(
  assetId: string,
  updates: Partial<
    Pick<
      SharedAsset,
      | 'name'
      | 'description'
      | 'category'
      | 'tags'
      | 'platforms'
      | 'is_public'
      | 'metadata'
    >
  >
): Promise<SharedAsset> {
  const response = await fetch(`/api/assets/${assetId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update asset')
  }

  const data = await response.json()
  return data.asset
}

/**
 * Delete an asset
 * @param assetId - The asset ID
 */
export async function deleteAsset(assetId: string): Promise<void> {
  const response = await fetch(`/api/assets/${assetId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete asset')
  }
}

/**
 * Get asset categories
 * @returns Array of category names
 */
export function getAssetCategories(): string[] {
  return [
    'branding',
    'marketing',
    'legal',
    'operations',
    'training',
    'templates',
  ]
}

/**
 * Get asset types
 * @returns Array of asset type names
 */
export function getAssetTypes(): SharedAsset['asset_type'][] {
  return ['logo', 'image', 'document', 'template', 'video']
}
