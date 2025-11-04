'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserRole, canAccess } from '@/lib/hooks/use-user-role'
import type { AppRole } from '@/lib/auth/roles'

interface RoleGuardProps {
  children: React.ReactNode
  requiredRoles: AppRole[]
  fallbackPath?: string
  loadingComponent?: React.ReactNode
}

export function RoleGuard({
  children,
  requiredRoles,
  fallbackPath = '/dashboard',
  loadingComponent
}: RoleGuardProps) {
  const { role, loading, error } = useUserRole()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    // If there's an error or no role, redirect to login
    if (error || !role) {
      router.push('/login')
      return
    }

    // If user doesn't have required role, redirect to fallback
    if (!canAccess(role, requiredRoles)) {
      router.push(fallbackPath)
      return
    }
  }, [role, loading, error, requiredRoles, fallbackPath, router])

  // Show loading state
  if (loading) {
    return loadingComponent || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Show nothing if redirecting
  if (error || !role || !canAccess(role, requiredRoles)) {
    return null
  }

  // Show children if user has access
  return <>{children}</>
}

// Higher-order component for page-level protection
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles: AppRole[],
  fallbackPath?: string
) {
  return function ProtectedComponent(props: P) {
    return (
      <RoleGuard requiredRoles={requiredRoles} fallbackPath={fallbackPath}>
        <Component {...props} />
      </RoleGuard>
    )
  }
}