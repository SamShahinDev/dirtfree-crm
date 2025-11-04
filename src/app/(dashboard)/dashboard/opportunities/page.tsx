/**
 * Opportunities Dashboard - Server Component
 *
 * This page demonstrates React Server Components for improved performance:
 * - Server-side data fetching
 * - Streaming with Suspense
 * - No client JavaScript for initial render
 * - Automatic code splitting
 */

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { OpportunityList } from './_components/OpportunityList'
import { OpportunityStats } from './_components/OpportunityStats'
import { OpportunityFilters } from './_components/OpportunityFilters'
import { OpportunityListSkeleton, OpportunityStatsSkeleton } from './_components/Skeletons'
import { Button } from '@/components/ui/button'
import { Plus, Download } from 'lucide-react'

/**
 * Server Component - Fetches opportunities from database
 * This runs on the server and never sends to client
 */
async function fetchOpportunities() {
  const supabase = await createClient()

  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select(\`
      *,
      customers (
        id,
        full_name,
        email,
        phone
      )
    \`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching opportunities:', error)
    return []
  }

  return opportunities || []
}

/**
 * Server Component - Fetches opportunity statistics
 */
async function fetchOpportunityStats() {
  const supabase = await createClient()

  const [
    { count: totalCount },
    { count: newCount },
    { count: qualifiedCount },
    { count: wonCount },
    { data: valueData },
  ] = await Promise.all([
    supabase.from('opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'qualified'),
    supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'won'),
    supabase.from('opportunities').select('estimated_value').eq('status', 'qualified'),
  ])

  const pipelineValue =
    valueData?.reduce((sum, opp) => sum + (opp.estimated_value || 0), 0) || 0

  return {
    total: totalCount || 0,
    new: newCount || 0,
    qualified: qualifiedCount || 0,
    won: wonCount || 0,
    pipelineValue,
  }
}

/**
 * Main Page Component - Server Component
 * This is async and can fetch data directly
 */
export default async function OpportunitiesPage() {
  // Fetch data in parallel on the server
  const [opportunities, stats] = await Promise.all([
    fetchOpportunities(),
    fetchOpportunityStats(),
  ])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Opportunities</h1>
          <p className="text-gray-500 mt-1">Manage your sales pipeline and leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Opportunity
          </Button>
        </div>
      </div>

      {/* Stats Grid - Suspense boundary for streaming */}
      <Suspense fallback={<OpportunityStatsSkeleton />}>
        <OpportunityStats stats={stats} />
      </Suspense>

      {/* Filters - Client Component for interactivity */}
      <OpportunityFilters />

      {/* Opportunities List - Suspense boundary */}
      <Suspense fallback={<OpportunityListSkeleton />}>
        <OpportunityList opportunities={opportunities} />
      </Suspense>
    </div>
  )
}

/**
 * Metadata for SEO and page title
 */
export const metadata = {
  title: 'Opportunities | Dirt Free CRM',
  description: 'Manage your sales pipeline and opportunities',
}

/**
 * Revalidate page data every 60 seconds
 * This enables ISR (Incremental Static Regeneration)
 */
export const revalidate = 60
