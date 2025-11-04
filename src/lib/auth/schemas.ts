import { z } from 'zod'

// Login form schema
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
})

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
})

// Password reset completion schema
export const passwordResetSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

// Re-authentication schema for step-up auth
export const reauthSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

// Admin invite schema
export const inviteUserSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
})

// Type exports
export type LoginForm = z.infer<typeof loginSchema>
export type PasswordResetRequestForm = z.infer<typeof passwordResetRequestSchema>
export type PasswordResetForm = z.infer<typeof passwordResetSchema>
export type ReauthForm = z.infer<typeof reauthSchema>
export type InviteUserForm = z.infer<typeof inviteUserSchema>

// Auth errors
export class StepUpRequiredError extends Error {
  constructor(message = 'Recent authentication required') {
    super(message)
    this.name = 'StepUpRequiredError'
  }
}

// Auth state types
export interface AuthUser {
  id: string
  email: string
  email_confirmed_at: string | null
  app_metadata: {
    role?: string
  }
  user_metadata: Record<string, any>
}