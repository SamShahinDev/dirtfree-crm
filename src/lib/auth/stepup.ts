'use server'

import { cookies } from 'next/headers'
import { StepUpRequiredError } from './schemas'

const DEFAULT_MAX_AGE_SEC = 600 // 10 minutes

export async function requireRecentAuth(maxAgeSec: number = DEFAULT_MAX_AGE_SEC): Promise<void> {
  const cookieStore = await cookies()
  const lastReauthAt = cookieStore.get('lastReauthAt')

  if (!lastReauthAt) {
    throw new StepUpRequiredError('Recent authentication required')
  }

  const lastReauthTime = parseInt(lastReauthAt.value, 10)
  const now = Date.now()
  const ageInSeconds = (now - lastReauthTime) / 1000

  if (ageInSeconds > maxAgeSec) {
    throw new StepUpRequiredError('Recent authentication expired')
  }
}

export async function setReauthTimestamp(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('lastReauthAt', Date.now().toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
  })
}

export async function clearReauthTimestamp(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('lastReauthAt')
}

// Server action wrapper for step-up authentication
export function withStepUp<T extends any[], R>(
  action: (...args: T) => Promise<R>,
  maxAgeSec?: number
) {
  return async (...args: T): Promise<R | { stepUpRequired: true }> => {
    try {
      await requireRecentAuth(maxAgeSec)
      return await action(...args)
    } catch (error) {
      if (error instanceof StepUpRequiredError) {
        return { stepUpRequired: true }
      }
      throw error
    }
  }
}

// Example usage - sensitive action that requires step-up auth
export const sensitiveAction = withStepUp(async (data: { message: string }) => {
  // This would be a real sensitive operation
  console.log('Performing sensitive action:', data.message)
  return { success: true, message: 'Sensitive action completed' }
})

// Helper to check if recent auth exists without throwing
export async function hasRecentAuth(maxAgeSec: number = DEFAULT_MAX_AGE_SEC): Promise<boolean> {
  try {
    await requireRecentAuth(maxAgeSec)
    return true
  } catch {
    return false
  }
}