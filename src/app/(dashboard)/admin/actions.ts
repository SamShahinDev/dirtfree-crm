'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase } from '@/lib/supabase/server'
import { makeAdminAction } from '@/lib/actions'

// Input validation schemas
const CreateUserProfileSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'dispatcher', 'technician']),
  display_name: z.string().min(1, 'Display name is required'),
  phone_e164: z.string().regex(/^\+[1-9][0-9]{6,}$/, 'Invalid phone number format').optional(),
  zone: z.enum(['N', 'S', 'E', 'W', 'Central']).optional(),
})

const UpdateUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'dispatcher', 'technician']),
})

const GetAuditLogsSchema = z.object({
  actor_id: z.string().uuid().optional(),
  entity: z.string().optional(),
  action: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.number().min(1).max(200).default(100),
  offset: z.number().min(0).default(0),
})

const GetUsersSchema = z.object({
  role: z.enum(['admin', 'dispatcher', 'technician']).optional(),
  zone: z.enum(['N', 'S', 'E', 'W', 'Central']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

// Admin-only actions

// Create user profile after invite acceptance
export const createUserProfile = makeAdminAction(
  CreateUserProfileSchema,
  async (input, { user }) => {
    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('user_profiles')
      .insert(input)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create user profile: ${error.message}`)
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'CREATE',
        entity: 'user_profile',
        entity_id: data.id,
        meta: { role: input.role, display_name: input.display_name }
      })

    revalidatePath('/admin/users')
    return data
  }
)

// Update user role
export const updateUserRole = makeAdminAction(
  UpdateUserRoleSchema,
  async (input, { user }) => {
    const supabase = await getServerSupabase()

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role: input.role })
      .eq('user_id', input.user_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`)
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'user_profile',
        entity_id: data.id,
        meta: { role_change: input.role, target_user: input.user_id }
      })

    revalidatePath('/admin/users')
    return data
  }
)

// Get audit logs for admin review
export const getAuditLogs = makeAdminAction(
  GetAuditLogsSchema,
  async (input) => {
    const supabase = await getServerSupabase()

    let query = supabase
      .from('audit_log')
      .select(`
        *,
        actor:user_profiles!audit_log_actor_id_fkey(display_name)
      `)
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1)

    // Apply filters
    if (input.actor_id) {
      query = query.eq('actor_id', input.actor_id)
    }

    if (input.entity) {
      query = query.eq('entity', input.entity)
    }

    if (input.action) {
      query = query.eq('action', input.action)
    }

    if (input.start_date) {
      query = query.gte('created_at', input.start_date)
    }

    if (input.end_date) {
      query = query.lte('created_at', input.end_date)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`)
    }

    return data || []
  }
)

// Get all users with profiles
export const getUsers = makeAdminAction(
  GetUsersSchema,
  async (input) => {
    const supabase = await getServerSupabase()

    let query = supabase
      .from('user_profiles')
      .select(`
        *,
        user:users!user_profiles_user_id_fkey(id, email, created_at)
      `)
      .order('display_name')
      .range(input.offset, input.offset + input.limit - 1)

    // Apply filters
    if (input.role) {
      query = query.eq('role', input.role)
    }

    if (input.zone) {
      query = query.eq('zone', input.zone)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }

    return data || []
  }
)

// Deactivate user (admin-only for security)
export const deactivateUser = makeAdminAction(
  z.object({ user_id: z.string().uuid() }),
  async (input, { user }) => {
    const supabase = await getServerSupabase()

    // Use admin client to update auth.users
    const { error } = await supabase.auth.admin.updateUserById(
      input.user_id,
      { ban_duration: '876000h' } // Ban for 100 years (effectively permanent)
    )

    if (error) {
      throw new Error(`Failed to deactivate user: ${error.message}`)
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'DEACTIVATE',
        entity: 'user',
        entity_id: input.user_id,
        meta: { reason: 'Admin deactivation' }
      })

    revalidatePath('/admin/users')
    return { success: true }
  }
)

// Get system statistics (admin dashboard)
export const getSystemStats = makeAdminAction(
  z.object({}),
  async () => {
    const supabase = await getServerSupabase()

    // Get counts for various entities
    const [
      { count: totalCustomers },
      { count: totalJobs },
      { count: activeUsers },
      { count: pendingReminders },
    ] = await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('jobs').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])

    return {
      totalCustomers: totalCustomers || 0,
      totalJobs: totalJobs || 0,
      activeUsers: activeUsers || 0,
      pendingReminders: pendingReminders || 0,
    }
  }
)