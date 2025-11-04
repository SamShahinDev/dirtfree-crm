/**
 * Cron Job Registry
 *
 * Central registry for all scheduled cron jobs in the application.
 * Each job defines its schedule, handler, timeout, and retry behavior.
 */

export interface CronJob {
  name: string
  schedule: string // Cron expression
  handler: () => Promise<void>
  enabled: boolean
  timeout: number // Seconds
  retries: number
  description: string
  category?: 'opportunities' | 'promotions' | 'reviews' | 'loyalty' | 'analytics' | 'monitoring' | 'cleanup' | 'reports'
}

/**
 * Registry of all cron jobs
 *
 * Cron Expression Format: * * * * *
 * - Minute (0-59)
 * - Hour (0-23)
 * - Day of Month (1-31)
 * - Month (1-12)
 * - Day of Week (0-7, 0 and 7 are Sunday)
 *
 * Examples:
 * - "0 8 * * *" - Daily at 8am
 * - "*/30 * * * *" - Every 30 minutes
 * - "0 */6 * * *" - Every 6 hours
 * - "0 0 * * 0" - Weekly on Sunday at midnight
 */
export const cronJobs: CronJob[] = [
  // ============================================================================
  // OPPORTUNITIES
  // ============================================================================

  {
    name: 'process-opportunity-offers',
    schedule: '0 8 * * *', // Daily at 8am
    handler: async () => {
      const { processOpportunityOffers } = await import('../opportunities/auto-offers')
      await processOpportunityOffers()
    },
    enabled: true,
    timeout: 600,
    retries: 3,
    description: 'Send automated offers for missed opportunities',
    category: 'opportunities',
  },

  {
    name: 'opportunity-reminders',
    schedule: '0 8 * * *', // Daily at 8am
    handler: async () => {
      const { sendOpportunityReminders } = await import('../opportunities/notifications')
      await sendOpportunityReminders()
    },
    enabled: true,
    timeout: 300,
    retries: 2,
    description: 'Send follow-up reminders for opportunities',
    category: 'opportunities',
  },

  // ============================================================================
  // PROMOTIONS
  // ============================================================================

  {
    name: 'process-promotion-deliveries',
    schedule: '*/30 * * * *', // Every 30 minutes
    handler: async () => {
      const { processPromotionDeliveries } = await import('../promotions/delivery')
      await processPromotionDeliveries()
    },
    enabled: true,
    timeout: 300,
    retries: 2,
    description: 'Deliver queued promotions to customers',
    category: 'promotions',
  },

  {
    name: 'calculate-promotion-analytics',
    schedule: '0 2 * * *', // Daily at 2am
    handler: async () => {
      const { calculatePromotionAnalytics } = await import('../promotions/analytics')
      await calculatePromotionAnalytics()
    },
    enabled: true,
    timeout: 300,
    retries: 1,
    description: 'Calculate promotion performance metrics',
    category: 'promotions',
  },

  {
    name: 'promotion-triggers',
    schedule: '0 10 * * *', // Daily at 10am
    handler: async () => {
      const { checkPromotionTriggers } = await import('../promotions/triggers')
      await checkPromotionTriggers()
    },
    enabled: true,
    timeout: 600,
    retries: 2,
    description: 'Check and trigger automated promotions',
    category: 'promotions',
  },

  // ============================================================================
  // REVIEWS
  // ============================================================================

  {
    name: 'send-review-requests',
    schedule: '0 */6 * * *', // Every 6 hours
    handler: async () => {
      const { sendReviewRequests } = await import('../reviews/auto-request')
      await sendReviewRequests()
    },
    enabled: true,
    timeout: 300,
    retries: 2,
    description: 'Send review requests for completed jobs',
    category: 'reviews',
  },

  {
    name: 'review-follow-ups',
    schedule: '0 9 * * *', // Daily at 9am
    handler: async () => {
      const { sendReviewFollowUps } = await import('../reviews/follow-up')
      await sendReviewFollowUps()
    },
    enabled: true,
    timeout: 300,
    retries: 2,
    description: 'Send review reminders and handle escalations',
    category: 'reviews',
  },

  // ============================================================================
  // LOYALTY & REFERRALS
  // ============================================================================

  {
    name: 'process-tier-upgrades',
    schedule: '0 3 * * *', // Daily at 3am
    handler: async () => {
      const { processTierUpgrades } = await import('../loyalty/tiers')
      await processTierUpgrades()
    },
    enabled: true,
    timeout: 300,
    retries: 1,
    description: 'Check and process customer tier upgrades',
    category: 'loyalty',
  },

  {
    name: 'process-achievements',
    schedule: '0 4 * * *', // Daily at 4am
    handler: async () => {
      const { processAchievements } = await import('../loyalty/achievements')
      await processAchievements()
    },
    enabled: true,
    timeout: 300,
    retries: 1,
    description: 'Check and award customer achievements',
    category: 'loyalty',
  },

  {
    name: 'process-referrals',
    schedule: '0 */4 * * *', // Every 4 hours
    handler: async () => {
      const { processReferrals } = await import('../referrals/processor')
      await processReferrals()
    },
    enabled: true,
    timeout: 300,
    retries: 2,
    description: 'Check referral conversions and award points',
    category: 'loyalty',
  },

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  {
    name: 'aggregate-portal-analytics',
    schedule: '0 1 * * *', // Daily at 1am
    handler: async () => {
      const { aggregatePortalAnalytics } = await import('../analytics/portal')
      await aggregatePortalAnalytics()
    },
    enabled: true,
    timeout: 300,
    retries: 1,
    description: 'Aggregate daily portal usage statistics',
    category: 'analytics',
  },

  {
    name: 'aggregate-opportunity-analytics',
    schedule: '0 1 * * *', // Daily at 1am
    handler: async () => {
      const { aggregateOpportunityAnalytics } = await import('../analytics/opportunities')
      await aggregateOpportunityAnalytics()
    },
    enabled: true,
    timeout: 300,
    retries: 1,
    description: 'Aggregate daily opportunity pipeline metrics',
    category: 'analytics',
  },

  // ============================================================================
  // SCHEDULED REPORTS
  // ============================================================================

  {
    name: 'generate-scheduled-reports',
    schedule: '0 6 * * *', // Daily at 6am
    handler: async () => {
      const { generateAllScheduledReports } = await import('../reports/scheduler')
      await generateAllScheduledReports()
    },
    enabled: true,
    timeout: 600,
    retries: 2,
    description: 'Generate and send scheduled reports',
    category: 'reports',
  },

  // ============================================================================
  // MONITORING
  // ============================================================================

  {
    name: 'health-check',
    schedule: '*/5 * * * *', // Every 5 minutes
    handler: async () => {
      const { recordUptime } = await import('../monitoring/uptime')
      await recordUptime()
    },
    enabled: true,
    timeout: 30,
    retries: 1,
    description: 'Monitor system health and uptime',
    category: 'monitoring',
  },

  // ============================================================================
  // CLEANUP
  // ============================================================================

  {
    name: 'cleanup-expired-sessions',
    schedule: '0 0 * * *', // Daily at midnight
    handler: async () => {
      const { cleanupExpiredSessions } = await import('../auth/cleanup')
      await cleanupExpiredSessions()
    },
    enabled: true,
    timeout: 300,
    retries: 1,
    description: 'Remove expired authentication sessions',
    category: 'cleanup',
  },

  {
    name: 'cleanup-old-logs',
    schedule: '0 0 * * 0', // Weekly on Sunday at midnight
    handler: async () => {
      const { cleanupOldLogs } = await import('../logging/cleanup')
      await cleanupOldLogs()
    },
    enabled: true,
    timeout: 600,
    retries: 1,
    description: 'Archive or delete old log entries',
    category: 'cleanup',
  },

  {
    name: 'cleanup-old-uptime-logs',
    schedule: '0 0 1 * *', // Monthly on the 1st at midnight
    handler: async () => {
      const { supabase } = await import('../supabase/client')
      const { data, error } = await supabase.rpc('cleanup_old_uptime_logs')
      if (error) throw error
      console.log(`Cleaned up ${data} old uptime logs`)
    },
    enabled: true,
    timeout: 600,
    retries: 1,
    description: 'Remove uptime logs older than 90 days',
    category: 'cleanup',
  },

  {
    name: 'cleanup-old-alerts',
    schedule: '0 0 1 * *', // Monthly on the 1st at midnight
    handler: async () => {
      const { supabase } = await import('../supabase/client')
      const { data, error } = await supabase.rpc('cleanup_old_alerts')
      if (error) throw error
      console.log(`Cleaned up ${data} old alerts`)
    },
    enabled: true,
    timeout: 600,
    retries: 1,
    description: 'Remove resolved alerts older than 90 days',
    category: 'cleanup',
  },
]

/**
 * Get a cron job by name
 */
export function getCronJob(name: string): CronJob | undefined {
  return cronJobs.find((job) => job.name === name)
}

/**
 * Get all cron jobs for a category
 */
export function getCronJobsByCategory(
  category: CronJob['category']
): CronJob[] {
  return cronJobs.filter((job) => job.category === category)
}

/**
 * Get enabled cron jobs
 */
export function getEnabledCronJobs(): CronJob[] {
  return cronJobs.filter((job) => job.enabled)
}

/**
 * Get disabled cron jobs
 */
export function getDisabledCronJobs(): CronJob[] {
  return cronJobs.filter((job) => !job.enabled)
}
