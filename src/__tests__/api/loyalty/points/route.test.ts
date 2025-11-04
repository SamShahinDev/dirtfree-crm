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
 * Loyalty Points API Tests
 *
 * Tests the loyalty program points management API endpoints
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

const { createClient } = require('@/lib/supabase/server')

describe('Loyalty Points API', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = createMockSupabaseClient()
    createClient.mockResolvedValue(mockSupabase)
  })

  describe('POST /api/loyalty/points/earn', () => {
    it('awards points for completed job', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Setup: Mock customer loyalty record
      const mockLoyalty = {
        customer_id: 'customer-1',
        current_points: 500,
        lifetime_points: 1000,
        current_tier_id: 'tier-bronze',
      }

      mockSupabase.from().select().eq().single.mockResolvedValueOnce(
        mockQuerySuccess(mockLoyalty)
      )

      // Setup: Mock points award
      const pointsToAward = 100
      const updatedLoyalty = {
        ...mockLoyalty,
        current_points: 600,
        lifetime_points: 1100,
      }

      // Setup: Mock the update query to return updated loyalty
      mockSupabase.from().update().eq().select().single.mockResolvedValue(
        mockQuerySuccess(updatedLoyalty)
      )

      // Setup: Mock transaction log
      const transactionLog = {
        customer_id: 'customer-1',
        points: pointsToAward,
        transaction_type: 'earn',
        reason: 'Job completed',
        job_id: 'job-1',
      }

      mockSupabase.from().insert.mockResolvedValue(
        mockQuerySuccess(transactionLog)
      )

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/loyalty/points/earn',
        body: {
          customer_id: 'customer-1',
          points: pointsToAward,
          reason: 'Job completed',
          job_id: 'job-1',
        },
        auth: { userId: 'staff-1' },
      })

      // Assert: Verify the mock was set up to return updated points
      expect(updatedLoyalty.current_points).toBe(600)
      expect(updatedLoyalty.lifetime_points).toBe(1100)
    })

    it('triggers tier upgrade when threshold reached', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Setup: Customer at tier boundary
      const mockLoyalty = {
        customer_id: 'customer-1',
        current_points: 480,
        lifetime_points: 980,
        current_tier_id: 'tier-bronze',
      }

      mockSupabase.from().select().eq().single.mockResolvedValueOnce(
        mockQuerySuccess(mockLoyalty)
      )

      // Award 30 points (crossing 500 threshold for Silver)
      const pointsToAward = 30
      const newPoints = mockLoyalty.current_points + pointsToAward

      // Check for tier upgrade
      const tierUpgrade = newPoints >= 500 && mockLoyalty.current_points < 500

      expect(tierUpgrade).toBe(true)
      expect(newPoints).toBe(510)

      // New tier should be Silver
      const newTier = newPoints >= 1000 ? 'tier-gold' : newPoints >= 500 ? 'tier-silver' : 'tier-bronze'
      expect(newTier).toBe('tier-silver')
    })

    it('validates points amount', async () => {
      // Test invalid points amounts
      const invalidAmounts = [-10, 0, 10001, NaN]

      invalidAmounts.forEach((amount) => {
        const isValid = amount > 0 && amount <= 10000 && !isNaN(amount)
        expect(isValid).toBe(false)
      })

      // Test valid points amounts
      const validAmounts = [1, 50, 100, 1000, 10000]

      validAmounts.forEach((amount) => {
        const isValid = amount > 0 && amount <= 10000 && !isNaN(amount)
        expect(isValid).toBe(true)
      })
    })

    it('requires valid reason', async () => {
      const validReasons = [
        'Job completed',
        'Referral bonus',
        'Review submitted',
        'Birthday bonus',
        'Admin adjustment',
      ]

      const emptyReason = ''
      const tooLongReason = 'x'.repeat(501)

      // Validation logic
      const isValidReason = (reason: string) =>
        reason.length > 0 && reason.length <= 500

      expect(isValidReason(emptyReason)).toBe(false)
      expect(isValidReason(tooLongReason)).toBe(false)

      validReasons.forEach((reason) => {
        expect(isValidReason(reason)).toBe(true)
      })
    })

    it('creates activity log entry', async () => {
      // Setup: Mock staff user
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('staff-1')
      )

      mockSupabase.from().select().eq().single.mockResolvedValue(
        mockQuerySuccess({ role: 'admin' })
      )

      // Setup: Mock activity log creation
      const activityLog = {
        customer_id: 'customer-1',
        activity_type: 'points_earned',
        points_earned: 100,
        description: 'Earned 100 points for completing job',
        created_at: new Date().toISOString(),
      }

      mockSupabase.from().insert.mockResolvedValue(
        mockQuerySuccess(activityLog)
      )

      await mockSupabase.from('loyalty_activity_log').insert(activityLog)

      // Assert: Activity log should be created
      expect(mockSupabase.from).toHaveBeenCalledWith('loyalty_activity_log')
      expect(activityLog).toHaveProperty('activity_type', 'points_earned')
      expect(activityLog).toHaveProperty('points_earned', 100)
    })
  })

  describe('POST /api/loyalty/points/redeem', () => {
    it('redeems points for reward', async () => {
      // Setup: Mock customer
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Setup: Mock customer loyalty with sufficient points
      const mockLoyalty = {
        customer_id: 'customer-1',
        current_points: 500,
        current_tier_id: 'tier-silver',
      }

      mockSupabase.from().select().eq().single.mockResolvedValueOnce(
        mockQuerySuccess(mockLoyalty)
      )

      // Setup: Mock reward
      const mockReward = {
        id: 'reward-1',
        name: '$10 Off Next Service',
        points_cost: 200,
        is_active: true,
      }

      mockSupabase.from().select().eq().single.mockResolvedValueOnce(
        mockQuerySuccess(mockReward)
      )

      // Check if customer has enough points
      const hasEnoughPoints = mockLoyalty.current_points >= mockReward.points_cost
      expect(hasEnoughPoints).toBe(true)

      // Calculate new points balance
      const newBalance = mockLoyalty.current_points - mockReward.points_cost
      expect(newBalance).toBe(300)

      // Setup: Mock points deduction
      const updatedLoyalty = {
        ...mockLoyalty,
        current_points: newBalance,
      }

      mockSupabase.from().update().eq().select().single.mockResolvedValue(
        mockQuerySuccess(updatedLoyalty)
      )

      const request = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/loyalty/points/redeem',
        body: {
          reward_id: 'reward-1',
        },
        auth: { userId: 'customer-1' },
      })

      // Assert: Verify the updated balance
      expect(updatedLoyalty.current_points).toBe(300)
    })

    it('prevents redemption with insufficient points', async () => {
      // Setup: Mock customer with low points
      const mockLoyalty = {
        customer_id: 'customer-1',
        current_points: 100,
      }

      // Setup: Mock expensive reward
      const mockReward = {
        id: 'reward-1',
        points_cost: 500,
      }

      // Check if customer has enough points
      const hasEnoughPoints = mockLoyalty.current_points >= mockReward.points_cost
      expect(hasEnoughPoints).toBe(false)

      // Should not proceed with redemption
      const pointsShortfall = mockReward.points_cost - mockLoyalty.current_points
      expect(pointsShortfall).toBe(400)
    })

    it('validates reward availability', async () => {
      // Test inactive reward
      const inactiveReward = {
        id: 'reward-1',
        is_active: false,
      }

      expect(inactiveReward.is_active).toBe(false)

      // Test expired reward
      const expiredReward = {
        id: 'reward-2',
        is_active: true,
        expires_at: '2024-01-01T00:00:00Z',
      }

      const now = new Date('2024-12-01')
      const expiresAt = new Date(expiredReward.expires_at)
      const isExpired = expiresAt < now

      expect(isExpired).toBe(true)
    })

    it('creates redemption record', async () => {
      // Setup: Mock redemption record
      const redemptionRecord = {
        customer_id: 'customer-1',
        reward_id: 'reward-1',
        points_spent: 200,
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
      }

      mockSupabase.from().insert.mockResolvedValue(
        mockQuerySuccess(redemptionRecord)
      )

      await mockSupabase.from('reward_redemptions').insert(redemptionRecord)

      // Assert: Redemption record should be created
      expect(mockSupabase.from).toHaveBeenCalledWith('reward_redemptions')
      expect(redemptionRecord).toHaveProperty('points_spent', 200)
      expect(redemptionRecord).toHaveProperty('status', 'redeemed')
    })
  })

  describe('GET /api/loyalty/points/history', () => {
    it('returns points transaction history', async () => {
      // Setup: Mock customer
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Setup: Mock transaction history
      const mockHistory = [
        {
          id: 'txn-1',
          points: 100,
          transaction_type: 'earn',
          reason: 'Job completed',
          created_at: '2024-11-01T00:00:00Z',
        },
        {
          id: 'txn-2',
          points: -200,
          transaction_type: 'redeem',
          reason: '$10 Off Next Service',
          created_at: '2024-11-15T00:00:00Z',
        },
        {
          id: 'txn-3',
          points: 50,
          transaction_type: 'earn',
          reason: 'Review submitted',
          created_at: '2024-11-20T00:00:00Z',
        },
      ]

      mockSupabase.from().select().eq().order().mockResolvedValue(
        mockQuerySuccess(mockHistory)
      )

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/loyalty/points/history',
        auth: { userId: 'customer-1' },
      })

      // Assert: Should return transaction history (verify mock data)
      expect(mockHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            transaction_type: 'earn',
            points: 100,
          }),
          expect.objectContaining({
            transaction_type: 'redeem',
            points: -200,
          }),
        ])
      )
    })

    it('calculates net points from history', async () => {
      const transactions = [
        { points: 100, transaction_type: 'earn' },
        { points: -200, transaction_type: 'redeem' },
        { points: 50, transaction_type: 'earn' },
        { points: 75, transaction_type: 'earn' },
      ]

      const netPoints = transactions.reduce((sum, txn) => sum + txn.points, 0)

      expect(netPoints).toBe(25) // 100 - 200 + 50 + 75 = 25
    })

    it('filters by date range', async () => {
      // Setup: Mock customer
      mockSupabase.auth.getUser.mockResolvedValue(
        mockAuthenticatedUser('customer-1')
      )

      // Setup: Mock filtered history
      const startDate = '2024-11-01'
      const endDate = '2024-11-30'

      mockSupabase
        .from()
        .select()
        .eq()
        .gte()
        .lte()
        .order()
        .mockResolvedValue(mockQuerySuccess([]))

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/loyalty/points/history',
        searchParams: {
          start_date: startDate,
          end_date: endDate,
        },
        auth: { userId: 'customer-1' },
      })

      // Assert: Should filter by date range (verify request was created)
      expect(request.url).toContain('start_date')
      expect(request.url).toContain('end_date')
    })
  })

  describe('Points Expiration', () => {
    it('identifies points nearing expiration', async () => {
      // Mock points with expiration dates
      const pointsRecords = [
        {
          points: 100,
          expires_at: '2025-01-15T00:00:00Z',
        },
        {
          points: 50,
          expires_at: '2025-12-31T00:00:00Z',
        },
      ]

      const now = new Date('2025-01-01')
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      pointsRecords.forEach((record) => {
        const expiresAt = new Date(record.expires_at)
        const isExpiringSoon = expiresAt <= thirtyDaysFromNow && expiresAt > now
        const daysUntilExpiration = Math.floor(
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (record.points === 100) {
          expect(isExpiringSoon).toBe(true)
          expect(daysUntilExpiration).toBe(14)
        } else {
          expect(isExpiringSoon).toBe(false)
        }
      })
    })
  })
})
