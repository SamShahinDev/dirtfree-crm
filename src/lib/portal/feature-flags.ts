/**
 * Feature Flags Library
 *
 * Manages feature flags for controlled feature releases, A/B testing,
 * and gradual rollouts in the customer portal.
 */

import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string | null
  enabled: boolean
  rolloutPercentage: number
  userIds: string[]
  customerIds: string[]
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

/**
 * Feature flag evaluation result
 */
export interface FeatureFlagResult {
  enabled: boolean
  reason: 'disabled' | 'whitelist_user' | 'whitelist_customer' | 'rollout' | 'not_found'
}

/**
 * Check if a feature is enabled for a user
 */
export async function isFeatureEnabled(
  featureKey: string,
  options: {
    userId?: string
    customerId?: string
  } = {}
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()

    const { data, error } = await supabase.rpc('is_feature_enabled', {
      p_feature_key: featureKey,
      p_user_id: options.userId || null,
      p_customer_id: options.customerId || null,
    } as any)

    if (error) {
      console.error('[Feature Flags] Error checking feature:', error)
      return false
    }

    return data === true
  } catch (error) {
    console.error('[Feature Flags] Error checking feature:', error)
    return false
  }
}

/**
 * Check feature flag with detailed result
 */
export async function checkFeatureFlag(
  featureKey: string,
  options: {
    userId?: string
    customerId?: string
  } = {}
): Promise<FeatureFlagResult> {
  try {
    const supabase = getServiceSupabase()

    // Get feature flag
    const { data: flag, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('key', featureKey)
      .single()

    if (error || !flag) {
      return { enabled: false, reason: 'not_found' }
    }

    // Feature is disabled
    if (!(flag as any).enabled) {
      return { enabled: false, reason: 'disabled' }
    }

    // Check user whitelist
    if (options.userId && (flag as any).user_ids?.includes(options.userId)) {
      return { enabled: true, reason: 'whitelist_user' }
    }

    // Check customer whitelist
    if (options.customerId && (flag as any).customer_ids?.includes(options.customerId)) {
      return { enabled: true, reason: 'whitelist_customer' }
    }

    // Check rollout percentage
    const rolloutValue = getRolloutValue(options.userId || options.customerId || '')
    const enabled = rolloutValue < (flag as any).rollout_percentage

    return {
      enabled,
      reason: enabled ? 'rollout' : 'disabled',
    }
  } catch (error) {
    console.error('[Feature Flags] Error checking feature flag:', error)
    return { enabled: false, reason: 'not_found' }
  }
}

/**
 * Get all feature flags
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  try {
    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('name')

    if (error) {
      console.error('[Feature Flags] Error fetching flags:', error)
      return []
    }

    return (data || []).map((flag: any) => ({
      id: flag.id,
      key: flag.key,
      name: flag.name,
      description: flag.description,
      enabled: flag.enabled,
      rolloutPercentage: flag.rollout_percentage,
      userIds: flag.user_ids || [],
      customerIds: flag.customer_ids || [],
      metadata: flag.metadata || {},
      createdAt: flag.created_at,
      updatedAt: flag.updated_at,
    }))
  } catch (error) {
    console.error('[Feature Flags] Error fetching flags:', error)
    return []
  }
}

/**
 * Get enabled features for a user/customer
 */
export async function getEnabledFeatures(options: {
  userId?: string
  customerId?: string
}): Promise<string[]> {
  try {
    const flags = await getAllFeatureFlags()
    const enabled: string[] = []

    for (const flag of flags) {
      const isEnabled = await isFeatureEnabled(flag.key, options)
      if (isEnabled) {
        enabled.push(flag.key)
      }
    }

    return enabled
  } catch (error) {
    console.error('[Feature Flags] Error getting enabled features:', error)
    return []
  }
}

/**
 * Update feature flag
 */
export async function updateFeatureFlag(
  featureKey: string,
  updates: {
    enabled?: boolean
    rolloutPercentage?: number
    userIds?: string[]
    customerIds?: string[]
    metadata?: Record<string, any>
  },
  updatedBy?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    const updateData: any = {}

    if (updates.enabled !== undefined) {
      updateData.enabled = updates.enabled
    }
    if (updates.rolloutPercentage !== undefined) {
      updateData.rollout_percentage = updates.rolloutPercentage
    }
    if (updates.userIds !== undefined) {
      updateData.user_ids = updates.userIds
    }
    if (updates.customerIds !== undefined) {
      updateData.customer_ids = updates.customerIds
    }
    if (updates.metadata !== undefined) {
      updateData.metadata = updates.metadata
    }
    if (updatedBy) {
      updateData.updated_by = updatedBy
    }

    const { error } = await supabase
      .from('feature_flags')
      // @ts-ignore - Supabase type inference issue
      .update(updateData)
      .eq('key', featureKey)

    if (error) {
      console.error('[Feature Flags] Error updating flag:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Feature Flags] Error updating flag:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create a new feature flag
 */
export async function createFeatureFlag(
  flag: {
    key: string
    name: string
    description?: string
    enabled?: boolean
    rolloutPercentage?: number
    userIds?: string[]
    customerIds?: string[]
    metadata?: Record<string, any>
  },
  createdBy?: string
): Promise<{ success: boolean; error?: string; flagId?: string }> {
  try {
    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        key: flag.key,
        name: flag.name,
        description: flag.description || null,
        enabled: flag.enabled ?? false,
        rollout_percentage: flag.rolloutPercentage ?? 0,
        user_ids: flag.userIds || [],
        customer_ids: flag.customerIds || [],
        metadata: flag.metadata || {},
        created_by: createdBy || null,
        updated_by: createdBy || null,
      } as any)
      .select('id')
      .single()

    if (error) {
      console.error('[Feature Flags] Error creating flag:', error)
      return { success: false, error: error.message }
    }

    return { success: true, flagId: (data as any)?.id }
  } catch (error) {
    console.error('[Feature Flags] Error creating flag:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete a feature flag
 */
export async function deleteFeatureFlag(
  featureKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('key', featureKey)

    if (error) {
      console.error('[Feature Flags] Error deleting flag:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Feature Flags] Error deleting flag:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Add user to feature flag whitelist
 */
export async function addUserToWhitelist(
  featureKey: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    // Get current flag
    const { data: flag, error: fetchError } = await supabase
      .from('feature_flags')
      .select('user_ids')
      .eq('key', featureKey)
      .single()

    if (fetchError || !flag) {
      return { success: false, error: 'Feature flag not found' }
    }

    const currentUserIds = (flag as any).user_ids || []
    if (currentUserIds.includes(userId)) {
      return { success: true } // Already in whitelist
    }

    const { error } = await supabase
      .from('feature_flags')
      // @ts-ignore - Supabase type inference issue
      .update({ user_ids: [...currentUserIds, userId] })
      .eq('key', featureKey)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Add customer to feature flag whitelist
 */
export async function addCustomerToWhitelist(
  featureKey: string,
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    // Get current flag
    const { data: flag, error: fetchError } = await supabase
      .from('feature_flags')
      .select('customer_ids')
      .eq('key', featureKey)
      .single()

    if (fetchError || !flag) {
      return { success: false, error: 'Feature flag not found' }
    }

    const currentCustomerIds = (flag as any).customer_ids || []
    if (currentCustomerIds.includes(customerId)) {
      return { success: true } // Already in whitelist
    }

    const { error } = await supabase
      .from('feature_flags')
      // @ts-ignore - Supabase type inference issue
      .update({ customer_ids: [...currentCustomerIds, customerId] })
      .eq('key', featureKey)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Calculate rollout value for consistent A/B testing
 * Returns a number between 0-100
 */
function getRolloutValue(identifier: string): number {
  if (!identifier) {
    return Math.floor(Math.random() * 100)
  }

  // Simple hash function for consistent results
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash) % 100
}

/**
 * Gradual rollout helper
 * Gradually increase rollout percentage over time
 */
export async function gradualRollout(
  featureKey: string,
  options: {
    startPercentage: number
    endPercentage: number
    durationHours: number
    intervalHours: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { startPercentage, endPercentage, durationHours, intervalHours } = options

    const steps = Math.ceil(durationHours / intervalHours)
    const increment = (endPercentage - startPercentage) / steps

    let currentPercentage = startPercentage

    for (let i = 0; i <= steps; i++) {
      const targetPercentage = Math.min(
        Math.round(currentPercentage),
        endPercentage
      )

      const result = await updateFeatureFlag(featureKey, {
        rolloutPercentage: targetPercentage,
      })

      if (!result.success) {
        return result
      }

      if (i < steps) {
        // Wait for the interval (in practice, this would be handled by a cron job)
        await new Promise(resolve => setTimeout(resolve, intervalHours * 60 * 60 * 1000))
      }

      currentPercentage += increment
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
