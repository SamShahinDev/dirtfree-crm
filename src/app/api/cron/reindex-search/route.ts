// Reindex Search Cron Job
// Rebuilds the search index for all entities

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { indexCustomer, indexJob, indexInvoice, reindexEntityType } from '@/lib/search/indexer';

// ============================================================================
// POST /api/cron/reindex-search
// Reindexes all searchable entities
// ============================================================================

/**
 * This endpoint should be called by a cron job to periodically reindex
 * all searchable entities. This ensures the search index stays in sync
 * with the database.
 *
 * Recommended schedule: Weekly (0 0 * * 0)
 *
 * Security: Requires CRON_SECRET in Authorization header
 *
 * Example cURL:
 * curl -X POST https://crm.dirtfreecarpet.com/api/cron/reindex-search \
 *   -H "Authorization: Bearer your-cron-secret"
 */
export async function POST(req: NextRequest) {
  try {
    // ========================================================================
    // Verify Authorization
    // ========================================================================

    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron job not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron job attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ========================================================================
    // Get Reindex Parameters
    // ========================================================================

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('type'); // Optional: reindex specific type
    const limit = parseInt(searchParams.get('limit') || '1000', 10); // Batch size

    const supabase = createClient();
    const startTime = Date.now();
    const stats = {
      customers: 0,
      jobs: 0,
      invoices: 0,
      total: 0,
      errors: [] as string[],
    };

    console.log('Starting search reindex...', { entityType, limit });

    // ========================================================================
    // Reindex Customers
    // ========================================================================

    if (!entityType || entityType === 'customer') {
      try {
        console.log('Reindexing customers...');
        const { data: customers } = await supabase
          .from('customers')
          .select('id')
          .limit(limit);

        if (customers) {
          for (const customer of customers) {
            try {
              await indexCustomer(customer.id);
              stats.customers++;
            } catch (error) {
              console.error(`Error indexing customer ${customer.id}:`, error);
              stats.errors.push(`customer:${customer.id}`);
            }
          }
        }

        console.log(`Indexed ${stats.customers} customers`);
      } catch (error) {
        console.error('Error reindexing customers:', error);
        stats.errors.push('customers:bulk');
      }
    }

    // ========================================================================
    // Reindex Jobs
    // ========================================================================

    if (!entityType || entityType === 'job') {
      try {
        console.log('Reindexing jobs...');
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id')
          .limit(limit);

        if (jobs) {
          for (const job of jobs) {
            try {
              await indexJob(job.id);
              stats.jobs++;
            } catch (error) {
              console.error(`Error indexing job ${job.id}:`, error);
              stats.errors.push(`job:${job.id}`);
            }
          }
        }

        console.log(`Indexed ${stats.jobs} jobs`);
      } catch (error) {
        console.error('Error reindexing jobs:', error);
        stats.errors.push('jobs:bulk');
      }
    }

    // ========================================================================
    // Reindex Invoices
    // ========================================================================

    if (!entityType || entityType === 'invoice') {
      try {
        console.log('Reindexing invoices...');
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id')
          .limit(limit);

        if (invoices) {
          for (const invoice of invoices) {
            try {
              await indexInvoice(invoice.id);
              stats.invoices++;
            } catch (error) {
              console.error(`Error indexing invoice ${invoice.id}:`, error);
              stats.errors.push(`invoice:${invoice.id}`);
            }
          }
        }

        console.log(`Indexed ${stats.invoices} invoices`);
      } catch (error) {
        console.error('Error reindexing invoices:', error);
        stats.errors.push('invoices:bulk');
      }
    }

    // ========================================================================
    // Calculate Total and Duration
    // ========================================================================

    stats.total = stats.customers + stats.jobs + stats.invoices;
    const duration = Date.now() - startTime;
    const durationSeconds = (duration / 1000).toFixed(2);

    console.log('Reindex complete!', {
      duration: `${durationSeconds}s`,
      stats,
    });

    // ========================================================================
    // Log Reindex Activity
    // ========================================================================

    await supabase.from('cron_logs').insert({
      job_name: 'reindex_search',
      status: stats.errors.length > 0 ? 'completed_with_errors' : 'success',
      duration_ms: duration,
      metadata: {
        stats,
        entityType,
        limit,
      },
      created_at: new Date().toISOString(),
    });

    // ========================================================================
    // Return Results
    // ========================================================================

    return NextResponse.json({
      success: true,
      message: 'Search reindex completed',
      duration: `${durationSeconds}s`,
      stats,
    });
  } catch (error) {
    console.error('Reindex cron job error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reindex failed',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/cron/reindex-search
// Get reindex status/stats
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createClient();

    // Get search index stats
    const { data: stats } = await supabase.rpc('search_stats');

    // Get recent reindex jobs
    const { data: recentJobs } = await supabase
      .from('cron_logs')
      .select('*')
      .eq('job_name', 'reindex_search')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      stats,
      recentJobs,
    });
  } catch (error) {
    console.error('Error fetching reindex stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stats',
      },
      { status: 500 }
    );
  }
}
