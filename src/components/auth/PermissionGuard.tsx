/**
 * Permission Guard Components
 *
 * React components for conditionally rendering UI based on user permissions.
 * Integrates with the RBAC system and authentication context.
 *
 * @module components/auth/PermissionGuard
 */

'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import {
  Permission,
  Role,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessResource,
} from '@/lib/auth/rbac'

/**
 * Props for PermissionGuard component
 */
export interface PermissionGuardProps {
  /**
   * Single permission required to render children
   */
  permission?: Permission

  /**
   * Multiple permissions - user must have at least one
   */
  anyPermission?: Permission[]

  /**
   * Multiple permissions - user must have all of them
   */
  allPermissions?: Permission[]

  /**
   * Require specific role(s)
   */
  roles?: Role | Role[]

  /**
   * Require admin role
   */
  requireAdmin?: boolean

  /**
   * Content to render when permission check passes
   */
  children: ReactNode

  /**
   * Optional content to render when permission check fails
   */
  fallback?: ReactNode

  /**
   * Custom permission check function
   */
  customCheck?: (role: Role | undefined) => boolean
}

/**
 * Permission Guard Component
 *
 * Conditionally renders children based on user permissions.
 *
 * @example Single permission
 * ```tsx
 * <PermissionGuard permission="customers:write">
 *   <EditButton />
 * </PermissionGuard>
 * ```
 *
 * @example Multiple permissions (any)
 * ```tsx
 * <PermissionGuard anyPermission={['customers:write', 'customers:delete']}>
 *   <ActionMenu />
 * </PermissionGuard>
 * ```
 *
 * @example Multiple permissions (all)
 * ```tsx
 * <PermissionGuard allPermissions={['customers:read', 'analytics:view_all']}>
 *   <CustomerAnalytics />
 * </PermissionGuard>
 * ```
 *
 * @example With fallback
 * ```tsx
 * <PermissionGuard
 *   permission="settings:manage"
 *   fallback={<div>You don't have access to settings</div>}
 * >
 *   <SettingsPanel />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  permission,
  anyPermission,
  allPermissions,
  roles,
  requireAdmin,
  children,
  fallback = null,
  customCheck,
}: PermissionGuardProps) {
  const { user, isLoading } = useAuth()

  // Show nothing while loading
  if (isLoading) {
    return null
  }

  // Not authenticated - show fallback
  if (!user) {
    return <>{fallback}</>
  }

  const userRole = user.role

  // Admin check
  if (requireAdmin && userRole !== 'admin') {
    return <>{fallback}</>
  }

  // Role check
  if (roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles]
    if (!allowedRoles.includes(userRole)) {
      return <>{fallback}</>
    }
  }

  // Single permission check
  if (permission && !hasPermission(userRole, permission)) {
    return <>{fallback}</>
  }

  // Any permission check
  if (anyPermission && anyPermission.length > 0) {
    if (!hasAnyPermission(userRole, anyPermission)) {
      return <>{fallback}</>
    }
  }

  // All permissions check
  if (allPermissions && allPermissions.length > 0) {
    if (!hasAllPermissions(userRole, allPermissions)) {
      return <>{fallback}</>
    }
  }

  // Custom check
  if (customCheck && !customCheck(userRole)) {
    return <>{fallback}</>
  }

  // All checks passed - render children
  return <>{children}</>
}

/**
 * Admin Only Guard
 *
 * Shortcut component for admin-only content.
 *
 * @example
 * ```tsx
 * <AdminOnly>
 *   <AdminPanel />
 * </AdminOnly>
 * ```
 */
export function AdminOnly({
  children,
  fallback,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return (
    <PermissionGuard requireAdmin fallback={fallback}>
      {children}
    </PermissionGuard>
  )
}

/**
 * Role Guard Component
 *
 * Conditionally renders based on user role.
 *
 * @example
 * ```tsx
 * <RoleGuard roles={['admin', 'dispatcher']}>
 *   <ManagementDashboard />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({
  roles,
  children,
  fallback,
}: {
  roles: Role | Role[]
  children: ReactNode
  fallback?: ReactNode
}) {
  return (
    <PermissionGuard roles={roles} fallback={fallback}>
      {children}
    </PermissionGuard>
  )
}

/**
 * Resource Access Guard
 *
 * Shows content if user has ANY permission for a resource.
 *
 * @example
 * ```tsx
 * <ResourceGuard resource="customers">
 *   <CustomerSection />
 * </ResourceGuard>
 * ```
 */
export function ResourceGuard({
  resource,
  children,
  fallback,
}: {
  resource: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const { user } = useAuth()

  if (!user || !canAccessResource(user.role, resource)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Authenticated Guard
 *
 * Shows content only to authenticated users.
 *
 * @example
 * ```tsx
 * <AuthenticatedOnly fallback={<LoginPrompt />}>
 *   <Dashboard />
 * </AuthenticatedOnly>
 * ```
 */
export function AuthenticatedOnly({
  children,
  fallback,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!user) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Unauthenticated Guard
 *
 * Shows content only to non-authenticated users (e.g., login page).
 *
 * @example
 * ```tsx
 * <UnauthenticatedOnly>
 *   <LoginForm />
 * </UnauthenticatedOnly>
 * ```
 */
export function UnauthenticatedOnly({
  children,
  fallback,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (user) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
