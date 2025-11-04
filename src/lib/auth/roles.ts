import { getServerSupabase } from '@/lib/supabase/server'

export type AppRole = 'admin' | 'dispatcher' | 'technician'

export async function getSessionUser() {
  // Development mode bypass - disabled, using real auth
  if (false) { // Was: process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true'
    return {
      id: 'dev-user-123',
      email: 'dev@example.com',
      user_metadata: { role: 'admin' },
      raw_user_meta_data: { role: 'admin' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00.000Z',
      phone: '',
      phone_confirmed_at: null,
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
      last_sign_in_at: '2024-01-01T00:00:00.000Z',
      role: 'authenticated',
      updated_at: '2024-01-01T00:00:00.000Z',
      identities: [],
      is_anonymous: false,
      factors: []
    }
  }

  const supabase = await getServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function getUserRole(userId?: string): Promise<AppRole | null> {
  // Development mode bypass - disabled, using real auth
  if (false) { // Was: process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true'
    return 'admin'
  }

  const supabase = await getServerSupabase()

  let targetUserId = userId
  if (!targetUserId) {
    const user = await getSessionUser()
    if (!user) return null
    targetUserId = user.id
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', targetUserId)
    .single()

  if (error || !data) {
    return 'technician' // Default role
  }

  return data.role as AppRole
}

export async function isAdmin(userId?: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'admin'
}

export async function isDispatcher(userId?: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'dispatcher'
}

export async function isTechnician(userId?: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'technician'
}

export async function hasAdminAccess(userId?: string): Promise<boolean> {
  return await isAdmin(userId)
}

export async function hasDispatcherAccess(userId?: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'admin' || role === 'dispatcher'
}

export async function hasTechnicianAccess(userId?: string): Promise<boolean> {
  const role = await getUserRole(userId)
  return role === 'admin' || role === 'dispatcher' || role === 'technician'
}

export function roleHierarchy(role: AppRole): number {
  switch (role) {
    case 'admin': return 3
    case 'dispatcher': return 2
    case 'technician': return 1
    default: return 0
  }
}

export async function hasMinimumRole(minimumRole: AppRole, userId?: string): Promise<boolean> {
  const userRole = await getUserRole(userId)
  if (!userRole) return false

  return roleHierarchy(userRole) >= roleHierarchy(minimumRole)
}