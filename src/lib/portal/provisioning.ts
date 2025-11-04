// src/lib/portal/provisioning.ts
/**
 * Customer Portal Account Provisioning
 *
 * Automatically creates customer portal accounts when customers are added to the CRM.
 * Handles account creation, password generation, and welcome email sending.
 */

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/resend';
import * as Sentry from '@sentry/nextjs';

// ============================================================================
// Types
// ============================================================================

export interface PortalProvisioningResult {
  success: boolean;
  userId?: string;
  email: string;
  tempPassword?: string;
  accountExists?: boolean;
  error?: string;
}

export interface PortalStatus {
  accountExists: boolean;
  email: string;
  userId?: string;
  createdAt?: string;
  lastLogin?: string;
}

// ============================================================================
// Password Generation
// ============================================================================

/**
 * Generate a secure random password
 *
 * Password requirements:
 * - 12 characters minimum
 * - Mix of uppercase, lowercase, numbers, and special characters
 * - Excludes ambiguous characters (0, O, l, 1, I)
 */
function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%^&*';

  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining characters
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

// ============================================================================
// Account Checking
// ============================================================================

/**
 * Check if a portal account already exists for a customer
 */
export async function checkPortalAccountExists(
  email: string
): Promise<{ exists: boolean; userId?: string }> {
  const supabase = createClient();

  try {
    // Check in auth users
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error checking portal account:', error);
      Sentry.captureException(error);
      return { exists: false };
    }

    const existingUser = users?.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    return {
      exists: !!existingUser,
      userId: existingUser?.id,
    };
  } catch (error) {
    console.error('Error in checkPortalAccountExists:', error);
    Sentry.captureException(error);
    return { exists: false };
  }
}

/**
 * Get portal account status for a customer
 */
export async function getPortalStatus(customerId: string): Promise<PortalStatus | null> {
  const supabase = createClient();

  try {
    // Get customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('email, portal_account_created, portal_user_id')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      return null;
    }

    // Check if account exists in auth
    const accountCheck = await checkPortalAccountExists(customer.email);

    if (!accountCheck.exists) {
      return {
        accountExists: false,
        email: customer.email,
      };
    }

    // Get user details from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(
      accountCheck.userId!
    );

    return {
      accountExists: true,
      email: customer.email,
      userId: accountCheck.userId,
      createdAt: authUser.user?.created_at,
      lastLogin: authUser.user?.last_sign_in_at || undefined,
    };
  } catch (error) {
    console.error('Error getting portal status:', error);
    Sentry.captureException(error);
    return null;
  }
}

// ============================================================================
// Account Provisioning
// ============================================================================

/**
 * Provision a portal account for a customer
 *
 * This function:
 * 1. Checks if customer exists
 * 2. Checks if portal account already exists
 * 3. Creates auth account with temporary password
 * 4. Updates customer record
 * 5. Sends welcome email
 * 6. Creates audit log
 *
 * @param customerId - The customer ID to provision an account for
 * @param options - Optional configuration
 * @returns Provisioning result
 */
export async function provisionPortalAccount(
  customerId: string,
  options: {
    sendWelcomeEmail?: boolean;
    autoConfirmEmail?: boolean;
  } = {}
): Promise<PortalProvisioningResult> {
  const { sendWelcomeEmail = true, autoConfirmEmail = true } = options;

  const supabase = createClient();

  try {
    // Get customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found:', customerError);
      Sentry.captureException(customerError);
      return {
        success: false,
        email: '',
        error: 'Customer not found',
      };
    }

    // Validate email
    if (!customer.email || !customer.email.includes('@')) {
      console.error('Invalid customer email:', customer.email);
      return {
        success: false,
        email: customer.email || '',
        error: 'Customer does not have a valid email address',
      };
    }

    // Check if account already exists
    const accountCheck = await checkPortalAccountExists(customer.email);

    if (accountCheck.exists) {
      console.log(`Portal account already exists for ${customer.email}`);

      // Update customer record to reflect existing account
      await supabase
        .from('customers')
        .update({
          portal_account_created: true,
          portal_user_id: accountCheck.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      return {
        success: true,
        email: customer.email,
        userId: accountCheck.userId,
        accountExists: true,
      };
    }

    // Generate temporary password
    const tempPassword = generateSecurePassword();

    // Create auth account
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: customer.email,
      password: tempPassword,
      email_confirm: autoConfirmEmail, // Auto-confirm email
      user_metadata: {
        customer_id: customerId,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
      },
    });

    if (authError || !authData.user) {
      console.error('Failed to create portal account:', authError);
      Sentry.captureException(authError);
      return {
        success: false,
        email: customer.email,
        error: authError?.message || 'Failed to create auth account',
      };
    }

    // Update customer record
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        portal_account_created: true,
        portal_user_id: authData.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Failed to update customer record:', updateError);
      Sentry.captureException(updateError);
      // Don't fail the whole operation if this fails
    }

    // Send welcome email
    if (sendWelcomeEmail) {
      try {
        await sendEmail({
          to: customer.email,
          subject: 'Welcome to Your Dirt Free Customer Portal!',
          template: 'portal_welcome',
          data: {
            customerName: customer.first_name,
            email: customer.email,
            tempPassword: tempPassword,
            portalUrl: process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3009',
            resetUrl: `${process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3009'}/reset-password`,
          },
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        Sentry.captureException(emailError);
        // Don't fail the whole operation if email fails
      }
    }

    // Create audit log
    try {
      await supabase.from('audit_logs').insert({
        action: 'portal_account_created',
        resource_type: 'customer',
        resource_id: customerId,
        details: {
          email: customer.email,
          user_id: authData.user.id,
          auto_provisioned: true,
        },
        created_at: new Date().toISOString(),
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
      Sentry.captureException(auditError);
      // Don't fail the whole operation if audit log fails
    }

    console.log(`Portal account created for ${customer.email} (User ID: ${authData.user.id})`);

    return {
      success: true,
      userId: authData.user.id,
      email: customer.email,
      tempPassword: tempPassword,
      accountExists: false,
    };
  } catch (error) {
    console.error('Unexpected error in provisionPortalAccount:', error);
    Sentry.captureException(error);
    return {
      success: false,
      email: '',
      error: error instanceof Error ? error.message : 'Unexpected error',
    };
  }
}

/**
 * Provision portal accounts for multiple customers in batch
 */
export async function batchProvisionPortalAccounts(
  customerIds: string[],
  options: {
    sendWelcomeEmail?: boolean;
    autoConfirmEmail?: boolean;
  } = {}
): Promise<{
  successful: string[];
  failed: Array<{ customerId: string; error: string }>;
  skipped: string[];
}> {
  const results = {
    successful: [] as string[],
    failed: [] as Array<{ customerId: string; error: string }>,
    skipped: [] as string[],
  };

  for (const customerId of customerIds) {
    try {
      const result = await provisionPortalAccount(customerId, options);

      if (result.success) {
        if (result.accountExists) {
          results.skipped.push(customerId);
        } else {
          results.successful.push(customerId);
        }
      } else {
        results.failed.push({
          customerId,
          error: result.error || 'Unknown error',
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.failed.push({
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

// ============================================================================
// Password Reset
// ============================================================================

/**
 * Send password reset email for a portal account
 */
export async function sendPasswordReset(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = createClient();

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_PORTAL_URL}/reset-password`,
    });

    if (error) {
      console.error('Failed to send password reset:', error);
      Sentry.captureException(error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`Password reset email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Unexpected error in sendPasswordReset:', error);
    Sentry.captureException(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    };
  }
}

/**
 * Disable a portal account
 */
export async function disablePortalAccount(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = createClient();

  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: 'none', // Permanently ban
    });

    if (error) {
      console.error('Failed to disable portal account:', error);
      Sentry.captureException(error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`Portal account disabled for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Unexpected error in disablePortalAccount:', error);
    Sentry.captureException(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    };
  }
}

/**
 * Enable a previously disabled portal account
 */
export async function enablePortalAccount(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = createClient();

  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: '0s', // Remove ban
    });

    if (error) {
      console.error('Failed to enable portal account:', error);
      Sentry.captureException(error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`Portal account enabled for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Unexpected error in enablePortalAccount:', error);
    Sentry.captureException(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    };
  }
}
