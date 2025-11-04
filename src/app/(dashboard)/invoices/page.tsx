/**
 * Invoices List Page
 * Filterable list of invoices with status, date range, and technician filters
 */

import { Suspense } from 'react'
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server'
import PageShell from "@/components/shell/PageShell"
import { PageHeader } from "@/components/ui/PageHeader"
import { InvoicesTable } from './_components/InvoicesTable'
import { InvoicesFilters } from './_components/InvoicesFilters'
import { InvoicesHeader } from './_components/InvoicesHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { InvoiceStatus } from '@/types/invoice'

// =============================================================================
// SEARCH PARAMS INTERFACE
// =============================================================================

interface InvoicesPageSearchParams {
  status?: InvoiceStatus
  technician?: string
  customer?: string
  dateFrom?: string
  dateTo?: string
  page?: string
  limit?: string
  sort?: string
  order?: 'asc' | 'desc'
}

interface InvoicesPageProps {
  searchParams: InvoicesPageSearchParams
}

// =============================================================================
// DATA FETCHING
// =============================================================================

async function getInvoices(searchParams: InvoicesPageSearchParams) {
  console.log('📄 getInvoices called with params:', JSON.stringify(searchParams, null, 2))

  try {
    // Step 1: Initialize Supabase clients
    console.log('🔧 Initializing Supabase clients...')
    const supabase = await getServerSupabase()
    const serviceSupabase = getServiceSupabase()
    console.log('✅ Supabase clients initialized')

    // Step 2: Verify authentication
    console.log('🔐 Checking authentication...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('❌ Auth error:', {
        message: authError.message,
        name: authError.name,
        status: authError.status
      })
      throw new Error('Authentication failed')
    }

    if (!user) {
      console.error('❌ No user found')
      throw new Error('User not authenticated')
    }

    console.log('✅ User authenticated:', {
      id: user.id,
      email: user.email
    })

    const userRole = user?.user_metadata?.role || user?.raw_user_meta_data?.role
    console.log('👤 User role:', userRole)

    // Step 3: Parse pagination parameters
    const page = parseInt(searchParams.page || '1')
    const limit = parseInt(searchParams.limit || '20')
    const offset = (page - 1) * limit
    console.log('📊 Pagination:', { page, limit, offset })

    // Step 4: Build query using service role to bypass RLS
    console.log('🔨 Building SIMPLE query with service role (no joins)...')
    let query = serviceSupabase
      .from('invoices')
      .select('*', { count: 'exact' })

    // Step 5: Apply filters (simplified - no relationship filters)
    const appliedFilters: string[] = []

    if (searchParams.status) {
      query = query.eq('status', searchParams.status)
      appliedFilters.push(`status=${searchParams.status}`)
    }

    // Skip customer name filter for now (requires join)
    if (searchParams.customer) {
      console.log('⚠️ Customer name filter skipped (requires join)')
      appliedFilters.push(`customer~=${searchParams.customer} (SKIPPED)`)
    }

    if (searchParams.dateFrom) {
      query = query.gte('created_at', searchParams.dateFrom)
      appliedFilters.push(`dateFrom=${searchParams.dateFrom}`)
    }

    if (searchParams.dateTo) {
      query = query.lte('created_at', searchParams.dateTo)
      appliedFilters.push(`dateTo=${searchParams.dateTo}`)
    }

    // Skip technician filter for now (requires join)
    if (searchParams.technician && ['admin', 'dispatcher'].includes(userRole)) {
      console.log('⚠️ Technician filter skipped (requires join)')
      appliedFilters.push(`technician=${searchParams.technician} (SKIPPED)`)
    }

    console.log('🔍 Applied filters:', appliedFilters.length > 0 ? appliedFilters : 'none')

    // Step 6: Apply sorting
    const sortField = searchParams.sort || 'created_at'
    const sortOrder = searchParams.order || 'desc'
    query = query.order(sortField, { ascending: sortOrder === 'asc' })
    console.log('🔄 Sorting:', `${sortField} ${sortOrder}`)

    // Step 7: Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Step 8: Execute query
    console.log('⚡ Executing invoice query...')
    const { data: invoices, error, count } = await query

    // Step 9: Handle errors
    if (error) {
      console.error('❌ Invoice query error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: JSON.stringify(error, null, 2)
      })
      throw new Error(`Failed to fetch invoices: ${error.message}`)
    }

    // Step 10: Log success
    console.log(`✅ Successfully fetched ${invoices?.length || 0} invoices (total: ${count})`)
    if (invoices && invoices.length > 0) {
      console.log('📋 First invoice (full data):', invoices[0])
      console.log('📋 Invoice columns:', Object.keys(invoices[0]))
    } else {
      console.log('⚠️ No invoices found in database')
    }

    return {
      invoices: invoices || [],
      totalCount: count || 0,
      currentPage: page,
      totalPages: Math.ceil((count || 0) / limit)
    }

  } catch (error) {
    console.error('❌ getInvoices exception:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      fullError: JSON.stringify(error, null, 2)
    })
    throw error
  }
}

async function getTechnicians() {
  const supabase = await getServerSupabase()
  const serviceSupabase = getServiceSupabase()

  // Get current user to check permissions
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return []
  }

  const userRole = user?.user_metadata?.role || user?.raw_user_meta_data?.role

  // Only admin/dispatcher can see all technicians
  if (!['admin', 'dispatcher'].includes(userRole)) {
    return []
  }

  const { data: technicians } = await serviceSupabase
    .from('users')
    .select('id, name')
    .eq('role', 'technician')
    .order('name')

  return technicians || []
}

async function getInvoiceStats(searchParams: InvoicesPageSearchParams) {
  console.log('📊 getInvoiceStats called')
  const serviceSupabase = getServiceSupabase()

  let query = serviceSupabase
    .from('invoices')
    .select('status, total_cents')

  // Apply same filters as main query (except pagination and relationship filters)
  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  // Skip customer filter (requires join)
  // if (searchParams.customer) {
  //   query = query.ilike('customer.name', `%${searchParams.customer}%`)
  // }

  if (searchParams.dateFrom) {
    query = query.gte('created_at', searchParams.dateFrom)
  }

  if (searchParams.dateTo) {
    query = query.lte('created_at', searchParams.dateTo)
  }

  const { data: invoices, error } = await query

  if (error) {
    console.error('❌ getInvoiceStats error:', error)
  }

  if (!invoices) {
    return {
      totalCount: 0,
      totalValue: 0,
      draftCount: 0,
      sentCount: 0,
      paidCount: 0,
      voidCount: 0,
      paidValue: 0
    }
  }

  const stats = invoices.reduce(
    (acc, invoice) => {
      acc.totalCount++
      acc.totalValue += invoice.total_cents

      switch (invoice.status) {
        case 'draft':
          acc.draftCount++
          break
        case 'sent':
          acc.sentCount++
          break
        case 'paid':
          acc.paidCount++
          acc.paidValue += invoice.total_cents
          break
        case 'void':
          acc.voidCount++
          break
      }

      return acc
    },
    {
      totalCount: 0,
      totalValue: 0,
      draftCount: 0,
      sentCount: 0,
      paidCount: 0,
      voidCount: 0,
      paidValue: 0
    }
  )

  return stats
}

// =============================================================================
// LOADING COMPONENTS
// =============================================================================

function InvoicesTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// =============================================================================
// PAGE COMPONENTS
// =============================================================================

async function InvoicesContent({ searchParams }: InvoicesPageProps) {
  const [invoicesData, technicians, stats] = await Promise.all([
    getInvoices(searchParams),
    getTechnicians(),
    getInvoiceStats(searchParams)
  ])

  return (
    <div className="space-y-6">
      <InvoicesHeader stats={stats} />

      <InvoicesFilters
        technicians={technicians}
        currentFilters={searchParams}
      />

      <InvoicesTable
        invoices={invoicesData.invoices}
        pagination={{
          currentPage: invoicesData.currentPage,
          totalPages: invoicesData.totalPages,
          totalCount: invoicesData.totalCount
        }}
        currentSort={{
          field: searchParams.sort || 'created_at',
          order: searchParams.order || 'desc'
        }}
      />
    </div>
  )
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function InvoicesPage({ searchParams }: InvoicesPageProps) {
  return (
    <PageShell>
      <div className="space-y-6">
        <PageHeader
          title="Invoices"
          description="Manage invoices, payments, and billing for completed jobs"
        />

        <Suspense
          fallback={
            <div className="space-y-6">
              <StatsCardsSkeleton />
              <div className="section-card">
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <div className="flex space-x-4">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              </div>
              <InvoicesTableSkeleton />
            </div>
          }
        >
          <InvoicesContent searchParams={searchParams} />
        </Suspense>
      </div>
    </PageShell>
  )
}

// =============================================================================
// METADATA
// =============================================================================

export const metadata = {
  title: 'Invoices - Dirt Free CRM',
  description: 'Manage invoices, payments, and billing for completed jobs'
}