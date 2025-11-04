import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server'
import { inviteUserSchema } from '@/lib/auth/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedFields = inviteUserSchema.safeParse(body)

    if (!validatedFields.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email address',
          details: validatedFields.error.issues,
        },
        { status: 400 }
      )
    }

    const { email } = validatedFields.data

    // Check if current user is authenticated and is admin
    const supabase = await getServerSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        },
        { status: 401 }
      )
    }

    // Check admin role (temporary check - will be replaced with requireRole in P1.4)
    if (user.app_metadata?.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions. Admin role required.',
        },
        { status: 403 }
      )
    }

    // Use service role to invite user
    const serviceSupabase = getServiceSupabase()

    const { data, error } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    })

    if (error) {
      console.error('User invitation error:', error)

      // Handle specific error cases
      if (error.message?.includes('already registered')) {
        return NextResponse.json(
          {
            success: false,
            error: 'User with this email already exists',
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send invitation',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        invited_at: data.user.invited_at,
      },
    })
  } catch (error) {
    console.error('Unexpected invitation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS if needed
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS',
    },
  })
}