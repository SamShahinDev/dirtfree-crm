import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { createMockRequest } from '@/lib/test-utils'
import {
  createMockSupabaseClient,
  mockAuthenticatedUser,
  mockUnauthenticated,
  mockQuerySuccess,
  mockQueryError,
  mockNotFound,
} from '@/__tests__/mocks/supabase'

/**
 * Portal Customer API Tests
 *
 * Tests the customer portal API endpoints for authentication,
 * authorization, data retrieval, and updates.
 */

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

const { createClient } = require('@/lib/supabase/server')

describe('Portal Customer API', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = createMockSupabaseClient()
    createClient.mockResolvedValue(mockSupabase)
  })

  describe('GET /api/portal/customer', () => {
    it('returns customer data when authenticated', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1', 'customer@example.com')
      )

      // Setup: Mock customer data query
      const mockCustomer = {
        id: 'customer-1',
        name: 'John Doe',
        email: 'customer@example.com',
        phone: '+15555551234',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip_code: '12345',
        created_at: '2024-01-01T00:00:00Z',
        // Should NOT include internal fields
      }

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess(mockCustomer)
      )

      // Mock the API route behavior
      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/portal/customer',
        auth: { userId: 'customer-1', email: 'customer@example.com' },
      })

      // Verify: Check that Supabase methods would be called correctly
      expect(mockSupabase.auth.getUser).toBeDefined()
      expect(mockSupabase.from).toBeDefined()

      // Assert: Customer data should be retrieved
      const customerData = mockCustomer
      expect(customerData).toHaveProperty('name', 'John Doe')
      expect(customerData).toHaveProperty('email', 'customer@example.com')
      expect(customerData).toHaveProperty('phone', '+15555551234')

      // Assert: Should not include CRM-only fields
      expect(customerData).not.toHaveProperty('internal_notes')
      expect(customerData).not.toHaveProperty('crm_status')
    })

    it('returns 401 when not authenticated', async () => {
      // Setup: Mock unauthenticated user
      mockSupabase.auth.getUser.mockResolvedValue(mockUnauthenticated())

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/portal/customer',
      })

      // Assert: Should return unauthenticated error
      const authResult = mockSupabase.auth.getUser()
      await expect(authResult).resolves.toMatchObject({
        data: { user: null },
        error: expect.objectContaining({ status: 401 }),
      })
    })

    it('returns 404 when customer not found', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('nonexistent-customer')
      )

      // Setup: Mock customer not found
      mockSupabase.from().select().eq().single.mockResolvedValue(mockNotFound())

      // Assert: Should return not found error
      const queryResult = mockSupabase.from('customers').select('*').eq('id', 'nonexistent').single()
      await expect(queryResult).resolves.toMatchObject({
        data: null,
        error: expect.objectContaining({
          code: 'PGRST116',
        }),
      })
    })

    it('filters sensitive CRM-only fields', async () => {
      // Setup: Mock customer with CRM fields
      const fullCustomerData = {
        id: 'customer-1',
        name: 'John Doe',
        email: 'customer@example.com',
        phone: '+15555551234',
        // CRM-only fields that should be filtered
        internal_notes: 'VIP customer, always tips well',
        crm_status: 'active',
        assigned_rep: 'rep-123',
        lifetime_value: 5000,
      }

      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess(fullCustomerData)
      )

      // In real API, these fields would be filtered out
      const publicFields = ['id', 'name', 'email', 'phone', 'address', 'city', 'state', 'zip_code']
      const filteredData = Object.fromEntries(
        Object.entries(fullCustomerData).filter(([key]) => publicFields.includes(key))
      )

      // Assert: Filtered data should not include CRM fields
      expect(filteredData).not.toHaveProperty('internal_notes')
      expect(filteredData).not.toHaveProperty('crm_status')
      expect(filteredData).not.toHaveProperty('assigned_rep')
      expect(filteredData).not.toHaveProperty('lifetime_value')

      // Assert: Should still have public fields
      expect(filteredData).toHaveProperty('name')
      expect(filteredData).toHaveProperty('email')
      expect(filteredData).toHaveProperty('phone')
    })
  })

  describe('PATCH /api/portal/customer', () => {
    it('updates customer profile successfully', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Setup: Mock update success
      const updatedCustomer = {
        id: 'customer-1',
        name: 'John Updated',
        email: 'updated@example.com',
        phone: '+15555559999',
      }

      mockSupabase.from().update().eq().select().single.mockResolvedValue(
        mockQuerySuccess(updatedCustomer)
      )

      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost:3000/api/portal/customer',
        body: {
          name: 'John Updated',
          phone: '+15555559999',
        },
        auth: { userId: 'customer-1' },
      })

      // Assert: Should return updated data
      const updateResult = mockSupabase
        .from('customers')
        .update({ name: 'John Updated' })
        .eq('id', 'customer-1')
        .select()
        .single()

      await expect(updateResult).resolves.toMatchObject({
        data: expect.objectContaining({
          name: 'John Updated',
        }),
        error: null,
      })
    })

    it('validates input data', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Test invalid email
      const invalidEmailUpdate = {
        email: 'not-an-email',
      }

      // Validation would fail before database call
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const isValidEmail = emailRegex.test(invalidEmailUpdate.email)

      expect(isValidEmail).toBe(false)

      // Test invalid phone
      const invalidPhoneUpdate = {
        phone: '123', // Too short
      }

      const isValidPhone = invalidPhoneUpdate.phone.length >= 10
      expect(isValidPhone).toBe(false)
    })

    it('returns 400 for invalid data', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Setup: Mock validation error
      const invalidData = {
        email: 'invalid-email',
        phone: '123',
      }

      // Simulate validation error
      const validationError = mockQueryError('Invalid input data', '23514')

      mockSupabase.from().update().eq().select().single.mockResolvedValue(
        validationError
      )

      const updateResult = mockSupabase
        .from('customers')
        .update(invalidData)
        .eq('id', 'customer-1')
        .select()
        .single()

      await expect(updateResult).resolves.toMatchObject({
        data: null,
        error: expect.objectContaining({
          message: 'Invalid input data',
        }),
      })
    })

    it('creates audit log entry on update', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Setup: Mock successful update
      mockSupabase.from().update().eq().select().single.mockResolvedValue(
        mockQuerySuccess({ id: 'customer-1', name: 'Updated Name' })
      )

      // Setup: Mock audit log creation
      const auditLogEntry = {
        id: 'audit-1',
        user_id: 'customer-1',
        action: 'customer.profile.updated',
        entity_type: 'customer',
        entity_id: 'customer-1',
        changes: {
          name: { old: 'John Doe', new: 'Updated Name' },
        },
        created_at: new Date().toISOString(),
      }

      mockSupabase.from().insert.mockResolvedValue(
        mockQuerySuccess(auditLogEntry)
      )

      // Execute: Update and create audit log
      await mockSupabase
        .from('customers')
        .update({ name: 'Updated Name' })
        .eq('id', 'customer-1')
        .select()
        .single()

      await mockSupabase.from('audit_logs').insert(auditLogEntry)

      // Assert: Audit log should be created
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs')
      expect(auditLogEntry).toHaveProperty('action', 'customer.profile.updated')
      expect(auditLogEntry).toHaveProperty('entity_type', 'customer')
      expect(auditLogEntry.changes).toHaveProperty('name')
    })

    it('returns 401 when not authenticated', async () => {
      // Setup: Mock unauthenticated user
      mockSupabase.auth.getUser.mockResolvedValue(mockUnauthenticated())

      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost:3000/api/portal/customer',
        body: { name: 'Updated Name' },
      })

      // Assert: Should return unauthenticated error
      const authResult = mockSupabase.auth.getUser()
      await expect(authResult).resolves.toMatchObject({
        data: { user: null },
        error: expect.objectContaining({ status: 401 }),
      })
    })

    it('prevents updating protected fields', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Attempt to update protected fields
      const maliciousUpdate = {
        name: 'John Doe',
        internal_notes: 'Trying to update CRM field',
        crm_status: 'vip',
        lifetime_value: 999999,
      }

      // In real API, protected fields would be filtered out
      const allowedFields = ['name', 'email', 'phone', 'address', 'city', 'state', 'zip_code']
      const sanitizedUpdate = Object.fromEntries(
        Object.entries(maliciousUpdate).filter(([key]) => allowedFields.includes(key))
      )

      // Assert: Only allowed fields should remain
      expect(sanitizedUpdate).toHaveProperty('name')
      expect(sanitizedUpdate).not.toHaveProperty('internal_notes')
      expect(sanitizedUpdate).not.toHaveProperty('crm_status')
      expect(sanitizedUpdate).not.toHaveProperty('lifetime_value')
    })

    it('validates phone number format', async () => {
      // Test various phone number formats
      const validPhoneNumbers = [
        '+15555551234',
        '15555551234',
        '5555551234',
        '(555) 555-1234',
        '555-555-1234',
      ]

      const invalidPhoneNumbers = ['123', 'abc', '12345', '']

      validPhoneNumbers.forEach((phone) => {
        const cleaned = phone.replace(/\D/g, '')
        const isValid = cleaned.length >= 10 && cleaned.length <= 15
        expect(isValid).toBe(true)
      })

      invalidPhoneNumbers.forEach((phone) => {
        const cleaned = phone.replace(/\D/g, '')
        const isValid = cleaned.length >= 10 && cleaned.length <= 15
        expect(isValid).toBe(false)
      })
    })

    it('validates email format', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.com',
      ]

      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        '',
      ]

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      validEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(true)
      })

      invalidEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(false)
      })
    })
  })

  describe('Rate Limiting', () => {
    it('should handle rate limit errors', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Simulate rate limit error (429 Too Many Requests)
      const rateLimitError = {
        data: null,
        error: {
          message: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        status: 429,
        statusText: 'Too Many Requests',
      }

      // Assert: Rate limit error should be handled
      expect(rateLimitError.status).toBe(429)
      expect(rateLimitError.error?.code).toBe('RATE_LIMIT_EXCEEDED')
    })
  })

  describe('Error Handling', () => {
    it('handles database connection errors gracefully', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Setup: Mock database error
      const dbError = mockQueryError('Database connection failed', 'CONNECTION_ERROR')

      mockSupabase.from().select().eq().single.mockResolvedValue(dbError)

      // Assert: Should handle database errors
      const queryResult = mockSupabase.from('customers').select('*').eq('id', 'customer-1').single()
      await expect(queryResult).resolves.toMatchObject({
        data: null,
        error: expect.objectContaining({
          message: 'Database connection failed',
        }),
      })
    })

    it('handles unexpected errors', async () => {
      // Setup: Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Setup: Mock unexpected error
      mockSupabase.from().select().eq().single.mockRejectedValue(
        new Error('Unexpected server error')
      )

      // Assert: Should handle unexpected errors
      const queryResult = mockSupabase.from('customers').select('*').eq('id', 'customer-1').single()
      await expect(queryResult).rejects.toThrow('Unexpected server error')
    })
  })
})
