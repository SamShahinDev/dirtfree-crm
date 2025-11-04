/**
 * Cache Invalidation Helpers
 *
 * Centralized cache invalidation logic for maintaining data consistency
 * across the application.
 *
 * Call these helpers after database mutations to ensure cache stays fresh.
 */

import {
  invalidateCache,
  invalidateCachePattern,
  customerCacheKey,
  opportunityCacheKey,
  promotionCacheKey,
  loyaltyCacheKey,
  analyticsCacheKey,
  buildCacheKey,
} from './redis-cache'

// =====================================================
// Customer Cache Invalidation
// =====================================================

/**
 * Invalidate all caches related to a customer
 *
 * Call this after:
 * - Customer profile update
 * - Customer deletion
 * - Any customer-related data change
 */
export function invalidateCustomerCaches(customerId: string): void {
  // Invalidate specific customer cache
  invalidateCache(customerCacheKey(customerId), 'customers')

  // Invalidate customer listings (if they use cache keys with pattern)
  invalidateCachePattern(customerId, 'customers')

  // Invalidate related caches
  invalidateCachePattern(customerId, 'jobs')
  invalidateCachePattern(customerId, 'invoices')
  invalidateCachePattern(customerId, 'loyalty')
  invalidateCachePattern(customerId, 'promotions')
}

/**
 * Invalidate customer list caches
 *
 * Call this after:
 * - New customer creation
 * - Bulk customer updates
 */
export function invalidateCustomerListCaches(): void {
  invalidateCachePattern('list', 'customers')
  invalidateCachePattern('all', 'customers')
}

// =====================================================
// Opportunity Cache Invalidation
// =====================================================

/**
 * Invalidate opportunity caches
 *
 * Call this after:
 * - Opportunity creation
 * - Opportunity status change
 * - Opportunity assignment
 */
export function invalidateOpportunityCaches(opportunityId?: string, customerId?: string): void {
  if (opportunityId) {
    invalidateCache(opportunityCacheKey(opportunityId), 'opportunities')
  }

  if (customerId) {
    invalidateCachePattern(customerId, 'opportunities')
  }

  // Invalidate pipeline views
  invalidateCachePattern('pipeline', 'opportunities')
  invalidateCachePattern('list', 'opportunities')
}

/**
 * Invalidate opportunity pipeline cache
 *
 * Call this after:
 * - Opportunity stage change
 * - Drag-and-drop reordering
 */
export function invalidateOpportunityPipeline(): void {
  invalidateCachePattern('pipeline', 'opportunities')
}

// =====================================================
// Promotion Cache Invalidation
// =====================================================

/**
 * Invalidate promotion caches
 *
 * Call this after:
 * - Promotion creation
 * - Promotion update
 * - Promotion activation/deactivation
 */
export function invalidatePromotionCaches(promotionId?: string): void {
  if (promotionId) {
    invalidateCache(promotionCacheKey(promotionId), 'promotions')
  }

  // Invalidate active promotions list
  invalidateCachePattern('active', 'promotions')
  invalidateCachePattern('all', 'promotions')

  // This will affect all customers, so invalidate all customer promotion caches
  invalidateCachePattern('customer', 'promotions')
}

/**
 * Invalidate customer-specific promotion caches
 *
 * Call this after:
 * - Promotion claim
 * - Promotion delivery
 * - Promotion redemption
 */
export function invalidateCustomerPromotionCaches(customerId: string): void {
  invalidateCachePattern(customerId, 'promotions')
}

// =====================================================
// Loyalty Cache Invalidation
// =====================================================

/**
 * Invalidate loyalty caches for a customer
 *
 * Call this after:
 * - Points awarded
 * - Points redeemed
 * - Tier upgrade
 * - Reward redemption
 */
export function invalidateLoyaltyCaches(customerId: string): void {
  invalidateCache(loyaltyCacheKey(customerId, 'balance'), 'loyalty')
  invalidateCache(loyaltyCacheKey(customerId, 'transactions'), 'loyalty')
  invalidateCache(loyaltyCacheKey(customerId, 'rewards'), 'loyalty')
  invalidateCache(loyaltyCacheKey(customerId, 'tier'), 'loyalty')

  // Invalidate all loyalty data for this customer
  invalidateCachePattern(customerId, 'loyalty')
}

/**
 * Invalidate loyalty leaderboard/rankings
 *
 * Call this after:
 * - Significant points changes
 * - Tier changes
 */
export function invalidateLoyaltyLeaderboard(): void {
  invalidateCachePattern('leaderboard', 'loyalty')
  invalidateCachePattern('rankings', 'loyalty')
}

// =====================================================
// Review Cache Invalidation
// =====================================================

/**
 * Invalidate review caches
 *
 * Call this after:
 * - New review submission
 * - Review response
 * - Review status change
 */
export function invalidateReviewCaches(customerId?: string, jobId?: string): void {
  if (customerId) {
    invalidateCachePattern(customerId, 'reviews')
  }

  if (jobId) {
    invalidateCachePattern(jobId, 'reviews')
  }

  // Invalidate review statistics
  invalidateCachePattern('stats', 'reviews')
  invalidateCachePattern('ratings', 'reviews')
}

// =====================================================
// Referral Cache Invalidation
// =====================================================

/**
 * Invalidate referral caches
 *
 * Call this after:
 * - New referral creation
 * - Referral status change
 * - Referral completion
 */
export function invalidateReferralCaches(customerId: string): void {
  invalidateCachePattern(customerId, 'referrals')
  invalidateCachePattern('active', 'referrals')
}

// =====================================================
// Job Cache Invalidation
// =====================================================

/**
 * Invalidate job caches
 *
 * Call this after:
 * - Job creation
 * - Job status change
 * - Job assignment
 * - Job completion
 */
export function invalidateJobCaches(jobId?: string, customerId?: string, technicianId?: string): void {
  if (jobId) {
    invalidateCache(buildCacheKey('job', jobId), 'jobs')
  }

  if (customerId) {
    invalidateCachePattern(customerId, 'jobs')
  }

  if (technicianId) {
    invalidateCachePattern(technicianId, 'jobs')
  }

  // Invalidate schedule views
  invalidateCachePattern('schedule', 'jobs')
  invalidateCachePattern('calendar', 'jobs')
}

// =====================================================
// Invoice Cache Invalidation
// =====================================================

/**
 * Invalidate invoice caches
 *
 * Call this after:
 * - Invoice creation
 * - Payment received
 * - Invoice status change
 */
export function invalidateInvoiceCaches(invoiceId?: string, customerId?: string): void {
  if (invoiceId) {
    invalidateCache(buildCacheKey('invoice', invoiceId), 'invoices')
  }

  if (customerId) {
    invalidateCachePattern(customerId, 'invoices')
  }

  // Invalidate pending invoices list
  invalidateCachePattern('pending', 'invoices')
  invalidateCachePattern('overdue', 'invoices')
}

// =====================================================
// Analytics Cache Invalidation
// =====================================================

/**
 * Invalidate analytics caches
 *
 * Call this after:
 * - Significant data changes
 * - End of reporting period
 * - Manual refresh request
 */
export function invalidateAnalyticsCaches(analyticsType?: string): void {
  if (analyticsType) {
    invalidateCachePattern(analyticsType, 'analytics')
  } else {
    // Clear all analytics caches
    invalidateCachePattern('', 'analytics')
  }
}

/**
 * Invalidate revenue analytics
 *
 * Call this after:
 * - Payment received
 * - Invoice created
 * - Refund processed
 */
export function invalidateRevenueAnalytics(): void {
  invalidateCachePattern('revenue', 'analytics')
  invalidateCachePattern('financial', 'analytics')
}

/**
 * Invalidate customer analytics
 *
 * Call this after:
 * - New customer signup
 * - Customer activity
 */
export function invalidateCustomerAnalytics(): void {
  invalidateCachePattern('customer', 'analytics')
  invalidateCachePattern('acquisition', 'analytics')
}

// =====================================================
// Chatbot Cache Invalidation
// =====================================================

/**
 * Invalidate chatbot session caches
 *
 * Call this after:
 * - Session escalation
 * - Session resolution
 */
export function invalidateChatbotCaches(sessionId?: string, customerId?: string): void {
  if (sessionId) {
    invalidateCachePattern(sessionId, 'chatbot')
  }

  if (customerId) {
    invalidateCachePattern(customerId, 'chatbot')
  }
}

// =====================================================
// Settings Cache Invalidation
// =====================================================

/**
 * Invalidate settings caches
 *
 * Call this after:
 * - Settings update
 * - Configuration change
 */
export function invalidateSettingsCaches(settingKey?: string): void {
  if (settingKey) {
    invalidateCache(buildCacheKey('setting', settingKey), 'settings')
  } else {
    invalidateCachePattern('', 'settings')
  }
}

// =====================================================
// Bulk Invalidation
// =====================================================

/**
 * Invalidate all caches related to a specific entity
 *
 * Use this for complex operations that affect multiple cache types
 */
export function invalidateAllRelatedCaches(params: {
  customerId?: string
  jobId?: string
  invoiceId?: string
  opportunityId?: string
  promotionId?: string
}): void {
  const { customerId, jobId, invoiceId, opportunityId, promotionId } = params

  if (customerId) {
    invalidateCustomerCaches(customerId)
  }

  if (jobId) {
    invalidateJobCaches(jobId)
  }

  if (invoiceId) {
    invalidateInvoiceCaches(invoiceId)
  }

  if (opportunityId) {
    invalidateOpportunityCaches(opportunityId)
  }

  if (promotionId) {
    invalidatePromotionCaches(promotionId)
  }
}

// =====================================================
// Export All
// =====================================================

export {
  invalidateCustomerCaches,
  invalidateCustomerListCaches,
  invalidateOpportunityCaches,
  invalidateOpportunityPipeline,
  invalidatePromotionCaches,
  invalidateCustomerPromotionCaches,
  invalidateLoyaltyCaches,
  invalidateLoyaltyLeaderboard,
  invalidateReviewCaches,
  invalidateReferralCaches,
  invalidateJobCaches,
  invalidateInvoiceCaches,
  invalidateAnalyticsCaches,
  invalidateRevenueAnalytics,
  invalidateCustomerAnalytics,
  invalidateChatbotCaches,
  invalidateSettingsCaches,
  invalidateAllRelatedCaches,
}
