import { unstable_cache } from 'next/cache'
import { getServerSupabase } from '@/lib/supabase/server'

// Types for cached data
export type CachedCustomer = {
  id: string
  name: string
  email?: string
  phone?: string
  zone?: string
  created_at: string
  updated_at: string
}

export type CachedJob = {
  id: string
  customer_id: string
  scheduled_date: string
  status: string
  assigned_to?: string
}

// Cache tags for invalidation
export const CACHE_TAGS = {
  customers: 'customers',
  customerDetail: (id: string) => `customer-${id}`,
  jobs: 'jobs',
  jobDetail: (id: string) => `job-${id}`,
  zones: 'zones',
  invoices: 'invoices',
  invoiceDetail: (id: string) => `invoice-${id}`,
  technicians: 'technicians',
  dashboard: 'dashboard',
  trucks: 'trucks'
} as const

// Cache customer list for 5 minutes
export const getCachedCustomers = unstable_cache(
  async (page: number = 1, pageSize: number = 25, search?: string, zone?: string) => {
    const supabase = await getServerSupabase()

    let query = supabase
      .from('customers')
      .select('*, service_history(count), jobs(count)', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone_e164.ilike.%${search}%`)
    }

    // Apply zone filter
    if (zone && zone !== 'all') {
      query = query.eq('zone', zone)
    }

    // Apply pagination
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1
    query = query.range(start, end)

    const { data, error, count } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return {
      rows: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  },
  ['customers-list'],
  {
    revalidate: 300, // 5 minutes
    tags: [CACHE_TAGS.customers]
  }
)

// Cache individual customer for 10 minutes
export const getCachedCustomer = unstable_cache(
  async (id: string) => {
    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        service_history(*),
        jobs(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },
  ['customer-detail'],
  {
    revalidate: 600, // 10 minutes
    tags: [(id: string) => CACHE_TAGS.customerDetail(id)]
  }
)

// Cache zones list for 1 hour
export const getCachedZones = unstable_cache(
  async () => {
    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  },
  ['zones-list'],
  {
    revalidate: 3600, // 1 hour
    tags: [CACHE_TAGS.zones]
  }
)

// Cache jobs list for 3 minutes
export const getCachedJobs = unstable_cache(
  async (filters?: {
    status?: string
    date?: string
    technician?: string
    page?: number
    pageSize?: number
  }) => {
    const supabase = await getServerSupabase()
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 25

    let query = supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(name, address_line1, city, phone_e164),
        technician:technicians(user:users(full_name))
      `, { count: 'exact' })

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.date) {
      query = query.gte('scheduled_date', filters.date)
        .lt('scheduled_date', `${filters.date}T23:59:59`)
    }

    if (filters?.technician) {
      query = query.eq('assigned_to', filters.technician)
    }

    // Apply pagination
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1
    query = query.range(start, end)

    const { data, error, count } = await query.order('scheduled_date', { ascending: true })

    if (error) throw error

    return {
      rows: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  },
  ['jobs-list'],
  {
    revalidate: 180, // 3 minutes
    tags: [CACHE_TAGS.jobs]
  }
)

// Cache dashboard stats for 2 minutes
export const getCachedDashboardStats = unstable_cache(
  async () => {
    const supabase = await getServerSupabase()

    // Fetch multiple stats in parallel
    const [customersResult, jobsResult, revenueResult] = await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('jobs').select('status', { count: 'exact' }),
      supabase.from('invoices').select('total, status')
    ])

    const stats = {
      totalCustomers: customersResult.count || 0,
      activeJobs: jobsResult.data?.filter(j => j.status === 'in_progress').length || 0,
      completedJobs: jobsResult.data?.filter(j => j.status === 'completed').length || 0,
      totalRevenue: revenueResult.data?.reduce((sum, inv) =>
        inv.status === 'paid' ? sum + (inv.total || 0) : sum, 0
      ) || 0
    }

    return stats
  },
  ['dashboard-stats'],
  {
    revalidate: 120, // 2 minutes
    tags: [CACHE_TAGS.dashboard]
  }
)

// Cache technicians list for 30 minutes
export const getCachedTechnicians = unstable_cache(
  async () => {
    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('technicians')
      .select(`
        *,
        user:users(id, full_name, email, avatar_url)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },
  ['technicians-list'],
  {
    revalidate: 1800, // 30 minutes
    tags: [CACHE_TAGS.technicians]
  }
)

// Cache invoice data for 5 minutes
export const getCachedInvoice = unstable_cache(
  async (id: string) => {
    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(*),
        job:jobs(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },
  ['invoice-detail'],
  {
    revalidate: 300, // 5 minutes
    tags: [(id: string) => CACHE_TAGS.invoiceDetail(id)]
  }
)

// Helper to invalidate cache programmatically
export async function invalidateCache(tags: string | string[]) {
  if (typeof window === 'undefined') {
    const { revalidateTag } = await import('next/cache')
    const tagsArray = Array.isArray(tags) ? tags : [tags]
    tagsArray.forEach(tag => revalidateTag(tag))
  }
}

// Helper to invalidate all caches
export async function invalidateAllCaches() {
  await invalidateCache(Object.values(CACHE_TAGS).filter(v => typeof v === 'string'))
}