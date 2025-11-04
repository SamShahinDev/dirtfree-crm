'use server'

import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { makeAction, makeDispatcherAction, makeTechnicianAction } from '@/lib/actions'
import type { TruckCard, TruckTool, Truck } from '@/types/truck'

/**
 * List all trucks with aggregate data
 */
export const listTrucks = makeTechnicianAction(
  z.object({}),
  async (input, { user, role }): Promise<TruckCard[]> => {
    const supabase = await getServerSupabase()

    try {
      // Get all trucks
      const { data: trucks, error: trucksError } = await supabase
        .from('trucks')
        .select(`
          id,
          number,
          name,
          next_maintenance_date
        `)
        .order('number', { ascending: true })

      if (trucksError) {
        throw new Error(`Failed to fetch trucks: ${trucksError.message}`)
      }

      if (!trucks || trucks.length === 0) {
        return []
      }

      // Get low stock counts for all trucks
      const { data: toolCounts, error: toolsError } = await supabase
        .from('truck_tools')
        .select('truck_id, min_qty, qty_on_truck')

      if (toolsError) {
        console.error('Failed to fetch tool counts:', toolsError)
        // If truck_tools table doesn't exist, continue without tool counts
        if (toolsError.message.includes('does not exist')) {
          console.warn('Truck tools table does not exist, continuing without tool counts')
        }
      }

      // Calculate low stock counts per truck
      const lowStockMap = new Map<string, number>()
      if (toolCounts) {
        toolCounts.forEach(tool => {
          if (tool.qty_on_truck < tool.min_qty) {
            const current = lowStockMap.get(tool.truck_id) || 0
            lowStockMap.set(tool.truck_id, current + 1)
          }
        })
      }

      // Transform to TruckCard format
      return trucks.map(truck => ({
        id: truck.id,
        vehicleNumber: truck.number,
        nickname: truck.name,
        nextMaintenanceAt: truck.next_maintenance_date,
        openIssuesCount: 0, // Placeholder for P7.3 when threads are implemented
        lowStockCount: lowStockMap.get(truck.id) || 0,
        photoKey: null
      }))

    } catch (error) {
      console.error('Error fetching trucks:', error)
      throw new Error('Failed to fetch trucks')
    }
  }
)

/**
 * Get a single truck by ID
 */
export const getTruck = makeTechnicianAction(
  z.object({ id: z.string().uuid() }),
  async ({ id }, { user, role }): Promise<Truck | null> => {
    const supabase = await getServerSupabase()

    try {
      const { data, error } = await supabase
        .from('trucks')
        .select(`
          id,
          number,
          name,
          next_maintenance_date,
          created_at,
          updated_at
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Not found
        }
        throw new Error(`Failed to fetch truck: ${error.message}`)
      }

      return {
        id: data.id,
        vehicleNumber: data.number,
        nickname: data.name,
        nextMaintenanceAt: data.next_maintenance_date,
        photoKey: null,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }

    } catch (error) {
      console.error('Error fetching truck:', error)
      throw new Error('Failed to fetch truck')
    }
  }
)

/**
 * List tools for a specific truck
 */
export const listTruckTools = makeTechnicianAction(
  z.object({ id: z.string().uuid() }),
  async ({ id }, { user, role }): Promise<TruckTool[]> => {
    const supabase = await getServerSupabase()

    try {
      const { data, error } = await supabase
        .from('truck_tools')
        .select(`
          id,
          name,
          min_qty,
          qty_on_truck,
          calibration_due_at,
          last_calibrated_at
        `)
        .eq('truck_id', id)
        .order('name', { ascending: true })

      if (error) {
        // Check if this is a missing table/column error
        if (error.message.includes('does not exist')) {
          console.warn('Truck tools table/columns do not exist, returning empty array:', error.message)
          return []
        }
        throw new Error(`Failed to fetch truck tools: ${error.message}`)
      }

      return (data || []).map(tool => ({
        id: tool.id,
        name: tool.name,
        minQty: tool.min_qty,
        qtyOnTruck: tool.qty_on_truck,
        calibrationDueAt: tool.calibration_due_at,
        lastCalibratedAt: tool.last_calibrated_at
      }))

    } catch (error) {
      console.error('Error fetching truck tools:', error)
      // If it's a database schema issue, return empty array instead of failing
      if (error instanceof Error && error.message.includes('does not exist')) {
        console.warn('Returning empty tools array due to schema mismatch')
        return []
      }
      throw new Error('Failed to fetch truck tools')
    }
  }
)

/**
 * Update tool quantity on truck (dispatcher/admin only)
 */
export const updateToolQty = makeDispatcherAction(
  z.object({
    toolId: z.string().uuid(),
    qtyOnTruck: z.number().int().min(0).max(999)
  }),
  async ({ toolId, qtyOnTruck }, { user, role }): Promise<{ success: boolean }> => {
    const supabase = await getServerSupabase()

    try {
      // Update the tool quantity
      const { error: updateError } = await supabase
        .from('truck_tools')
        .update({
          qty_on_truck: qtyOnTruck,
          updated_at: new Date().toISOString()
        })
        .eq('id', toolId)

      if (updateError) {
        throw new Error(`Failed to update tool quantity: ${updateError.message}`)
      }

      // Write audit log
      await supabase
        .from('audit_logs')
        .insert({
          action: 'update_tool_qty',
          entity: 'truck_tool',
          entity_id: toolId,
          meta: {
            new_qty: qtyOnTruck
          }
        })

      return { success: true }

    } catch (error) {
      console.error('Error updating tool quantity:', error)
      throw new Error('Failed to update tool quantity')
    }
  }
)

/**
 * Create a low stock reminder for a tool (dispatcher/admin only)
 */
export const createLowStockReminder = makeDispatcherAction(
  z.object({
    truckId: z.string().uuid(),
    toolId: z.string().uuid()
  }),
  async ({ truckId, toolId }, { user, role }): Promise<{ ok: boolean; error?: string; reminderId?: string }> => {
    const supabase = await getServerSupabase()

    try {
      // Get truck and tool info
      const { data: truck, error: truckError } = await supabase
        .from('trucks')
        .select('number, name')
        .eq('id', truckId)
        .single()

      if (truckError || !truck) {
        throw new Error('Truck not found')
      }

      const { data: tool, error: toolError } = await supabase
        .from('truck_tools')
        .select('name, min_qty, qty_on_truck')
        .eq('id', toolId)
        .single()

      if (toolError || !tool) {
        throw new Error('Tool not found')
      }

      // Check if a low-stock reminder already exists for this truck+tool
      const { data: existingReminders, error: checkError } = await supabase
        .from('reminders')
        .select('id')
        .eq('type', 'follow_up')
        .eq('status', 'pending')
        .like('title', `%Restock ${tool.name}%`)
        .like('body', `%Truck #${truck.number}%`)

      if (checkError) {
        console.error('Error checking existing reminders:', checkError)
      }

      if (existingReminders && existingReminders.length > 0) {
        return { ok: false, error: 'A reminder for this tool already exists' }
      }

      // Create the reminder
      const vehicleLabel = truck.name
        ? `Truck #${truck.number} (${truck.name})`
        : `Truck #${truck.number}`

      const { data: reminder, error: createError } = await supabase
        .from('reminders')
        .insert({
          type: 'follow_up',
          title: `Restock ${tool.name}`,
          body: `Restock ${tool.name} on ${vehicleLabel}. Current: ${tool.qty_on_truck}, Minimum: ${tool.min_qty}`,
          customer_id: null,
          job_id: null,
          scheduled_date: new Date().toISOString().split('T')[0],
          status: 'pending'
        })
        .select('id')
        .single()

      if (createError) {
        throw new Error(`Failed to create reminder: ${createError.message}`)
      }

      // Write audit log
      await supabase
        .from('audit_logs')
        .insert({
          action: 'create_low_stock_reminder',
          entity: 'reminder',
          entity_id: reminder.id,
          meta: {
            truckId,
            toolId,
            toolName: tool.name,
            vehicleNumber: truck.number
          }
        })

      return { ok: true, reminderId: reminder.id }

    } catch (error) {
      console.error('Error creating low stock reminder:', error)
      throw new Error('Failed to create reminder')
    }
  }
)

/**
 * Upload truck photo (dispatcher/admin only)
 */
export const updateTruckPhoto = makeDispatcherAction(
  z.object({
    truckId: z.string().uuid(),
    photoKey: z.string()
  }),
  async ({ truckId, photoKey }, { user, role }): Promise<{ success: boolean }> => {
    const supabase = await getServerSupabase()

    try {
      const { error } = await supabase
        .from('trucks')
        .update({
          photo_key: photoKey,
          updated_at: new Date().toISOString()
        })
        .eq('id', truckId)

      if (error) {
        throw new Error(`Failed to update truck photo: ${error.message}`)
      }

      // Write audit log
      await supabase
        .from('audit_logs')
        .insert({
          action: 'update_truck_photo',
          entity: 'truck',
          entity_id: truckId,
          meta: {
            photo_key: photoKey.substring(0, 100) // Truncate for logging
          }
        })

      return { success: true }

    } catch (error) {
      console.error('Error updating truck photo:', error)
      throw new Error('Failed to update truck photo')
    }
  }
)

/**
 * Check if a low-stock reminder exists for a tool
 */
export const checkLowStockReminder = makeTechnicianAction(
  z.object({
    truckId: z.string().uuid(),
    toolId: z.string().uuid()
  }),
  async ({ truckId, toolId }, { user, role }): Promise<{ exists: boolean; reminderId?: string }> => {
    const supabase = await getServerSupabase()

    try {
      // Get truck and tool info to construct the reminder search
      const { data: truck } = await supabase
        .from('trucks')
        .select('number')
        .eq('id', truckId)
        .single()

      const { data: tool } = await supabase
        .from('truck_tools')
        .select('name')
        .eq('id', toolId)
        .single()

      if (!truck || !tool) {
        return { exists: false }
      }

      // Check for existing reminder
      const { data: reminders, error } = await supabase
        .from('reminders')
        .select('id')
        .eq('type', 'follow_up')
        .eq('status', 'pending')
        .like('title', `%Restock ${tool.name}%`)
        .like('body', `%Truck #${truck.number}%`)
        .limit(1)

      if (error) {
        console.error('Error checking reminder:', error)
        return { exists: false }
      }

      if (reminders && reminders.length > 0) {
        return { exists: true, reminderId: reminders[0].id }
      }

      return { exists: false }

    } catch (error) {
      console.error('Error checking low stock reminder:', error)
      return { exists: false }
    }
  }
)

/**
 * Assign a technician to a truck (admin/dispatcher only)
 */
export const assignTechnician = makeDispatcherAction(
  z.object({
    truckId: z.string().uuid(),
    userId: z.string().uuid()
  }),
  async ({ truckId, userId }, { user, role }): Promise<{ success: boolean }> => {
    const supabase = await getServerSupabase()

    try {
      // Insert assignment (ignore if exists due to unique constraint)
      const { error: insertError } = await supabase
        .from('truck_assignments')
        .insert({
          truck_id: truckId,
          user_id: userId,
          assigned_by: user.id
        })

      // If error is not a duplicate key violation, throw it
      if (insertError && !insertError.message.includes('duplicate key')) {
        throw new Error(`Failed to assign technician: ${insertError.message}`)
      }

      // Write audit log
      await supabase
        .from('audit_logs')
        .insert({
          action: 'assign_technician_to_truck',
          entity: 'truck_assignment',
          entity_id: `${truckId}-${userId}`,
          meta: {
            truck_id: truckId,
            user_id: userId
          }
        })

      return { success: true }

    } catch (error) {
      console.error('Error assigning technician:', error)
      throw new Error('Failed to assign technician')
    }
  }
)

/**
 * Unassign a technician from a truck (admin/dispatcher only)
 */
export const unassignTechnician = makeDispatcherAction(
  z.object({
    truckId: z.string().uuid(),
    userId: z.string().uuid()
  }),
  async ({ truckId, userId }, { user, role }): Promise<{ success: boolean }> => {
    const supabase = await getServerSupabase()

    try {
      const { error } = await supabase
        .from('truck_assignments')
        .delete()
        .eq('truck_id', truckId)
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to unassign technician: ${error.message}`)
      }

      // Write audit log
      await supabase
        .from('audit_logs')
        .insert({
          action: 'unassign_technician_from_truck',
          entity: 'truck_assignment',
          entity_id: `${truckId}-${userId}`,
          meta: {
            truck_id: truckId,
            user_id: userId
          }
        })

      return { success: true }

    } catch (error) {
      console.error('Error unassigning technician:', error)
      throw new Error('Failed to unassign technician')
    }
  }
)

/**
 * List assigned technicians for a truck
 */
export const listTruckAssignments = makeDispatcherAction(
  z.object({ truckId: z.string().uuid() }),
  async ({ truckId }, { user, role }): Promise<Array<{
    id: string
    userId: string
    userName: string
    assignedAt: string
    assignedBy: string | null
  }>> => {
    const supabase = await getServerSupabase()

    try {
      const { data, error } = await supabase
        .from('truck_assignments')
        .select(`
          id,
          user_id,
          assigned_at,
          assigned_by,
          users!truck_assignments_user_id_fkey(name),
          assignedBy:users!truck_assignments_assigned_by_fkey(name)
        `)
        .eq('truck_id', truckId)
        .order('assigned_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch assignments: ${error.message}`)
      }

      return (data || []).map(assignment => ({
        id: assignment.id,
        userId: assignment.user_id,
        userName: assignment.users?.name || 'Unknown',
        assignedAt: assignment.assigned_at,
        assignedBy: assignment.assignedBy?.name || null
      }))

    } catch (error) {
      console.error('Error fetching truck assignments:', error)
      throw new Error('Failed to fetch truck assignments')
    }
  }
)

/**
 * List available technicians for assignment
 */
export const listAvailableTechnicians = makeDispatcherAction(
  z.object({ truckId: z.string().uuid() }),
  async ({ truckId }, { user, role }): Promise<Array<{
    id: string
    name: string
    email: string
  }>> => {
    const supabase = await getServerSupabase()

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          user_roles!inner(role)
        `)
        .eq('user_roles.role', 'technician')
        .eq('active', true)
        .not('id', 'in', `(
          SELECT user_id FROM truck_assignments WHERE truck_id = '${truckId}'
        )`)
        .order('name', { ascending: true })

      if (error) {
        throw new Error(`Failed to fetch technicians: ${error.message}`)
      }

      return (data || []).map(tech => ({
        id: tech.id,
        name: tech.name || 'Unknown',
        email: tech.email || ''
      }))

    } catch (error) {
      console.error('Error fetching available technicians:', error)
      throw new Error('Failed to fetch available technicians')
    }
  }
)