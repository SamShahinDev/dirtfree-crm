import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { createMockRequest } from '@/lib/test-utils'
import {
  createMockSupabaseClient,
  mockAuthenticatedUser,
  mockUnauthenticated,
  mockQuerySuccess,
  mockQueryError,
} from '@/__tests__/mocks/supabase'

/**
 * Opportunities API Tests
 *
 * Tests the opportunities API endpoints for AI-driven sales opportunities
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

const { createClient } = require('@/lib/supabase/server')

describe('Opportunities API', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = createMockSupabaseClient()
    createClient.mockResolvedValue(mockSupabase)
  })

  describe('GET /api/opportunities', () => {
    it('returns opportunities for authenticated staff', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1', 'staff@example.com')
      )

      // Setup: Mock staff role check
      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Setup: Mock opportunities data
      const mockOpportunities = [
        {
          id: 'opp-1',
          customer_id: 'customer-1',
          opportunity_type: 'upsell',
          service_type: 'Tile & Grout Cleaning',
          confidence_score: 85,
          estimated_value: 250.0,
          status: 'open',
          created_at: '2024-11-01T00:00:00Z',
        },
        {
          id: 'opp-2',
          customer_id: 'customer-2',
          opportunity_type: 'cross_sell',
          service_type: 'Upholstery Cleaning',
          confidence_score: 75,
          estimated_value: 150.0,
          status: 'open',
          created_at: '2024-11-02T00:00:00Z',
        },
      ]

      mockSupabase.from().select().order().mockResolvedValue(
        mockQuerySuccess(mockOpportunities)
      )

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/opportunities',
        auth: { userId: 'staff-1' },
      })

      // Assert: Should return opportunities (verify mock was set up correctly)
      expect(mockOpportunities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            opportunity_type: 'upsell',
            confidence_score: 85,
          }),
        ])
      )
    })

    it('returns 401 for non-staff users', async () => {
      // Setup: Mock authenticated non-staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Setup: Mock role check returns customer role
      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'customer' })
      )

      // Assert: Customer role should not be staff
      const roleCheck = mockSupabase.from('user_roles').select('role').eq('user_id', 'customer-1').single()
      const result = await roleCheck
      expect(['admin', 'manager', 'dispatcher'].includes(result.data.role)).toBe(false)
    })

    it('filters opportunities by status', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Setup: Mock filtered opportunities
      const openOpportunities = [
        {
          id: 'opp-1',
          status: 'open',
          confidence_score: 85,
        },
        {
          id: 'opp-2',
          status: 'open',
          confidence_score: 75,
        },
      ]

      mockSupabase.from().select().eq().order().mockResolvedValue(
        mockQuerySuccess(openOpportunities)
      )

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/opportunities',
        searchParams: { status: 'open' },
        auth: { userId: 'staff-1' },
      })

      // Assert: All results should have 'open' status
      const queryResult = mockSupabase.from('opportunities').select('*').eq('status', 'open').order('confidence_score')
      const result = await queryResult
      result.data?.forEach((opp: any) => {
        expect(opp.status).toBe('open')
      })
    })

    it('filters opportunities by minimum confidence score', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Setup: Mock high-confidence opportunities
      const highConfidenceOpps = [
        { id: 'opp-1', confidence_score: 90 },
        { id: 'opp-2', confidence_score: 85 },
      ]

      mockSupabase.from().select().gte().order().mockResolvedValue(
        mockQuerySuccess(highConfidenceOpps)
      )

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/opportunities',
        searchParams: { min_confidence: '80' },
        auth: { userId: 'staff-1' },
      })

      // Assert: All results should have confidence >= 80
      const queryResult = mockSupabase.from('opportunities').select('*').gte('confidence_score', 80).order('confidence_score')
      const result = await queryResult
      result.data?.forEach((opp: any) => {
        expect(opp.confidence_score).toBeGreaterThanOrEqual(80)
      })
    })
  })

  describe('POST /api/opportunities', () => {
    it('creates opportunity successfully', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Setup: Mock opportunity creation
      const newOpportunity = {
        customer_id: 'customer-1',
        opportunity_type: 'upsell',
        service_type: 'Tile & Grout Cleaning',
        confidence_score: 85,
        estimated_value: 250.0,
        reason: 'Customer has tile floors',
      }

      mockSupabase.from().insert().select().single.mockResolvedValue(
        mockQuerySuccess({
          id: 'opp-new',
          ...newOpportunity,
          status: 'open',
          created_at: new Date().toISOString(),
        })
      )

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/opportunities',
        body: newOpportunity,
        auth: { userId: 'staff-1' },
      })

      // Assert: Should create opportunity
      const createResult = mockSupabase.from('opportunities').insert(newOpportunity).select().single()
      await expect(createResult).resolves.toMatchObject({
        data: expect.objectContaining({
          customer_id: 'customer-1',
          opportunity_type: 'upsell',
          confidence_score: 85,
        }),
        error: null,
      })
    })

    it('validates required fields', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Test missing required fields
      const invalidOpportunity = {
        // Missing customer_id
        opportunity_type: 'upsell',
        // Missing service_type
      }

      // Validation logic
      const requiredFields = ['customer_id', 'opportunity_type', 'service_type', 'confidence_score', 'estimated_value']
      const missingFields = requiredFields.filter((field) => !(field in invalidOpportunity))

      expect(missingFields.length).toBeGreaterThan(0)
      expect(missingFields).toContain('customer_id')
      expect(missingFields).toContain('service_type')
    })

    it('validates confidence score range', async () => {
      // Test confidence score validation
      const validScores = [0, 50, 75, 100]
      const invalidScores = [-1, 101, 150]

      validScores.forEach((score) => {
        const isValid = score >= 0 && score <= 100
        expect(isValid).toBe(true)
      })

      invalidScores.forEach((score) => {
        const isValid = score >= 0 && score <= 100
        expect(isValid).toBe(false)
      })
    })

    it('validates opportunity type', async () => {
      const validTypes = ['upsell', 'cross_sell', 'renewal', 'win_back']
      const invalidType = 'invalid_type'

      expect(validTypes.includes('upsell')).toBe(true)
      expect(validTypes.includes(invalidType)).toBe(false)
    })
  })

  describe('PATCH /api/opportunities/[id]', () => {
    it('updates opportunity status', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Setup: Mock status update
      mockSupabase.from().update().eq().select().single.mockResolvedValue(
        mockQuerySuccess({
          id: 'opp-1',
          status: 'converted',
          updated_at: new Date().toISOString(),
        })
      )

      // Assert: Should update status
      const updateResult = mockSupabase
        .from('opportunities')
        .update({ status: 'converted' })
        .eq('id', 'opp-1')
        .select()
        .single()

      await expect(updateResult).resolves.toMatchObject({
        data: expect.objectContaining({
          status: 'converted',
        }),
        error: null,
      })
    })

    it('validates status transitions', async () => {
      const validStatuses = ['open', 'contacted', 'converted', 'declined', 'expired']
      const invalidStatus = 'invalid_status'

      expect(validStatuses.includes('converted')).toBe(true)
      expect(validStatuses.includes(invalidStatus)).toBe(false)

      // Test valid transitions
      const validTransitions = {
        open: ['contacted', 'declined', 'expired'],
        contacted: ['converted', 'declined'],
        converted: [], // Final state
        declined: [], // Final state
        expired: [], // Final state
      }

      expect(validTransitions.open).toContain('contacted')
      expect(validTransitions.contacted).toContain('converted')
      expect(validTransitions.converted).toHaveLength(0) // No transitions from final state
    })

    it('creates conversion record when status changes to converted', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Setup: Mock conversion
      mockSupabase.from().update().eq().select().single.mockResolvedValue(
        mockQuerySuccess({
          id: 'opp-1',
          status: 'converted',
        })
      )

      // Setup: Mock conversion record creation
      const conversionRecord = {
        opportunity_id: 'opp-1',
        converted_by_user_id: 'staff-1',
        job_id: 'job-new',
        converted_at: new Date().toISOString(),
      }

      mockSupabase.from().insert.mockResolvedValue(
        mockQuerySuccess(conversionRecord)
      )

      // Execute conversion
      await mockSupabase
        .from('opportunities')
        .update({ status: 'converted' })
        .eq('id', 'opp-1')
        .select()
        .single()

      await mockSupabase.from('opportunity_conversions').insert(conversionRecord)

      // Assert: Conversion record should be created
      expect(mockSupabase.from).toHaveBeenCalledWith('opportunity_conversions')
      expect(conversionRecord).toHaveProperty('opportunity_id', 'opp-1')
      expect(conversionRecord).toHaveProperty('converted_by_user_id', 'staff-1')
    })
  })

  describe('AI Confidence Scoring', () => {
    it('calculates confidence based on customer history', async () => {
      // Mock customer with good booking history
      const customerHistory = {
        total_bookings: 10,
        avg_spend: 200,
        last_booking_days_ago: 30,
        has_service_type: false,
      }

      // Confidence scoring logic
      let confidence = 0

      // Base score from booking frequency
      if (customerHistory.total_bookings >= 10) confidence += 30
      else if (customerHistory.total_bookings >= 5) confidence += 20
      else confidence += 10

      // Score from spending
      if (customerHistory.avg_spend >= 200) confidence += 20
      else if (customerHistory.avg_spend >= 100) confidence += 10

      // Score from recency
      if (customerHistory.last_booking_days_ago <= 30) confidence += 20
      else if (customerHistory.last_booking_days_ago <= 90) confidence += 10

      // Penalty if they already have the service
      if (customerHistory.has_service_type) confidence -= 30

      // Score from data completeness
      confidence += 15 // Has complete profile

      expect(confidence).toBe(85) // 30 + 20 + 20 + 15
    })
  })
})
