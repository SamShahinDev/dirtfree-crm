/**
 * Portal Settings Sync Utilities
 *
 * Handles synchronization of settings between CRM and customer portal
 * Manages conflicts and maintains settings history
 */

import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Settings types that can be synced
 */
export type SettingKey =
  | 'email_notifications'
  | 'sms_notifications'
  | 'preferred_communication'
  | 'marketing_opt_out'
  | 'auto_booking_enabled'
  | 'preferred_technician_id'
  | 'portal_language'
  | 'timezone'

/**
 * Setting change source
 */
export type ChangeSource = 'customer' | 'staff' | 'system'

/**
 * Setting change origin
 */
export type ChangeOrigin = 'portal' | 'crm' | 'api' | 'migration'

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = 'portal_wins' | 'crm_wins' | 'latest_wins' | 'manual'

/**
 * Setting value (can be any JSON-serializable type)
 */
export type SettingValue = string | number | boolean | null

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean
  conflicts: SettingConflict[]
  synced: SettingKey[]
  errors: string[]
}

/**
 * Setting conflict
 */
export interface SettingConflict {
  key: SettingKey
  portalValue: SettingValue
  crmValue: SettingValue
  portalLastModified: string
  crmLastModified: string
  resolution?: ConflictResolution
}

/**
 * Setting change
 */
export interface SettingChange {
  key: SettingKey
  oldValue: SettingValue
  newValue: SettingValue
  changedBy: ChangeSource
  changedVia: ChangeOrigin
  ipAddress?: string
  userAgent?: string
  notes?: string
}

/**
 * Record a settings change in history
 */
export async function recordSettingChange(
  customerId: string,
  change: SettingChange
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    const { error } = await supabase.from('portal_settings_history').insert({
      customer_id: customerId,
      setting_key: change.key,
      old_value: change.oldValue,
      new_value: change.newValue,
      changed_by: change.changedBy,
      changed_via: change.changedVia,
      ip_address: change.ipAddress,
      user_agent: change.userAgent,
      notes: change.notes,
    } as any)

    if (error) {
      console.error('[Settings Sync] Failed to record setting change:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Settings Sync] Error recording setting change:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get setting change history for a customer
 */
export async function getSettingHistory(
  customerId: string,
  settingKey?: SettingKey,
  limit = 50
): Promise<{ success: boolean; history?: any[]; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    let query = supabase
      .from('portal_settings_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('changed_at', { ascending: false })
      .limit(limit)

    if (settingKey) {
      query = query.eq('setting_key', settingKey)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Settings Sync] Failed to get setting history:', error)
      return { success: false, error: error.message }
    }

    return { success: true, history: data || [] }
  } catch (error) {
    console.error('[Settings Sync] Error getting setting history:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Detect conflicts between portal and CRM settings
 */
export async function detectSettingConflicts(
  customerId: string
): Promise<{ success: boolean; conflicts?: SettingConflict[]; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    // Get current customer settings
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return { success: false, error: 'Customer not found' }
    }

    // Get recent setting changes from portal
    const { data: portalChanges, error: portalError } = await supabase
      .from('portal_settings_history')
      .select('*')
      .eq('customer_id', customerId)
      .eq('changed_via', 'portal')
      .order('changed_at', { ascending: false })
      .limit(100)

    if (portalError) {
      return { success: false, error: portalError.message }
    }

    // Get recent setting changes from CRM
    const { data: crmChanges, error: crmError } = await supabase
      .from('portal_settings_history')
      .select('*')
      .eq('customer_id', customerId)
      .eq('changed_via', 'crm')
      .order('changed_at', { ascending: false })
      .limit(100)

    if (crmError) {
      return { success: false, error: crmError.message }
    }

    // Detect conflicts
    const conflicts: SettingConflict[] = []
    const settingKeys: SettingKey[] = [
      'email_notifications',
      'sms_notifications',
      'preferred_communication',
      'marketing_opt_out',
      'auto_booking_enabled',
      'preferred_technician_id',
      'portal_language',
      'timezone',
    ]

    for (const key of settingKeys) {
      const portalChange = portalChanges?.find((c: any) => c.setting_key === key)
      const crmChange = crmChanges?.find((c: any) => c.setting_key === key)

      // Check if both portal and CRM have modified the same setting
      if (portalChange && crmChange) {
        const portalTime = new Date((portalChange as any).changed_at).getTime()
        const crmTime = new Date((crmChange as any).changed_at).getTime()

        // If changes happened within 5 minutes of each other, consider it a conflict
        const timeDiff = Math.abs(portalTime - crmTime)
        if (timeDiff < 5 * 60 * 1000) {
          conflicts.push({
            key,
            portalValue: (portalChange as any).new_value,
            crmValue: (crmChange as any).new_value,
            portalLastModified: (portalChange as any).changed_at,
            crmLastModified: (crmChange as any).changed_at,
            resolution: 'latest_wins',
          })
        }
      }
    }

    return { success: true, conflicts }
  } catch (error) {
    console.error('[Settings Sync] Error detecting conflicts:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Resolve setting conflicts
 */
export async function resolveSettingConflicts(
  customerId: string,
  conflicts: SettingConflict[],
  strategy: ConflictResolution = 'latest_wins'
): Promise<{ success: boolean; resolved: number; errors: string[] }> {
  try {
    const supabase = getServiceSupabase()
    let resolved = 0
    const errors: string[] = []

    for (const conflict of conflicts) {
      let valueToUse: SettingValue

      switch (strategy) {
        case 'portal_wins':
          valueToUse = conflict.portalValue
          break
        case 'crm_wins':
          valueToUse = conflict.crmValue
          break
        case 'latest_wins':
          // Use the value from the most recent change
          const portalTime = new Date(conflict.portalLastModified).getTime()
          const crmTime = new Date(conflict.crmLastModified).getTime()
          valueToUse = portalTime > crmTime ? conflict.portalValue : conflict.crmValue
          break
        case 'manual':
          // Skip - requires manual intervention
          continue
        default:
          valueToUse = conflict.portalValue
      }

      // Update customer record with resolved value
      const { error } = await supabase
        .from('customers')
        // @ts-ignore - Supabase type inference issue
        .update({ [conflict.key]: valueToUse } as any)
        .eq('id', customerId)

      if (error) {
        errors.push(`Failed to resolve ${conflict.key}: ${error.message}`)
      } else {
        resolved++

        // Record the resolution
        await recordSettingChange(customerId, {
          key: conflict.key,
          oldValue: strategy === 'portal_wins' ? conflict.crmValue : conflict.portalValue,
          newValue: valueToUse,
          changedBy: 'system',
          changedVia: 'api',
          notes: `Conflict resolved using strategy: ${strategy}`,
        })
      }
    }

    return { success: errors.length === 0, resolved, errors }
  } catch (error) {
    console.error('[Settings Sync] Error resolving conflicts:', error)
    return {
      success: false,
      resolved: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}

/**
 * Sync settings from portal to CRM
 */
export async function syncPortalToCRM(
  customerId: string,
  settings: Partial<Record<SettingKey, SettingValue>>
): Promise<SyncResult> {
  try {
    const supabase = getServiceSupabase()
    const synced: SettingKey[] = []
    const errors: string[] = []

    // Check for existing conflicts first
    const { conflicts: existingConflicts } = await detectSettingConflicts(customerId)

    // Filter out settings that have conflicts
    const conflictKeys = new Set((existingConflicts || []).map(c => c.key))
    const settingsToSync = Object.entries(settings).filter(
      ([key]) => !conflictKeys.has(key as SettingKey)
    )

    // Sync each setting
    for (const [key, value] of settingsToSync) {
      const { error } = await supabase
        .from('customers')
        // @ts-ignore - Supabase type inference issue
        .update({ [key]: value } as any)
        .eq('id', customerId)

      if (error) {
        errors.push(`Failed to sync ${key}: ${error.message}`)
      } else {
        synced.push(key as SettingKey)
      }
    }

    return {
      success: errors.length === 0,
      conflicts: existingConflicts || [],
      synced,
      errors,
    }
  } catch (error) {
    console.error('[Settings Sync] Error syncing portal to CRM:', error)
    return {
      success: false,
      conflicts: [],
      synced: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}

/**
 * Sync settings from CRM to portal
 */
export async function syncCRMToPortal(
  customerId: string,
  settings: Partial<Record<SettingKey, SettingValue>>
): Promise<SyncResult> {
  // Same implementation as syncPortalToCRM
  // In practice, both CRM and portal use the same database
  // This function exists for API consistency
  return syncPortalToCRM(customerId, settings)
}

/**
 * Bulk sync settings for multiple customers
 */
export async function bulkSyncSettings(
  customerIds: string[],
  strategy: ConflictResolution = 'latest_wins'
): Promise<{
  success: boolean
  synced: number
  conflicts: number
  errors: string[]
}> {
  try {
    let synced = 0
    let totalConflicts = 0
    const errors: string[] = []

    for (const customerId of customerIds) {
      // Detect conflicts
      const { conflicts } = await detectSettingConflicts(customerId)

      if (conflicts && conflicts.length > 0) {
        totalConflicts += conflicts.length

        // Resolve conflicts
        const { resolved, errors: resolveErrors } = await resolveSettingConflicts(
          customerId,
          conflicts,
          strategy
        )

        synced += resolved
        errors.push(...resolveErrors)
      }
    }

    return {
      success: errors.length === 0,
      synced,
      conflicts: totalConflicts,
      errors,
    }
  } catch (error) {
    console.error('[Settings Sync] Error in bulk sync:', error)
    return {
      success: false,
      synced: 0,
      conflicts: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}
