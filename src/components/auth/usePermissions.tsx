/**
 * Permission Hooks
 *
 * React hooks for checking user permissions.
 *
 * @module components/auth/usePermissions
 */

'use client'

import { useUser, useRole } from './useAuth'
import {
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessResource,
  getPermissionsForRole,
} from '@/lib/auth/rbac'

/**
 * usePermissions Hook
 *
 * Get permission checking functions for the current user.
 *
 * @example
 * ```tsx
 * function CustomerList() {
 *   const { can, canAny, canAll, canAccess } = usePermissions()
 *
 *   return (
 *     <div>
 *       {can('customers:write') && <AddButton />}
 *       {canAny(['customers:write', 'customers:delete']) && <ActionMenu />}
 *       {canAccess('analytics') && <AnalyticsLink />}
 *     </div>
 *   )
 * }
 * ```
 */
export function usePermissions() {
  const role = useRole()

  /**
   * Check if user has a specific permission
   */
  const can = (permission: Permission): boolean => {
    return hasPermission(role, permission)
  }

  /**
   * Check if user has any of the specified permissions
   */
  const canAny = (permissions: Permission[]): boolean => {
    return hasAnyPermission(role, permissions)
  }

  /**
   * Check if user has all of the specified permissions
   */
  const canAll = (permissions: Permission[]): boolean => {
    return hasAllPermissions(role, permissions)
  }

  /**
   * Check if user can access a resource (has any permission for it)
   */
  const canAccess = (resource: string): boolean => {
    return canAccessResource(role, resource)
  }

  /**
   * Get all permissions for current user's role
   */
  const getPermissions = (): Permission[] => {
    if (!role) return []
    return getPermissionsForRole(role)
  }

  return {
    can,
    canAny,
    canAll,
    canAccess,
    getPermissions,
  }
}

/**
 * useHasPermission Hook
 *
 * Check if current user has a specific permission.
 *
 * @example
 * ```tsx
 * function EditButton() {
 *   const canEdit = useHasPermission('customers:write')
 *
 *   if (!canEdit) return null
 *
 *   return <button>Edit</button>
 * }
 * ```
 */
export function useHasPermission(permission: Permission): boolean {
  const role = useRole()
  return hasPermission(role, permission)
}

/**
 * useHasAnyPermission Hook
 *
 * Check if current user has any of the specified permissions.
 *
 * @example
 * ```tsx
 * function ActionMenu() {
 *   const canTakeAction = useHasAnyPermission([
 *     'customers:write',
 *     'customers:delete'
 *   ])
 *
 *   if (!canTakeAction) return null
 *
 *   return <Menu />
 * }
 * ```
 */
export function useHasAnyPermission(permissions: Permission[]): boolean {
  const role = useRole()
  return hasAnyPermission(role, permissions)
}

/**
 * useHasAllPermissions Hook
 *
 * Check if current user has all of the specified permissions.
 *
 * @example
 * ```tsx
 * function AdvancedFeature() {
 *   const hasFullAccess = useHasAllPermissions([
 *     'customers:read',
 *     'analytics:view_all'
 *   ])
 *
 *   if (!hasFullAccess) return null
 *
 *   return <AdvancedPanel />
 * }
 * ```
 */
export function useHasAllPermissions(permissions: Permission[]): boolean {
  const role = useRole()
  return hasAllPermissions(role, permissions)
}

/**
 * useCanAccessResource Hook
 *
 * Check if current user has any permissions for a resource.
 *
 * @example
 * ```tsx
 * function NavigationMenu() {
 *   const canAccessCustomers = useCanAccessResource('customers')
 *   const canAccessAnalytics = useCanAccessResource('analytics')
 *
 *   return (
 *     <nav>
 *       {canAccessCustomers && <Link href="/customers">Customers</Link>}
 *       {canAccessAnalytics && <Link href="/analytics">Analytics</Link>}
 *     </nav>
 *   )
 * }
 * ```
 */
export function useCanAccessResource(resource: string): boolean {
  const role = useRole()
  return canAccessResource(role, resource)
}

/**
 * useUserPermissions Hook
 *
 * Get all permissions for the current user.
 *
 * @example
 * ```tsx
 * function PermissionsList() {
 *   const permissions = useUserPermissions()
 *
 *   return (
 *     <ul>
 *       {permissions.map(permission => (
 *         <li key={permission}>{permission}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useUserPermissions(): Permission[] {
  const role = useRole()
  if (!role) return []
  return getPermissionsForRole(role)
}
