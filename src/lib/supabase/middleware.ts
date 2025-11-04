import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/customers',
  '/jobs',
  '/invoices',
  '/schedule',
  '/reminders',
  '/trucks',
  '/reports',
  '/settings',
  '/users',
]

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/auth',
  '/logout',
]

// API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/ping',
]

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route))
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  )
}

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Allow static assets and public API routes
  if (isPublicApiRoute(pathname)) {
    return supabaseResponse
  }

  // Handle protected routes
  if (isProtectedRoute(pathname)) {
    if (!user) {
      // No user, redirect to login with next parameter
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    // User exists but email not verified - redirect to verification page
    if (!user.email_confirmed_at) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/verify-pending'
      return NextResponse.redirect(url)
    }
  }

  // Handle public routes when user is already authenticated
  if (pathname === '/login' && user && user.email_confirmed_at) {
    // Authenticated user trying to access login page - redirect to dashboard
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Allow unverified users to access verification-related pages
  if (user && !user.email_confirmed_at) {
    const allowedUnverifiedPaths = [
      '/auth/verify-pending',
      '/logout',
    ]

    if (!allowedUnverifiedPaths.some(path => pathname.startsWith(path))) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/verify-pending'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}