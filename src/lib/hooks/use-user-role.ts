'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppRole } from '@/lib/auth/roles'
import type { User } from '@supabase/supabase-js'

interface UserRoleData {
  role: AppRole | null
  isAdmin: boolean
  isDispatcher: boolean
  isTechnician: boolean
  loading: boolean
  error: string | null
  user: any | null
}

// Cache for user role data to persist across navigation
let cachedData: UserRoleData | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function useUserRole(): UserRoleData {
  const [data, setData] = useState<UserRoleData>(() => {
    // Use cached data if available and not stale
    if (cachedData && Date.now() - cacheTimestamp < CACHE_DURATION) {
      return { ...cachedData, loading: false }
    }
    return {
      role: null,
      isAdmin: false,
      isDispatcher: false,
      isTechnician: false,
      loading: true,
      error: null,
      user: null
    }
  })

  const retryTimeoutRef = useRef<NodeJS.Timeout>()
  const isMountedRef = useRef(true)

  const fetchUserRole = useCallback(async (retryCount = 0) => {
    try {
      const supabase = createClient()

      // Get current user with retry logic
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (!isMountedRef.current) return

      if (userError) {
        // If it's a network error and we have cached data, use it
        if (cachedData && userError.message?.includes('fetch')) {
          setData({ ...cachedData, loading: false })
          return
        }

        // Retry logic for transient errors
        if (retryCount < 3 && userError.message?.includes('fetch')) {
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchUserRole(retryCount + 1)
            }
          }, 1000 * (retryCount + 1))
          return
        }

        const newData = {
          role: null,
          isAdmin: false,
          isDispatcher: false,
          isTechnician: false,
          loading: false,
          error: userError.message,
          user: null
        }
        setData(newData)
        return
      }

      if (!user) {
        const newData = {
          role: null,
          isAdmin: false,
          isDispatcher: false,
          isTechnician: false,
          loading: false,
          error: 'No user found',
          user: null
        }
        setData(newData)
        cachedData = null
        return
      }

      // Get user profile with role
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, display_name')
        .eq('user_id', user.id)
        .single()

      if (!isMountedRef.current) return

      if (profileError) {
        // Use cached data if available on profile fetch error
        if (cachedData && profileError.message?.includes('fetch')) {
          setData({ ...cachedData, loading: false })
          return
        }

        // Default to technician role if profile doesn't exist yet
        const newData = {
          role: 'technician' as AppRole,
          isAdmin: false,
          isDispatcher: false,
          isTechnician: true,
          loading: false,
          error: null,
          user
        }
        setData(newData)
        cachedData = newData
        cacheTimestamp = Date.now()
        return
      }

      const role = (profile?.role || 'technician') as AppRole

      const newData = {
        role,
        isAdmin: role === 'admin',
        isDispatcher: role === 'dispatcher',
        isTechnician: role === 'technician',
        loading: false,
        error: null,
        user: {
          ...user,
          display_name: profile?.display_name || user.email
        }
      }

      setData(newData)
      cachedData = newData
      cacheTimestamp = Date.now()

    } catch (error) {
      if (!isMountedRef.current) return

      // If we have cached data and it's a network error, use cached
      if (cachedData && error instanceof Error && error.message?.includes('fetch')) {
        setData({ ...cachedData, loading: false })
        return
      }

      const newData = {
        role: null,
        isAdmin: false,
        isDispatcher: false,
        isTechnician: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user role',
        user: null
      }
      setData(newData)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    // Only fetch if we don't have cached data or it's stale
    if (!cachedData || Date.now() - cacheTimestamp >= CACHE_DURATION) {
      fetchUserRole()
    } else {
      setData({ ...cachedData, loading: false })
    }

    // Listen for auth state changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Clear cache and refetch on auth changes
        cachedData = null
        cacheTimestamp = 0
        if (isMountedRef.current) {
          fetchUserRole()
        }
      } else if (event === 'SIGNED_OUT') {
        cachedData = null
        cacheTimestamp = 0
        if (isMountedRef.current) {
          setData({
            role: null,
            isAdmin: false,
            isDispatcher: false,
            isTechnician: false,
            loading: false,
            error: null,
            user: null
          })
        }
      }
    })

    return () => {
      isMountedRef.current = false
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      subscription.unsubscribe()
    }
  }, [])

  return data
}

// Helper function to check if user has minimum role
export function hasMinimumRole(userRole: AppRole | null, requiredRole: AppRole): boolean {
  if (!userRole) return false

  const roleHierarchy = {
    technician: 1,
    dispatcher: 2,
    admin: 3
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

// Helper function to check if user can access a resource
export function canAccess(userRole: AppRole | null, requiredRoles: AppRole[]): boolean {
  if (!userRole) return false
  return requiredRoles.includes(userRole)
}