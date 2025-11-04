/**
 * Customer Data Filtering for Portal API
 *
 * Filters customer data to only include fields safe for customer portal view.
 * Removes CRM-only fields and sensitive internal data.
 */

import type { Database } from '@/types/supabase'
import { formatForDisplay } from '@/lib/utils/phone'

type CustomerRow = Database['public']['Tables']['customers']['Row']

/**
 * Fields excluded from portal view (CRM-only)
 */
const EXCLUDED_FIELDS = [
  'phone_e164', // Internal normalized phone format
  'notes', // Internal staff notes
  'zone', // Internal routing zone
  // Add other CRM-only fields here
] as const

/**
 * Customer profile data for portal view
 */
export interface PortalCustomerData {
  id: string
  name: string
  email: string | null
  phone: string | null // Display format
  address: {
    line1: string | null
    line2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
  }
  preferences: {
    emailNotifications: boolean
    smsNotifications: boolean
    preferredCommunication: 'email' | 'phone' | 'both'
    marketingOptOut: boolean
  }
  createdAt: string
  updatedAt: string
}

/**
 * Filter customer data for portal view
 *
 * Removes CRM-only fields and formats data for customer consumption
 */
export function filterCustomerForPortal(customer: CustomerRow): PortalCustomerData {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone_e164 ? formatForDisplay(customer.phone_e164) : null,
    address: {
      line1: customer.address_line1,
      line2: customer.address_line2,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postal_code,
    },
    preferences: {
      emailNotifications: customer.email_notifications ?? true,
      smsNotifications: customer.sms_notifications ?? false,
      preferredCommunication: customer.preferred_communication as 'email' | 'phone' | 'both',
      marketingOptOut: customer.marketing_opt_out ?? false,
    },
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  }
}

/**
 * Customer update data from portal
 */
export interface PortalCustomerUpdateInput {
  name?: string
  email?: string
  phone?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
  }
}

/**
 * Customer preferences update data from portal
 */
export interface PortalPreferencesUpdateInput {
  emailNotifications?: boolean
  smsNotifications?: boolean
  preferredCommunication?: 'email' | 'phone' | 'both'
  marketingOptOut?: boolean
}

/**
 * Convert portal customer update to database update
 *
 * Maps portal field names to database column names
 */
export function mapPortalUpdateToDb(
  update: PortalCustomerUpdateInput,
  phoneE164?: string | null
): Partial<CustomerRow> {
  const dbUpdate: Partial<CustomerRow> = {}

  if (update.name !== undefined) {
    dbUpdate.name = update.name
  }

  if (update.email !== undefined) {
    dbUpdate.email = update.email || null
  }

  if (phoneE164 !== undefined) {
    dbUpdate.phone_e164 = phoneE164
  }

  if (update.address) {
    if (update.address.line1 !== undefined) {
      dbUpdate.address_line1 = update.address.line1 || null
    }
    if (update.address.line2 !== undefined) {
      dbUpdate.address_line2 = update.address.line2 || null
    }
    if (update.address.city !== undefined) {
      dbUpdate.city = update.address.city || null
    }
    if (update.address.state !== undefined) {
      dbUpdate.state = update.address.state || null
    }
    if (update.address.postalCode !== undefined) {
      dbUpdate.postal_code = update.address.postalCode || null
    }
  }

  return dbUpdate
}

/**
 * Convert portal preferences update to database update
 */
export function mapPreferencesToDb(
  preferences: PortalPreferencesUpdateInput
): Partial<CustomerRow> {
  const dbUpdate: Partial<CustomerRow> = {}

  if (preferences.emailNotifications !== undefined) {
    dbUpdate.email_notifications = preferences.emailNotifications
  }

  if (preferences.smsNotifications !== undefined) {
    dbUpdate.sms_notifications = preferences.smsNotifications
  }

  if (preferences.preferredCommunication !== undefined) {
    dbUpdate.preferred_communication = preferences.preferredCommunication
  }

  if (preferences.marketingOptOut !== undefined) {
    dbUpdate.marketing_opt_out = preferences.marketingOptOut
  }

  return dbUpdate
}
