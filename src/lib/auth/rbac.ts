/**
 * Role-Based Access Control (RBAC) System
 *
 * Implements fine-grained permissions for different user roles.
 * Provides helper functions for permission checks in API routes and UI components.
 *
 * Usage:
 * ```typescript
 * import { hasPermission, requirePermission } from '@/lib/auth/rbac'
 *
 * // Check permission
 * if (hasPermission(user.role, 'customers:write')) {
 *   // Allow action
 * }
 *
 * // Require permission in API route
 * const authError = await requirePermission('customers:write')(req)
 * if (authError) return authError
 * ```
 */

import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

// =====================================================
// Types
// =====================================================

/**
 * Available permissions in the system
 * Format: resource:action
 */
export type Permission =
  // Customer permissions
  | 'customers:read'
  | 'customers:write'
  | 'customers:delete'
  | 'customers:export'
  // Opportunity permissions
  | 'opportunities:read'
  | 'opportunities:write'
  | 'opportunities:delete'
  | 'opportunities:approve'
  // Promotion permissions
  | 'promotions:read'
  | 'promotions:write'
  | 'promotions:delete'
  | 'promotions:approve'
  // Job permissions
  | 'jobs:read'
  | 'jobs:write'
  | 'jobs:delete'
  | 'jobs:assign'
  // Invoice permissions
  | 'invoices:read'
  | 'invoices:write'
  | 'invoices:delete'
  | 'invoices:approve'
  // Analytics permissions
  | 'analytics:view_all'
  | 'analytics:view_own'
  | 'analytics:export'
  // Settings permissions
  | 'settings:manage'
  | 'settings:view'
  // User management permissions
  | 'users:manage'
  | 'users:view'
  // Report permissions
  | 'reports:view'
  | 'reports:export'
  // System permissions
  | 'system:admin'
  | 'system:jobs:manage'

/**
 * User roles in the system
 */
export type Role = 'admin' | 'dispatcher' | 'technician' | 'viewer' | 'marketing' | 'accountant'

/**
 * User context with role information
 */
export interface UserWithRole extends User {
  role: Role
}

// =====================================================
// Role Permissions Mapping
// =====================================================

/**
 * Define which permissions each role has
 */
export const rolePermissions: Record<Role, Permission[]> = {
  /**
   * Admin - Full system access
   */
  admin: [
    // Customers
    'customers:read',
    'customers:write',
    'customers:delete',
    'customers:export',
    // Opportunities
    'opportunities:read',
    'opportunities:write',
    'opportunities:delete',
    'opportunities:approve',
    // Promotions
    'promotions:read',
    'promotions:write',
    'promotions:delete',
    'promotions:approve',
    // Jobs
    'jobs:read',
    'jobs:write',
    'jobs:delete',
    'jobs:assign',
    // Invoices
    'invoices:read',
    'invoices:write',
    'invoices:delete',
    'invoices:approve',
    // Analytics
    'analytics:view_all',
    'analytics:export',
    // Settings
    'settings:manage',
    'settings:view',
    // Users
    'users:manage',
    'users:view',
    // Reports
    'reports:view',
    'reports:export',
    // System
    'system:admin',
    'system:jobs:manage',
  ],

  /**
   * Dispatcher - Manage customers, jobs, and opportunities
   */
  dispatcher: [
    // Customers
    'customers:read',
    'customers:write',
    'customers:export',
    // Opportunities
    'opportunities:read',
    'opportunities:write',
    // Jobs
    'jobs:read',
    'jobs:write',
    'jobs:assign',
    // Invoices
    'invoices:read',
    'invoices:write',
    // Analytics
    'analytics:view_all',
    'analytics:export',
    // Settings
    'settings:view',
    // Users
    'users:view',
    // Reports
    'reports:view',
    'reports:export',
  ],

  /**
   * Marketing - Manage promotions and view customer data
   */
  marketing: [
    // Customers
    'customers:read',
    'customers:export',
    // Opportunities
    'opportunities:read',
    // Promotions
    'promotions:read',
    'promotions:write',
    'promotions:delete',
    // Analytics
    'analytics:view_all',
    'analytics:export',
    // Reports
    'reports:view',
    'reports:export',
  ],

  /**
   * Accountant - Manage invoices and view financial data
   */
  accountant: [
    // Customers
    'customers:read',
    // Jobs
    'jobs:read',
    // Invoices
    'invoices:read',
    'invoices:write',
    'invoices:approve',
    // Analytics
    'analytics:view_all',
    'analytics:export',
    // Reports
    'reports:view',
    'reports:export',
  ],

  /**
   * Technician - View jobs and customers (limited access)
   */
  technician: [
    // Customers
    'customers:read',
    // Opportunities
    'opportunities:read',
    // Jobs
    'jobs:read',
    'jobs:write', // Can update job status
    // Analytics
    'analytics:view_own',
  ],

  /**
   * Viewer - Read-only access
   */
  viewer: [
    // Customers
    'customers:read',
    // Opportunities
    'opportunities:read',
    // Promotions
    'promotions:read',
    // Jobs
    'jobs:read',
    // Invoices
    'invoices:read',
    // Analytics
    'analytics:view_all',
    // Settings
    'settings:view',
    // Reports
    'reports:view',
  ],
}

// =====================================================
// Permission Check Functions
// =====================================================

/**
 * Check if a user role has a specific permission
 *
 * @param userRole - The role to check
 * @param permission - The permission to verify
 * @returns True if the role has the permission
 *
 * @example
 * ```typescript
 * if (hasPermission(user.role, 'customers:write')) {
 *   // User can edit customers
 * }
 * ```
 */
export function hasPermission(userRole: Role | undefined, permission: Permission): boolean {
  if (!userRole) return false
  return rolePermissions[userRole]?.includes(permission) ?? false
}

/**
 * Check if a user role has ANY of the specified permissions
 *
 * @param userRole - The role to check
 * @param permissions - Array of permissions to check
 * @returns True if the role has at least one permission
 *
 * @example
 * ```typescript
 * if (hasAnyPermission(user.role, ['customers:write', 'customers:delete'])) {
 *   // User can edit OR delete customers
 * }
 * ```
 */
export function hasAnyPermission(
  userRole: Role | undefined,
  permissions: Permission[]
): boolean {
  if (!userRole) return false
  return permissions.some((permission) => hasPermission(userRole, permission))
}

/**
 * Check if a user role has ALL of the specified permissions
 *
 * @param userRole - The role to check
 * @param permissions - Array of permissions to check
 * @returns True if the role has all permissions
 *
 * @example
 * ```typescript
 * if (hasAllPermissions(user.role, ['customers:read', 'customers:write'])) {
 *   // User can both read AND write customers
 * }
 * ```
 */
export function hasAllPermissions(
  userRole: Role | undefined,
  permissions: Permission[]
): boolean {
  if (!userRole) return false
  return permissions.every((permission) => hasPermission(userRole, permission))
}

/**
 * Get all permissions for a role
 *
 * @param role - The role to get permissions for
 * @returns Array of permissions
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return rolePermissions[role] || []
}

/**
 * Check if a role can access a resource (any action)
 *
 * @param userRole - The role to check
 * @param resource - The resource to check (e.g., 'customers', 'jobs')
 * @returns True if the role can access the resource
 *
 * @example
 * ```typescript
 * if (canAccessResource(user.role, 'customers')) {
 *   // Show customers menu item
 * }
 * ```
 */
export function canAccessResource(userRole: Role | undefined, resource: string): boolean {
  if (!userRole) return false
  const permissions = rolePermissions[userRole] || []
  return permissions.some((permission) => permission.startsWith(`${resource}:`))
}

// =====================================================
// API Route Middleware
// =====================================================

/**
 * Require a specific permission for an API route
 *
 * @param permission - The permission to require
 * @returns Middleware function that checks permission
 *
 * @example
 * ```typescript
 * export async function POST(req: Request) {
 *   const authError = await requirePermission('customers:write')(req)
 *   if (authError) return authError
 *
 *   // Process request...
 * }
 * ```
 */
export function requirePermission(permission: Permission) {
  return async (req: Request): Promise<Response | null> => {
    const user = await getCurrentUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!hasPermission(user.role, permission)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `You don't have permission to perform this action. Required: ${permission}`,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return null // Permission granted
  }
}

/**
 * Require ANY of the specified permissions
 *
 * @param permissions - Array of permissions (user needs at least one)
 * @returns Middleware function that checks permissions
 */
export function requireAnyPermission(permissions: Permission[]) {
  return async (req: Request): Promise<Response | null> => {
    const user = await getCurrentUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!hasAnyPermission(user.role, permissions)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `You don't have permission to perform this action. Required: ${permissions.join(' OR ')}`,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return null
  }
}

/**
 * Require ALL of the specified permissions
 *
 * @param permissions - Array of permissions (user needs all of them)
 * @returns Middleware function that checks permissions
 */
export function requireAllPermissions(permissions: Permission[]) {
  return async (req: Request): Promise<Response | null> => {
    const user = await getCurrentUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!hasAllPermissions(user.role, permissions)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `You don't have permission to perform this action. Required: ${permissions.join(' AND ')}`,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return null
  }
}

/**
 * Require admin role
 *
 * @returns Middleware function that checks for admin role
 */
export function requireAdmin() {
  return async (req: Request): Promise<Response | null> => {
    const user = await getCurrentUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (user.role !== 'admin') {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Admin access required',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return null
  }
}

// =====================================================
// User Helper Functions
// =====================================================

/**
 * Get current authenticated user with role
 *
 * @returns User with role or null if not authenticated
 */
export async function getCurrentUser(): Promise<UserWithRole | null> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return null
    }

    // Get user role from metadata or database
    // First check user metadata
    const roleFromMetadata = user.user_metadata?.role as Role | undefined

    if (roleFromMetadata) {
      return {
        ...user,
        role: roleFromMetadata,
      }
    }

    // Fallback: check users table
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = userData?.role as Role || 'viewer' // Default to viewer

    return {
      ...user,
      role,
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Get user role from user ID
 *
 * @param userId - The user ID to look up
 * @returns User role or null if not found
 */
export async function getUserRole(userId: string): Promise<Role | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (error || !data) {
      return null
    }

    return data.role as Role
  } catch (error) {
    console.error('Error getting user role:', error)
    return null
  }
}

/**
 * Update user role
 *
 * @param userId - The user ID to update
 * @param role - The new role
 * @returns True if successful
 */
export async function updateUserRole(userId: string, role: Role): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('users').update({ role }).eq('id', userId)

    if (error) {
      console.error('Error updating user role:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating user role:', error)
    return false
  }
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Get a human-readable description of a permission
 *
 * @param permission - The permission to describe
 * @returns Human-readable description
 */
export function getPermissionDescription(permission: Permission): string {
  const descriptions: Record<Permission, string> = {
    // Customers
    'customers:read': 'View customer information',
    'customers:write': 'Create and edit customers',
    'customers:delete': 'Delete customers',
    'customers:export': 'Export customer data',
    // Opportunities
    'opportunities:read': 'View opportunities',
    'opportunities:write': 'Create and edit opportunities',
    'opportunities:delete': 'Delete opportunities',
    'opportunities:approve': 'Approve opportunities',
    // Promotions
    'promotions:read': 'View promotions',
    'promotions:write': 'Create and edit promotions',
    'promotions:delete': 'Delete promotions',
    'promotions:approve': 'Approve promotions',
    // Jobs
    'jobs:read': 'View jobs',
    'jobs:write': 'Create and edit jobs',
    'jobs:delete': 'Delete jobs',
    'jobs:assign': 'Assign jobs to technicians',
    // Invoices
    'invoices:read': 'View invoices',
    'invoices:write': 'Create and edit invoices',
    'invoices:delete': 'Delete invoices',
    'invoices:approve': 'Approve invoices',
    // Analytics
    'analytics:view_all': 'View all analytics',
    'analytics:view_own': 'View own analytics',
    'analytics:export': 'Export analytics data',
    // Settings
    'settings:manage': 'Manage system settings',
    'settings:view': 'View system settings',
    // Users
    'users:manage': 'Manage users and roles',
    'users:view': 'View user list',
    // Reports
    'reports:view': 'View reports',
    'reports:export': 'Export reports',
    // System
    'system:admin': 'Full system administration',
    'system:jobs:manage': 'Manage background jobs',
  }

  return descriptions[permission] || permission
}

/**
 * Get a human-readable description of a role
 *
 * @param role - The role to describe
 * @returns Human-readable description
 */
export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    admin: 'Full system access - can manage all aspects of the system',
    dispatcher: 'Manage customers, jobs, and opportunities',
    marketing: 'Manage promotions and view customer analytics',
    accountant: 'Manage invoices and view financial data',
    technician: 'View assigned jobs and customer information',
    viewer: 'Read-only access to system data',
  }

  return descriptions[role] || role
}

/**
 * Check if a permission is valid
 *
 * @param permission - The permission to validate
 * @returns True if the permission exists in the system
 */
export function isValidPermission(permission: string): permission is Permission {
  const allPermissions = new Set<string>()
  Object.values(rolePermissions).forEach((perms) => {
    perms.forEach((p) => allPermissions.add(p))
  })
  return allPermissions.has(permission)
}

/**
 * Check if a role is valid
 *
 * @param role - The role to validate
 * @returns True if the role exists in the system
 */
export function isValidRole(role: string): role is Role {
  return role in rolePermissions
}
