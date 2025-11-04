'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server'
import {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  reauthSchema,
  inviteUserSchema,
  type LoginForm,
} from '@/lib/auth/schemas'
import { sendPasswordResetEmail, sendUserInvitation } from '@/lib/email/service'

// Result types for better type safety
type ActionResult = {
  success: boolean
  error?: string
  emailVerified?: boolean
}

export async function login(formData: LoginForm): Promise<ActionResult> {
  try {
    const validatedFields = loginSchema.safeParse(formData)

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid form data',
      }
    }

    const { email, password } = validatedFields.data
    const supabase = await getServerSupabase()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: 'Invalid credentials. Please check your email and password.',
      }
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Authentication failed',
      }
    }

    const emailVerified = !!data.user.email_confirmed_at

    return {
      success: true,
      emailVerified,
    }
  } catch (error) {
    console.error('Unexpected login error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

export async function logout(): Promise<ActionResult> {
  try {
    const supabase = await getServerSupabase()
    await supabase.auth.signOut()

    return {
      success: true,
    }
  } catch (error) {
    console.error('Logout error:', error)
    return {
      success: false,
      error: 'Failed to log out',
    }
  }
}

export async function resendVerification(): Promise<ActionResult> {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email!,
    })

    if (error) {
      console.error('Resend verification error:', error)
      return {
        success: false,
        error: 'Failed to send verification email',
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('Unexpected resend verification error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  try {
    const validatedFields = passwordResetRequestSchema.safeParse({ email })

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid email address',
      }
    }

    // Use our email service to send password reset
    const emailResult = await sendPasswordResetEmail(email)

    if (!emailResult.success) {
      console.error('Password reset email failed:', emailResult.error)
      // Don't reveal whether the email exists or not
    }

    // Always return success to prevent email enumeration
    return {
      success: true,
    }
  } catch (error) {
    console.error('Unexpected password reset request error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

export async function updatePassword(newPassword: string): Promise<ActionResult> {
  try {
    const validatedFields = passwordResetSchema.safeParse({
      password: newPassword,
      confirmPassword: newPassword,
    })

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid password format',
      }
    }

    const supabase = await getServerSupabase()

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('Password update error:', error)
      return {
        success: false,
        error: 'Failed to update password',
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('Unexpected password update error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

export async function reauthenticate(password: string): Promise<ActionResult> {
  try {
    const validatedFields = reauthSchema.safeParse({ password })

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Password is required',
      }
    }

    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    // Re-authenticate with current credentials
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    })

    if (error) {
      console.error('Reauthentication error:', error)
      return {
        success: false,
        error: 'Invalid password',
      }
    }

    // Set the reauthentication timestamp
    const cookieStore = await cookies()
    cookieStore.set('lastReauthAt', Date.now().toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error('Unexpected reauthentication error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}

export async function inviteUser(email: string): Promise<ActionResult> {
  try {
    const validatedFields = inviteUserSchema.safeParse({ email })

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Invalid email address',
      }
    }

    // Check if current user is admin
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    // Check admin role (temporary check - will be replaced with requireRole in P1.4)
    if (user.app_metadata?.role !== 'admin') {
      return {
        success: false,
        error: 'Insufficient permissions',
      }
    }

    // Get user profile for inviter name
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    // Use our email service to send invitation
    const emailResult = await sendUserInvitation(
      email,
      userProfile?.display_name || user.email || 'Admin'
    )

    if (!emailResult.success) {
      console.error('User invitation email failed:', emailResult.error)
      return {
        success: false,
        error: 'Failed to send invitation',
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('Unexpected user invitation error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}