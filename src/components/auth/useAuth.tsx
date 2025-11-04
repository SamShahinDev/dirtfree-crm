/**
 * Authentication Hooks
 *
 * React hooks for accessing authentication state and user information.
 *
 * @module components/auth/useAuth
 */

'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { UserWithRole, Role, getUserRole } from '@/lib/auth/rbac'

/**
 * Authentication context interface
 */
interface AuthContextType {
  user: UserWithRole | null
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Authentication Provider Component
 *
 * Wrap your app with this provider to enable authentication hooks.
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  /**
   * Fetch user with role information
   */
  const fetchUser = async () => {
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !authUser) {
        setUser(null)
        setIsLoading(false)
        return
      }

      // Get role from metadata first
      const roleFromMetadata = authUser.user_metadata?.role as Role | undefined

      if (roleFromMetadata) {
        setUser({
          ...authUser,
          role: roleFromMetadata,
        })
        setIsLoading(false)
        return
      }

      // Fallback: get role from database
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', authUser.id)
        .single()

      const role = (userData?.role as Role) || 'viewer'

      setUser({
        ...authUser,
        role,
      })
    } catch (error) {
      console.error('Error fetching user:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Sign out user
   */
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  /**
   * Refresh user data
   */
  const refreshUser = async () => {
    setIsLoading(true)
    await fetchUser()
  }

  // Set up auth state listener
  useEffect(() => {
    // Initial fetch
    fetchUser()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await fetchUser()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signOut,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth Hook
 *
 * Access authentication state and user information.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isLoading, isAuthenticated, signOut } = useAuth()
 *
 *   if (isLoading) return <div>Loading...</div>
 *   if (!isAuthenticated) return <div>Please log in</div>
 *
 *   return (
 *     <div>
 *       <p>Welcome, {user.email}</p>
 *       <p>Role: {user.role}</p>
 *       <button onClick={signOut}>Sign Out</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

/**
 * useUser Hook
 *
 * Get the current user (shortcut for useAuth().user)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const user = useUser()
 *
 *   if (!user) return <div>Not logged in</div>
 *
 *   return <div>Welcome, {user.email}</div>
 * }
 * ```
 */
export function useUser(): UserWithRole | null {
  const { user } = useAuth()
  return user
}

/**
 * useRole Hook
 *
 * Get the current user's role
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const role = useRole()
 *
 *   return <div>Your role: {role || 'Not authenticated'}</div>
 * }
 * ```
 */
export function useRole(): Role | undefined {
  const { user } = useAuth()
  return user?.role
}

/**
 * useIsAdmin Hook
 *
 * Check if current user is an admin
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isAdmin = useIsAdmin()
 *
 *   if (!isAdmin) return <div>Admin access required</div>
 *
 *   return <AdminPanel />
 * }
 * ```
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth()
  return user?.role === 'admin'
}

/**
 * useHasRole Hook
 *
 * Check if current user has specific role(s)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const canManage = useHasRole(['admin', 'dispatcher'])
 *
 *   if (!canManage) return null
 *
 *   return <ManagementPanel />
 * }
 * ```
 */
export function useHasRole(roles: Role | Role[]): boolean {
  const { user } = useAuth()

  if (!user) return false

  const allowedRoles = Array.isArray(roles) ? roles : [roles]
  return allowedRoles.includes(user.role)
}
