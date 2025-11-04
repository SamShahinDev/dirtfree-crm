import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

// =====================================================
// Mock Supabase Client
// =====================================================

export const createMockSupabaseClient = () => {
  const mockSelect = jest.fn().mockReturnThis()
  const mockInsert = jest.fn().mockReturnThis()
  const mockUpdate = jest.fn().mockReturnThis()
  const mockDelete = jest.fn().mockReturnThis()
  const mockEq = jest.fn().mockReturnThis()
  const mockNeq = jest.fn().mockReturnThis()
  const mockGt = jest.fn().mockReturnThis()
  const mockGte = jest.fn().mockReturnThis()
  const mockLt = jest.fn().mockReturnThis()
  const mockLte = jest.fn().mockReturnThis()
  const mockIn = jest.fn().mockReturnThis()
  const mockOrder = jest.fn().mockReturnThis()
  const mockLimit = jest.fn().mockReturnThis()
  const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null })

  return {
    from: jest.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      neq: mockNeq,
      gt: mockGt,
      gte: mockGte,
      lt: mockLt,
      lte: mockLte,
      in: mockIn,
      order: mockOrder,
      limit: mockLimit,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    })),
    rpc: mockRpc,
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      signIn: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
        download: jest.fn().mockResolvedValue({ data: {}, error: null }),
        remove: jest.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://example.com/file' } }),
      })),
    },
  }
}

// =====================================================
// Mock Router
// =====================================================

export const createMockRouter = (overrides = {}) => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  ...overrides,
})

// =====================================================
// Test Data Factories
// =====================================================

export const createMockCustomer = (overrides = {}) => ({
  id: 'customer-1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+15555551234',
  address: '123 Main St',
  city: 'Anytown',
  state: 'CA',
  zip_code: '12345',
  source: 'website',
  created_at: new Date('2024-01-01').toISOString(),
  updated_at: new Date('2024-01-01').toISOString(),
  deleted: false,
  ...overrides,
})

export const createMockJob = (overrides = {}) => ({
  id: 'job-1',
  customer_id: 'customer-1',
  service_type: 'Carpet Cleaning',
  status: 'scheduled',
  scheduled_date: new Date('2024-12-01').toISOString(),
  completed_at: null,
  zone: 'North',
  assigned_to_user_id: 'tech-1',
  booking_source: 'portal',
  estimated_duration: 120,
  actual_duration: null,
  created_at: new Date('2024-11-15').toISOString(),
  updated_at: new Date('2024-11-15').toISOString(),
  ...overrides,
})

export const createMockInvoice = (overrides = {}) => ({
  id: 'invoice-1',
  invoice_number: 'INV-2024-001',
  job_id: 'job-1',
  customer_id: 'customer-1',
  status: 'paid',
  subtotal: 100.0,
  tax_amount: 8.0,
  discount_amount: 0.0,
  total_amount: 108.0,
  due_date: new Date('2024-12-15').toISOString(),
  paid_date: new Date('2024-12-01').toISOString(),
  created_at: new Date('2024-11-15').toISOString(),
  updated_at: new Date('2024-12-01').toISOString(),
  ...overrides,
})

export const createMockUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'technician@example.com',
  first_name: 'Jane',
  last_name: 'Smith',
  phone: '+15555555678',
  created_at: new Date('2024-01-01').toISOString(),
  updated_at: new Date('2024-01-01').toISOString(),
  ...overrides,
})

export const createMockPromotion = (overrides = {}) => ({
  id: 'promo-1',
  code: 'SAVE20',
  description: '20% off carpet cleaning',
  discount_type: 'percentage',
  discount_value: 20,
  valid_from: new Date('2024-01-01').toISOString(),
  valid_until: new Date('2024-12-31').toISOString(),
  active: true,
  max_uses: 100,
  current_uses: 25,
  created_at: new Date('2024-01-01').toISOString(),
  updated_at: new Date('2024-01-01').toISOString(),
  ...overrides,
})

export const createMockLoyaltyCustomer = (overrides = {}) => ({
  customer_id: 'customer-1',
  current_tier_id: 'tier-bronze',
  current_points: 500,
  lifetime_points: 1000,
  tier_progress: 50,
  enrolled_at: new Date('2024-01-01').toISOString(),
  last_activity_at: new Date('2024-11-15').toISOString(),
  ...overrides,
})

export const createMockReview = (overrides = {}) => ({
  id: 'review-1',
  job_id: 'job-1',
  customer_id: 'customer-1',
  rating: 5,
  comment: 'Excellent service!',
  submitted_at: new Date('2024-12-02').toISOString(),
  source: 'portal',
  created_at: new Date('2024-12-02').toISOString(),
  ...overrides,
})

export const createMockOpportunity = (overrides = {}) => ({
  id: 'opportunity-1',
  customer_id: 'customer-1',
  opportunity_type: 'upsell',
  service_type: 'Tile & Grout Cleaning',
  confidence_score: 85,
  estimated_value: 250.0,
  reason: 'Customer has tile floors, no tile cleaning service booked in 6 months',
  status: 'open',
  created_at: new Date('2024-11-15').toISOString(),
  expires_at: new Date('2025-01-15').toISOString(),
  ...overrides,
})

export const createMockReferral = (overrides = {}) => ({
  id: 'referral-1',
  referrer_customer_id: 'customer-1',
  referred_customer_id: 'customer-2',
  status: 'converted',
  reward_points: 100,
  converted_at: new Date('2024-12-01').toISOString(),
  created_at: new Date('2024-11-15').toISOString(),
  ...overrides,
})

// =====================================================
// API Response Helpers
// =====================================================

export const createSuccessResponse = <T,>(data: T) => ({
  success: true,
  data,
  version: 'v1',
  timestamp: new Date().toISOString(),
})

export const createErrorResponse = (error: string, message: string, status = 500) => ({
  success: false,
  error,
  message,
  version: 'v1',
  status,
})

// =====================================================
// Custom Render Function
// =====================================================

interface AllTheProvidersProps {
  children: React.ReactNode
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  // Add any global providers here (e.g., Theme, Router, Auth)
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// =====================================================
// API Testing Utilities
// =====================================================

interface MockRequestOptions {
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: any
  auth?: {
    userId: string
    email?: string
  }
  searchParams?: Record<string, string>
}

/**
 * Create a mock Next.js request for API route testing
 */
export const createMockRequest = (options: MockRequestOptions = {}) => {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    headers = {},
    body,
    auth,
    searchParams = {},
  } = options

  // Build URL with search params
  const urlObj = new URL(url)
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value)
  })

  // Create headers
  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers,
  })

  // Create request
  const request = {
    url: urlObj.toString(),
    method,
    headers: requestHeaders,
    json: async () => body,
    text: async () => JSON.stringify(body),
    formData: async () => new FormData(),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    cache: 'default' as RequestCache,
    credentials: 'same-origin' as RequestCredentials,
    destination: '' as RequestDestination,
    integrity: '',
    keepalive: false,
    mode: 'cors' as RequestMode,
    redirect: 'follow' as RequestRedirect,
    referrer: '',
    referrerPolicy: '' as ReferrerPolicy,
    signal: new AbortController().signal,
    // Add auth context if provided
    _auth: auth,
  }

  return request as any
}

/**
 * Create a mock context for API routes with params
 */
export const createMockContext = (params: Record<string, string> = {}) => ({
  params: Promise.resolve(params),
})

// =====================================================
// Utility Functions
// =====================================================

/**
 * Wait for async operations to complete
 */
export const waitForAsync = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Create a mock fetch response
 */
export const createMockFetchResponse = <T,>(data: T, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
  redirected: false,
  statusText: ok ? 'OK' : 'Error',
  type: 'basic' as ResponseType,
  url: '',
  clone: jest.fn(),
  body: null,
  bodyUsed: false,
  arrayBuffer: jest.fn(),
  blob: jest.fn(),
  formData: jest.fn(),
})

/**
 * Mock fetch globally
 */
export const mockFetch = (response: any) => {
  global.fetch = jest.fn(() => Promise.resolve(response)) as jest.Mock
}

/**
 * Mock fetch with error
 */
export const mockFetchError = (error: string) => {
  global.fetch = jest.fn(() => Promise.reject(new Error(error))) as jest.Mock
}

/**
 * Wait for an element to be removed from the document
 */
export const waitForElementToBeRemoved = async (
  callback: () => HTMLElement | null
) => {
  await new Promise<void>((resolve) => {
    const checkRemoval = () => {
      if (!callback()) {
        resolve()
      } else {
        setTimeout(checkRemoval, 50)
      }
    }
    checkRemoval()
  })
}
