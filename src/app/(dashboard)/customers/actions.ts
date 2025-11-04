'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server'
import { makeDispatcherAction, makeTechnicianAction } from '@/lib/actions'
import { normalizeToE164, formatForDisplay } from '@/lib/utils/phone'
import { sendWelcomeEmail } from '@/lib/email/service'
import {
  CustomerFormSchema,
  type CustomerListResponse,
  type CustomerDetail,
  type ActionResponse
} from './schema'

// Input validation schemas
const CustomerSearchSchema = z.object({
  q: z.string().optional(),
  zone: z.enum(['N', 'S', 'E', 'W', 'Central']).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(25)
})

const CustomerIdSchema = z.object({
  id: z.string().uuid()
})

const CreateCustomerSchema = CustomerFormSchema

const UpdateCustomerSchema = CustomerFormSchema.extend({
  id: z.string().uuid()
})

const BulkZoneAssignmentSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1, 'At least one customer must be selected'),
  zone: z.enum(['N', 'S', 'E', 'W', 'Central'])
})

/**
 * Lists customers with search, filtering, and pagination
 * Accessible by all authenticated users (RLS handles filtering)
 */
export const listCustomers = makeTechnicianAction(
  CustomerSearchSchema,
  async (params): Promise<CustomerListResponse> => {
    const supabase = await getServerSupabase()
    // Use service role for queries (permissions verified by makeTechnicianAction)
    const serviceSupabase = getServiceSupabase()
    const { q, zone, page, pageSize } = params

    // Build the base query
    let query = serviceSupabase
      .from('customers')
      .select(`
        *,
        service_history(completed_at),
        jobs(id)
      `, { count: 'exact' })

    // Apply search filter
    if (q && q.trim().length > 0) {
      const searchTerm = q.trim()

      // Check if search term looks like a phone number
      const normalizedPhone = normalizeToE164(searchTerm)

      if (normalizedPhone) {
        // Search by normalized phone
        query = query.eq('phone_e164', normalizedPhone)
      } else {
        // Search by name or address using trigram similarity
        query = query.or(`
          name.ilike.%${searchTerm}%,
          email.ilike.%${searchTerm}%,
          and(address_line1.ilike.%${searchTerm}%),
          and(city.ilike.%${searchTerm}%)
        `)
      }
    }

    // Apply zone filter
    if (zone) {
      query = query.eq('zone', zone)
    }

    // Get total count first
    const { count: total } = await query

    // Apply pagination and ordering
    const offset = (page - 1) * pageSize
    query = query
      .order('name')
      .range(offset, offset + pageSize - 1)

    const { data: customers, error } = await query

    if (error) {
      throw new Error(`Failed to fetch customers: ${error.message}`)
    }

    // Process results to add computed fields
    const rows = (customers || []).map(customer => {
      // Get the most recent service date
      const lastServiceDate = customer.service_history
        ?.filter(sh => sh.completed_at)
        ?.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
        ?.[0]?.completed_at || null

      return {
        ...customer,
        last_service_date: lastServiceDate,
        job_count: customer.jobs?.length || 0
      }
    })

    const totalPages = Math.ceil((total || 0) / pageSize)

    return {
      rows,
      total: total || 0,
      page,
      pageSize,
      totalPages
    }
  }
)

/**
 * Gets a single customer with service history
 * Accessible by all authenticated users (RLS handles filtering)
 */
export const getCustomer = makeTechnicianAction(
  CustomerIdSchema,
  async ({ id }): Promise<CustomerDetail> => {
    const supabase = await getServerSupabase()
    // Use service role for queries (permissions verified by makeTechnicianAction)
    const serviceSupabase = getServiceSupabase()

    // Get customer data
    const { data: customer, error: customerError } = await serviceSupabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()

    if (customerError || !customer) {
      throw new Error(`Customer not found: ${customerError?.message || 'Unknown error'}`)
    }

    // Get service history with job and technician details
    const { data: serviceHistory, error: historyError } = await serviceSupabase
      .from('service_history')
      .select(`
        id,
        job_id,
        completed_at,
        notes,
        jobs(description, invoice_url),
        user_profiles!service_history_technician_id_fkey(display_name)
      `)
      .eq('customer_id', id)
      .order('completed_at', { ascending: false })

    if (historyError) {
      throw new Error(`Failed to fetch service history: ${historyError.message}`)
    }

    // Transform service history
    const service_history = (serviceHistory || []).map(entry => ({
      id: entry.id,
      job_id: entry.job_id,
      completed_at: entry.completed_at,
      notes: entry.notes,
      technician_name: entry.user_profiles?.display_name || null,
      job_description: entry.jobs?.description || null,
      invoice_url: entry.jobs?.invoice_url || null
    }))

    return {
      ...customer,
      service_history
    }
  }
)

/**
 * Creates a new customer
 * Requires dispatcher or admin role
 */
export const createCustomer = makeDispatcherAction(
  CreateCustomerSchema,
  async (formData, { user }): Promise<ActionResponse<{ id: string }>> => {
    const supabase = await getServerSupabase()

    // Normalize phone number
    const phone_e164 = formData.phone ? normalizeToE164(formData.phone) : null

    // Prepare customer data
    const customerData = {
      name: formData.name,
      email: formData.email || null,
      phone_e164,
      address_line1: formData.address_line1 || null,
      address_line2: formData.address_line2 || null,
      city: formData.city || null,
      state: formData.state || null,
      postal_code: formData.postal_code || null,
      zone: formData.zone || null,
      notes: formData.notes || null,
      // Email preferences
      email_notifications: formData.email_notifications ?? true,
      sms_notifications: formData.sms_notifications ?? false,
      preferred_communication: formData.preferred_communication ?? 'email',
      marketing_opt_out: formData.marketing_opt_out ?? false
    }

    // Use service role client for insert (permissions already verified by makeDispatcherAction)
    const serviceSupabase = getServiceSupabase()
    const { data: customer, error } = await serviceSupabase
      .from('customers')
      .insert(customerData)
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to create customer: ${error.message}`)
    }

    // Send welcome email if customer has email address and opted in for email notifications
    if (formData.email && (formData.email_notifications ?? true) && !(formData.marketing_opt_out ?? false)) {
      try {
        // Get user profile for sender name
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('id', user.id)
          .single()

        // For customers, we'll send a service information email instead of team welcome
        // This could be customized to be a "Welcome to our service" email
        console.log('Sending welcome email to new customer:', formData.email)

        // Note: Using welcome email template for now - could create customer-specific template
        sendWelcomeEmail(
          formData.email,
          formData.name,
          userProfile?.display_name || 'Our Team'
        ).catch(error => {
          console.error('Failed to send customer welcome email:', error)
        })
      } catch (error) {
        console.error('Customer welcome email failed:', error)
      }
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'CREATE',
        entity: 'customer',
        entity_id: customer.id,
        meta: { name: formData.name, phone: phone_e164 }
      })

    revalidatePath('/customers')
    revalidatePath(`/customers/${customer.id}`)

    return {
      ok: true,
      data: { id: customer.id }
    }
  }
)

/**
 * Updates an existing customer
 * Requires dispatcher or admin role
 */
export const updateCustomer = makeDispatcherAction(
  UpdateCustomerSchema,
  async (formData, { user }): Promise<ActionResponse<void>> => {
    const supabase = await getServerSupabase()
    const { id, ...updates } = formData

    // Normalize phone number
    const phone_e164 = updates.phone ? normalizeToE164(updates.phone) : null

    // Prepare update data
    const updateData = {
      name: updates.name,
      email: updates.email || null,
      phone_e164,
      address_line1: updates.address_line1 || null,
      address_line2: updates.address_line2 || null,
      city: updates.city || null,
      state: updates.state || null,
      postal_code: updates.postal_code || null,
      zone: updates.zone || null,
      notes: updates.notes || null,
      // Email preferences
      email_notifications: updates.email_notifications ?? true,
      sms_notifications: updates.sms_notifications ?? false,
      preferred_communication: updates.preferred_communication ?? 'email',
      marketing_opt_out: updates.marketing_opt_out ?? false
    }

    // Use service role client for update (permissions already verified by makeDispatcherAction)
    const serviceSupabase = getServiceSupabase()
    const { error } = await serviceSupabase
      .from('customers')
      .update(updateData)
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to update customer: ${error.message}`)
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'customer',
        entity_id: id,
        meta: { updates: updateData }
      })

    revalidatePath('/customers')
    revalidatePath(`/customers/${id}`)

    return {
      ok: true
    }
  }
)

/**
 * Deletes a customer (optional - admin only)
 * Requires admin role
 */
export const deleteCustomer = makeDispatcherAction(
  CustomerIdSchema,
  async ({ id }, { user }): Promise<ActionResponse<void>> => {
    const supabase = await getServerSupabase()
    // Use service role for delete (permissions verified by makeDispatcherAction)
    const serviceSupabase = getServiceSupabase()

    const { error } = await serviceSupabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete customer: ${error.message}`)
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'DELETE',
        entity: 'customer',
        entity_id: id,
        meta: {}
      })

    revalidatePath('/customers')

    return {
      ok: true
    }
  }
)

/**
 * Exports all customers to CSV format
 * Requires dispatcher or admin role
 */
export const exportAllCustomers = makeTechnicianAction(
  z.object({}),
  async (): Promise<ActionResponse<{ csv: string; filename: string }>> => {
    const supabase = await getServerSupabase()
    // Use service role for queries (permissions verified by makeTechnicianAction)
    const serviceSupabase = getServiceSupabase()

    // Get all customers with pagination to handle large datasets
    let allCustomers: any[] = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const { data: customers, error } = await serviceSupabase
        .from('customers')
        .select(`
          id,
          name,
          email,
          phone_e164,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          zone,
          notes,
          created_at,
          updated_at
        `)
        .order('name')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) {
        throw new Error(`Failed to fetch customers: ${error.message}`)
      }

      if (!customers || customers.length === 0) {
        break
      }

      allCustomers = allCustomers.concat(customers)

      // If we got less than pageSize, we've reached the end
      if (customers.length < pageSize) {
        break
      }

      page++
    }

    // Format data for CSV
    const csvHeaders = [
      'Name',
      'Email',
      'Phone',
      'Address Line 1',
      'Address Line 2',
      'City',
      'State',
      'Postal Code',
      'Zone',
      'Notes',
      'Created Date',
      'Updated Date'
    ]

    const csvRows = allCustomers.map(customer => [
      customer.name || '',
      customer.email || '',
      customer.phone_e164 ? formatForDisplay(customer.phone_e164) : '',
      customer.address_line1 || '',
      customer.address_line2 || '',
      customer.city || '',
      customer.state || '',
      customer.postal_code || '',
      customer.zone || '',
      (customer.notes || '').replace(/\n/g, ' '), // Replace newlines with spaces
      customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '',
      customer.updated_at ? new Date(customer.updated_at).toLocaleDateString() : ''
    ])

    // Convert to CSV format
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row =>
        row.map(field => {
          // Escape fields that contain commas, quotes, or newlines
          if (typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
            return `"${field.replace(/"/g, '""')}"`
          }
          return field
        }).join(',')
      )
    ].join('\n')

    const filename = `customers-${new Date().toISOString().split('T')[0]}.csv`

    return {
      ok: true,
      data: {
        csv: csvContent,
        filename
      }
    }
  }
)

/**
 * Bulk assign zone to multiple customers
 * Only accessible by dispatchers
 */
export const bulkAssignZone = makeDispatcherAction(
  BulkZoneAssignmentSchema,
  async (params, { user }): Promise<ActionResponse<{ updatedCount: number }>> => {
    const supabase = await getServerSupabase()
    // Use service role for update (permissions verified by makeDispatcherAction)
    const serviceSupabase = getServiceSupabase()
    const { customerIds, zone } = params

    // Update all selected customers' zones
    const { error, count } = await serviceSupabase
      .from('customers')
      .update({ zone })
      .in('id', customerIds)

    if (error) {
      throw new Error(`Failed to assign zones: ${error.message}`)
    }

    // Log the bulk action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'BULK_UPDATE',
        entity: 'customer',
        entity_id: null, // null for bulk operations
        meta: {
          customerIds,
          zone,
          updatedCount: count || 0
        }
      })

    revalidatePath('/customers')

    return {
      ok: true,
      data: { updatedCount: count || 0 }
    }
  }
)

/**
 * Gets customers for select dropdown (minimal fields)
 * Accessible by all authenticated users
 */
export const getCustomersForSelect = makeTechnicianAction(
  z.object({}),
  async (): Promise<Array<{
    id: string
    name: string
    address_line1: string | null
    city: string | null
    state: string | null
    postal_code: string | null
    zone: string | null
  }>> => {
    const supabase = await getServerSupabase()
    // Use service role for queries (permissions verified by makeTechnicianAction)
    const serviceSupabase = getServiceSupabase()

    const { data: customers, error } = await serviceSupabase
      .from('customers')
      .select('id, name, address_line1, city, state, postal_code, zone')
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch customers: ${error.message}`)
    }

    return customers || []
  }
)