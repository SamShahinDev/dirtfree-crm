import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await getServerSupabase()

    // Test connection by trying to access auth
    // This doesn't require any tables to exist
    const { data, error } = await supabase.auth.getSession()

    // Even if there's no session, the client connection worked
    const supabaseConnected = !error || error.message?.includes('session')

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      supabaseConnected,
      message: 'Supabase client initialized successfully'
    })
  } catch (error) {
    console.error('Ping endpoint error:', error)

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to connect to Supabase',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}