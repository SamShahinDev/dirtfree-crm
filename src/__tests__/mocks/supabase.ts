/**
 * Supabase Mock Utilities
 *
 * Provides mock implementations of Supabase client for testing
 */

export interface MockSupabaseClient {
  from: jest.Mock
  rpc: jest.Mock
  auth: {
    getUser: jest.Mock
    signIn: jest.Mock
    signOut: jest.Mock
  }
  storage: {
    from: jest.Mock
  }
}

export const createMockSupabaseClient = (): MockSupabaseClient => {
  const mockSelect = jest.fn().mockReturnThis()
  const mockInsert = jest.fn().mockReturnThis()
  const mockUpdate = jest.fn().mockReturnThis()
  const mockDelete = jest.fn().mockReturnThis()
  const mockUpsert = jest.fn().mockReturnThis()
  const mockEq = jest.fn().mockReturnThis()
  const mockNeq = jest.fn().mockReturnThis()
  const mockGt = jest.fn().mockReturnThis()
  const mockGte = jest.fn().mockReturnThis()
  const mockLt = jest.fn().mockReturnThis()
  const mockLte = jest.fn().mockReturnThis()
  const mockIn = jest.fn().mockReturnThis()
  const mockIs = jest.fn().mockReturnThis()
  const mockIlike = jest.fn().mockReturnThis()
  const mockOrder = jest.fn().mockReturnThis()
  const mockLimit = jest.fn().mockReturnThis()
  const mockRange = jest.fn().mockReturnThis()
  const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })

  // Create chainable query builder with mockResolvedValue support
  const queryBuilder: any = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    upsert: mockUpsert,
    eq: mockEq,
    neq: mockNeq,
    gt: mockGt,
    gte: mockGte,
    lt: mockLt,
    lte: mockLte,
    in: mockIn,
    is: mockIs,
    ilike: mockIlike,
    order: mockOrder,
    limit: mockLimit,
    range: mockRange,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    // Add mockResolvedValue to support chaining like .order().mockResolvedValue()
    mockResolvedValue: jest.fn(function(value: any) {
      mockSingle.mockResolvedValue(value)
      mockMaybeSingle.mockResolvedValue(value)
      return queryBuilder
    }),
  }

  return {
    from: jest.fn(() => queryBuilder),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
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
        getPublicUrl: jest
          .fn()
          .mockReturnValue({ data: { publicUrl: 'http://example.com/file' } }),
      })),
    },
  }
}

/**
 * Mock authenticated user
 */
export const mockAuthenticatedUser = (userId = 'test-user-id', email = 'test@example.com') => ({
  data: {
    user: {
      id: userId,
      email,
      created_at: new Date().toISOString(),
      aud: 'authenticated',
      role: 'authenticated',
    },
  },
  error: null,
})

/**
 * Mock unauthenticated (no user)
 */
export const mockUnauthenticated = () => ({
  data: { user: null },
  error: { message: 'not authenticated', status: 401 },
})

/**
 * Mock database query success
 */
export const mockQuerySuccess = <T>(data: T) => ({
  data,
  error: null,
  count: Array.isArray(data) ? data.length : 1,
  status: 200,
  statusText: 'OK',
})

/**
 * Mock database query error
 */
export const mockQueryError = (message: string, code = 'PGRST116') => ({
  data: null,
  error: {
    message,
    details: '',
    hint: '',
    code,
  },
  count: null,
  status: 400,
  statusText: 'Bad Request',
})

/**
 * Mock RLS policy violation
 */
export const mockRLSViolation = () =>
  mockQueryError('new row violates row-level security policy', '42501')

/**
 * Mock not found error
 */
export const mockNotFound = () => mockQueryError('No rows found', 'PGRST116')
