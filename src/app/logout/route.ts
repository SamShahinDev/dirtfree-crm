import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()

    // Sign out the user
    await supabase.auth.signOut()

    // Redirect to login page
    redirect('/login')
  } catch (error) {
    console.error('Logout error:', error)
    // Even if there's an error, redirect to login
    redirect('/login')
  }
}

export async function POST(request: NextRequest) {
  // Support both GET and POST for flexibility
  return GET(request)
}