import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/assets
 * Retrieve shared assets with optional filtering
 * Query params:
 *  - type: Filter by asset_type (logo, image, document, template, video)
 *  - category: Filter by category (branding, marketing, legal, operations, etc.)
 *  - platform: Filter by platform (crm, portal, website) - default: 'crm'
 *  - tags: Comma-separated list of tags to filter by
 *  - search: Search term for name/description
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const platform = searchParams.get('platform') || 'crm'
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const search = searchParams.get('search')

    const supabase = await getServerSupabase()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build query
    let query = supabase
      .from('shared_assets')
      .select('*')
      .contains('platforms', [platform])
      .order('created_at', { ascending: false })

    // Apply filters
    if (type) {
      query = query.eq('asset_type', type)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: assets, error } = await query

    if (error) {
      console.error('Error fetching assets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch assets' },
        { status: 500 }
      )
    }

    return NextResponse.json({ assets: assets || [] })
  } catch (error) {
    console.error('Unexpected error in GET /api/assets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/assets
 * Upload a new asset to the shared asset library
 * FormData fields:
 *  - file: The file to upload
 *  - asset_type: Type of asset (required)
 *  - category: Category (optional)
 *  - name: Asset name (required)
 *  - description: Asset description (optional)
 *  - platforms: JSON array of platforms (optional, defaults to ['crm'])
 *  - tags: JSON array of tags (optional)
 *  - is_public: Boolean (optional, defaults to false)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await getServerSupabase()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role - only admin/manager can upload assets
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData || !['admin', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins and managers can upload assets.' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const assetType = formData.get('asset_type') as string
    const category = formData.get('category') as string | null
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    const platformsStr = formData.get('platforms') as string
    const tagsStr = formData.get('tags') as string
    const isPublicStr = formData.get('is_public') as string

    // Parse JSON fields
    let platforms: string[]
    let tags: string[]

    try {
      platforms = platformsStr ? JSON.parse(platformsStr) : ['crm']
      tags = tagsStr ? JSON.parse(tagsStr) : []
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid JSON in platforms or tags field' },
        { status: 400 }
      )
    }

    const isPublic = isPublicStr === 'true'

    // Validate required fields
    if (!file || !assetType || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: file, asset_type, and name are required' },
        { status: 400 }
      )
    }

    // Validate asset type
    const validAssetTypes = ['logo', 'image', 'document', 'template', 'video']
    if (!validAssetTypes.includes(assetType)) {
      return NextResponse.json(
        { error: `Invalid asset_type. Must be one of: ${validAssetTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 50MB` },
        { status: 413 }
      )
    }

    // Generate unique file name
    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const fileName = `${timestamp}-${random}.${fileExt}`
    const filePath = `${category || 'uncategorized'}/${fileName}`

    // Upload file to Supabase storage
    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('shared-assets')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: `File upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('shared-assets').getPublicUrl(filePath)

    // Get image dimensions if applicable
    let dimensions = null
    if (assetType === 'image' || assetType === 'logo') {
      try {
        dimensions = await getImageDimensions(file)
      } catch (e) {
        console.warn('Failed to get image dimensions:', e)
      }
    }

    // Create asset record
    const { data: asset, error: dbError } = await supabase
      .from('shared_assets')
      .insert({
        asset_type: assetType,
        category,
        name,
        description,
        file_path: filePath,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        dimensions,
        platforms,
        is_public: isPublic,
        tags,
        created_by_user_id: user.id,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)

      // Rollback - delete uploaded file
      await supabase.storage.from('shared-assets').remove([filePath])

      return NextResponse.json(
        { error: `Failed to create asset record: ${dbError.message}` },
        { status: 500 }
      )
    }

    // Create audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'asset_uploaded',
        resource_type: 'shared_asset',
        resource_id: asset.id,
        details: {
          name: asset.name,
          type: asset.asset_type,
          category: asset.category,
          platforms: asset.platforms,
          file_size: asset.file_size,
        },
      })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ success: true, asset }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/assets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to get image dimensions
 */
async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  try {
    // For server-side, we can use createImageBitmap if available
    // Otherwise, return null (dimensions will be null)
    if (typeof createImageBitmap !== 'undefined') {
      const bitmap = await createImageBitmap(file)
      return {
        width: bitmap.width,
        height: bitmap.height,
      }
    }
    return null
  } catch (e) {
    console.warn('Failed to get image dimensions:', e)
    return null
  }
}
