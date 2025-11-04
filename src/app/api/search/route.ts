// Unified Search API
// Cross-platform search across CRM, Portal, and Website

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// GET /api/search
// Search across all platforms or filtered by platform/entity type
// ============================================================================

/**
 * Query Parameters:
 * - q: Search query (required, min 2 characters)
 * - platform: Filter by platform (crm|portal|website|all) [default: all]
 * - type: Filter by entity type (customer|job|invoice|service|page)
 * - limit: Max results to return [default: 20, max: 100]
 * - tags: Filter by tags (comma-separated)
 *
 * Examples:
 * - /api/search?q=carpet cleaning
 * - /api/search?q=john&platform=crm&type=customer
 * - /api/search?q=invoice&platform=portal&limit=10
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // ========================================================================
    // Parse Query Parameters
    // ========================================================================

    const query = searchParams.get('q');
    const platform = searchParams.get('platform') || 'all';
    const entityType = searchParams.get('type');
    const limitParam = searchParams.get('limit');
    const tagsParam = searchParams.get('tags');

    // Validate query
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Search query must be at least 2 characters',
        results: [],
      });
    }

    // Parse limit (max 100)
    const limit = Math.min(parseInt(limitParam || '20', 10), 100);

    // Parse tags
    const tags = tagsParam
      ? tagsParam.split(',').map((tag) => tag.trim().toLowerCase())
      : null;

    const supabase = createClient();

    // ========================================================================
    // Build Search Query
    // ========================================================================

    // Use PostgreSQL full-text search
    let searchQuery = supabase
      .from('search_index')
      .select('*')
      .textSearch('search_vector', query, {
        type: 'websearch',
        config: 'english',
      })
      .limit(limit);

    // Apply platform filter
    if (platform && platform !== 'all') {
      searchQuery = searchQuery.eq('platform', platform);
    }

    // Apply entity type filter
    if (entityType) {
      searchQuery = searchQuery.eq('entity_type', entityType);
    }

    // Apply tags filter (array contains any of the specified tags)
    if (tags && tags.length > 0) {
      searchQuery = searchQuery.overlaps('tags', tags);
    }

    // Execute search
    const { data: results, error } = await searchQuery;

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Search failed',
          message: error.message,
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // Group Results by Platform
    // ========================================================================

    const grouped = {
      crm: results.filter((r) => r.platform === 'crm'),
      portal: results.filter((r) => r.platform === 'portal'),
      website: results.filter((r) => r.platform === 'website'),
    };

    // ========================================================================
    // Calculate Statistics
    // ========================================================================

    const stats = {
      total: results.length,
      byPlatform: {
        crm: grouped.crm.length,
        portal: grouped.portal.length,
        website: grouped.website.length,
      },
      byEntityType: results.reduce((acc, r) => {
        acc[r.entity_type] = (acc[r.entity_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // ========================================================================
    // Return Results
    // ========================================================================

    return NextResponse.json({
      success: true,
      query,
      platform,
      entityType: entityType || 'all',
      total: results.length,
      limit,
      results,
      grouped,
      stats,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS handler for CORS
// ============================================================================

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
