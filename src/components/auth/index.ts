/**
 * Auth Components and Hooks
 *
 * Central export point for all authentication-related components and hooks.
 *
 * @module components/auth
 */

// Components
export {
  PermissionGuard,
  AdminOnly,
  RoleGuard,
  ResourceGuard,
  AuthenticatedOnly,
  UnauthenticatedOnly,
  type PermissionGuardProps,
} from './PermissionGuard'

// Auth Hooks
export {
  AuthProvider,
  useAuth,
  useUser,
  useRole,
  useIsAdmin,
  useHasRole,
} from './useAuth'

// Permission Hooks
export {
  usePermissions,
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions,
  useCanAccessResource,
  useUserPermissions,
} from './usePermissions'
