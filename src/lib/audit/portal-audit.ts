/**
 * Portal Audit Logging Utilities
 *
 * Creates audit log entries for customer portal actions
 */

import { getServiceSupabase } from '@/lib/supabase/server'

export interface PortalAuditLogEntry {
  actorId: string // Customer's auth user ID
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW'
  entity: 'customer' | 'preferences' | 'profile'
  entityId: string
  meta?: Record<string, unknown>
}

/**
 * Create audit log entry for portal actions
 */
export async function createPortalAuditLog(entry: PortalAuditLogEntry): Promise<void> {
  try {
    const supabase = getServiceSupabase()

    const { error } = await supabase
      .from('audit_log')
      .insert({
        actor_id: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId,
        meta: {
          ...entry.meta,
          source: 'customer_portal',
          timestamp: new Date().toISOString(),
        },
      })

    if (error) {
      console.error('[Portal Audit] Failed to create audit log:', error)
      // Don't throw - audit logging should not break the main operation
    }
  } catch (error) {
    console.error('[Portal Audit] Unexpected error creating audit log:', error)
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Create audit log for customer profile update
 */
export async function auditCustomerUpdate(
  userId: string,
  customerId: string,
  changes: Record<string, unknown>
): Promise<void> {
  await createPortalAuditLog({
    actorId: userId,
    action: 'UPDATE',
    entity: 'customer',
    entityId: customerId,
    meta: {
      changes,
      updated_fields: Object.keys(changes),
    },
  })
}

/**
 * Create audit log for preferences update
 */
export async function auditPreferencesUpdate(
  userId: string,
  customerId: string,
  changes: Record<string, unknown>
): Promise<void> {
  await createPortalAuditLog({
    actorId: userId,
    action: 'UPDATE',
    entity: 'preferences',
    entityId: customerId,
    meta: {
      changes,
      updated_fields: Object.keys(changes),
    },
  })
}
