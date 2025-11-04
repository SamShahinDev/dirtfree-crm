import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/assets/[id]
 * Retrieve a single asset by ID and track usage
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 })
    }

    // Fetch asset
    const { data: asset, error } = await supabase
      .from('shared_assets')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Track usage asynchronously
    supabase
      .from('shared_assets')
      .update({
        usage_count: (asset.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('Failed to track asset usage:', error)
        }
      })

    return NextResponse.json({ asset })
  } catch (error) {
    console.error('Unexpected error in GET /api/assets/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/assets/[id]
 * Update an existing asset's metadata
 * Body: JSON object with fields to update
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check user role - only admin/manager can update assets
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData || !['admin', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions. Only admins and managers can update assets.',
        },
        { status: 403 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 })
    }

    // Parse request body
    const updates = await req.json()

    // Remove fields that shouldn't be updated directly
    delete updates.id
    delete updates.created_at
    delete updates.created_by_user_id
    delete updates.file_path
    delete updates.file_url
    delete updates.file_size
    delete updates.usage_count
    delete updates.last_used_at

    // Validate asset_type if provided
    if (updates.asset_type) {
      const validAssetTypes = ['logo', 'image', 'document', 'template', 'video']
      if (!validAssetTypes.includes(updates.asset_type)) {
        return NextResponse.json(
          {
            error: `Invalid asset_type. Must be one of: ${validAssetTypes.join(', ')}`,
          },
          { status: 400 }
        )
      }
    }

    // Get current asset for audit log
    const { data: oldAsset } = await supabase
      .from('shared_assets')
      .select('*')
      .eq('id', id)
      .single()

    // Update asset
    const { data: asset, error } = await supabase
      .from('shared_assets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database update error:', error)
      return NextResponse.json(
        { error: `Failed to update asset: ${error.message}` },
        { status: 500 }
      )
    }

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Create audit log
    try {
      const changes: Record<string, any> = {}
      if (oldAsset) {
        for (const key in updates) {
          if (updates[key] !== oldAsset[key]) {
            changes[key] = {
              old: oldAsset[key],
              new: updates[key],
            }
          }
        }
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'asset_updated',
        resource_type: 'shared_asset',
        resource_id: asset.id,
        details: {
          name: asset.name,
          changes,
        },
      })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ success: true, asset })
  } catch (error) {
    console.error('Unexpected error in PATCH /api/assets/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/assets/[id]
 * Delete an asset and its associated file from storage
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check user role - only admin/manager can delete assets
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData || !['admin', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions. Only admins and managers can delete assets.',
        },
        { status: 403 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 })
    }

    // Get asset to retrieve file path
    const { data: asset } = await supabase
      .from('shared_assets')
      .select('*')
      .eq('id', id)
      .single()

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Delete file from storage
    if (asset.file_path) {
      const { error: storageError } = await supabase.storage
        .from('shared-assets')
        .remove([asset.file_path])

      if (storageError) {
        console.error('Storage deletion error:', storageError)
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete asset record
    const { error } = await supabase.from('shared_assets').delete().eq('id', id)

    if (error) {
      console.error('Database deletion error:', error)
      return NextResponse.json(
        { error: `Failed to delete asset: ${error.message}` },
        { status: 500 }
      )
    }

    // Create audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'asset_deleted',
        resource_type: 'shared_asset',
        resource_id: id,
        details: {
          name: asset.name,
          asset_type: asset.asset_type,
          category: asset.category,
          file_path: asset.file_path,
        },
      })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/assets/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
