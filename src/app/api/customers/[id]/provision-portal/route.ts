// src/app/api/customers/[id]/provision-portal/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  provisionPortalAccount,
  getPortalStatus,
  sendPasswordReset,
} from '@/lib/portal/provisioning';
import * as Sentry from '@sentry/nextjs';

/**
 * GET /api/customers/[id]/provision-portal
 * Get portal account status for a customer
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;

    // Get portal status
    const status = await getPortalStatus(customerId);

    if (!status) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting portal status:', error);
    Sentry.captureException(error);

    return NextResponse.json(
      { error: 'Failed to get portal status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/customers/[id]/provision-portal
 * Manually provision a portal account for a customer
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const body = await req.json().catch(() => ({}));

    const {
      sendWelcomeEmail = true,
      autoConfirmEmail = true,
    } = body;

    // Provision the account
    const result = await provisionPortalAccount(customerId, {
      sendWelcomeEmail,
      autoConfirmEmail,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to provision portal account',
        },
        { status: 400 }
      );
    }

    // Get updated status
    const status = await getPortalStatus(customerId);

    return NextResponse.json({
      success: true,
      message: result.accountExists
        ? 'Portal account already exists'
        : 'Portal account created successfully',
      accountExists: result.accountExists || false,
      userId: result.userId,
      email: result.email,
      tempPassword: result.tempPassword,
      status,
    });
  } catch (error) {
    console.error('Error provisioning portal account:', error);
    Sentry.captureException(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/customers/[id]/provision-portal
 * Revoke portal access (disable account)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const supabase = createClient();

    // Get customer's portal user ID
    const { data: customer } = await supabase
      .from('customers')
      .select('portal_user_id, email')
      .eq('id', customerId)
      .single();

    if (!customer || !customer.portal_user_id) {
      return NextResponse.json(
        { error: 'Customer does not have a portal account' },
        { status: 404 }
      );
    }

    // Disable the auth account
    const { error: disableError } = await supabase.auth.admin.updateUserById(
      customer.portal_user_id,
      { ban_duration: 'none' } // Permanently ban
    );

    if (disableError) {
      throw disableError;
    }

    // Update customer record
    await supabase
      .from('customers')
      .update({
        portal_account_created: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    // Create audit log
    await supabase.from('audit_logs').insert({
      action: 'portal_account_disabled',
      resource_type: 'customer',
      resource_id: customerId,
      details: {
        email: customer.email,
        user_id: customer.portal_user_id,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Portal account disabled',
    });
  } catch (error) {
    console.error('Error disabling portal account:', error);
    Sentry.captureException(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/customers/[id]/provision-portal/reset-password
 * Send password reset email
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;
    const supabase = createClient();

    // Get customer email
    const { data: customer } = await supabase
      .from('customers')
      .select('email, portal_account_created')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    if (!customer.portal_account_created) {
      return NextResponse.json(
        { error: 'Customer does not have a portal account' },
        { status: 400 }
      );
    }

    // Send password reset
    const result = await sendPasswordReset(customer.email);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send password reset email',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    console.error('Error sending password reset:', error);
    Sentry.captureException(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 }
    );
  }
}
