import { redirect } from 'next/navigation'
import { AppRole, getSessionUser, getUserRole, hasMinimumRole } from './roles'

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized access') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class UnauthenticatedError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message)
    this.name = 'UnauthenticatedError'
  }
}

export async function requireAuth(redirectTo?: string): Promise<NonNullable<Awaited<ReturnType<typeof getSessionUser>>>> {
  const user = await getSessionUser()

  if (!user) {
    if (redirectTo) {
      redirect(redirectTo)
    }
    throw new UnauthenticatedError()
  }

  return user
}

export async function requireRole(
  minimumRole: AppRole,
  options?: {
    redirectTo?: string
    userId?: string
  }
): Promise<void> {
  const { redirectTo, userId } = options || {}

  // First ensure user is authenticated
  await requireAuth(redirectTo)

  // Check role authorization
  const hasAccess = await hasMinimumRole(minimumRole, userId)

  if (!hasAccess) {
    if (redirectTo) {
      redirect(redirectTo)
    }
    throw new UnauthorizedError(`Minimum role required: ${minimumRole}`)
  }
}

export async function requireAdmin(options?: { redirectTo?: string; userId?: string }): Promise<void> {
  await requireRole('admin', options)
}

export async function requireDispatcher(options?: { redirectTo?: string; userId?: string }): Promise<void> {
  await requireRole('dispatcher', options)
}

export async function requireTechnician(options?: { redirectTo?: string; userId?: string }): Promise<void> {
  await requireRole('technician', options)
}

// Helper for checking if current user can access a specific user's data
export async function requireUserAccess(
  targetUserId: string,
  options?: { redirectTo?: string }
): Promise<void> {
  const currentUser = await requireAuth(options?.redirectTo)
  const currentRole = await getUserRole(currentUser.id)

  // Admins and dispatchers can access any user's data
  if (currentRole === 'admin' || currentRole === 'dispatcher') {
    return
  }

  // Technicians can only access their own data
  if (currentUser.id !== targetUserId) {
    if (options?.redirectTo) {
      redirect(options.redirectTo)
    }
    throw new UnauthorizedError('Cannot access other user data')
  }
}