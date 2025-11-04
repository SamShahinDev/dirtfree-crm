import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ============================================================================
  // Security Headers
  // ============================================================================

  // Prevent MIME type sniffing
  res.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking attacks
  res.headers.set('X-Frame-Options', 'DENY');

  // Enable XSS filter in browsers
  res.headers.set('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Control browser features and APIs
  res.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  // Content Security Policy (CSP)
  // Note: Adjust this based on your actual needs
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: https: blob:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://*.supabase.co https://demotiles.maplibre.org https://tile.openstreetmap.org https://*.cartocdn.com;
    worker-src 'self' blob:;
    child-src 'self' blob:;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, ' ')
    .trim();

  res.headers.set('Content-Security-Policy', cspHeader);

  // Strict Transport Security (HTTPS only)
  // Only enable in production
  if (process.env.NODE_ENV === 'production') {
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // ============================================================================
  // Authentication Check
  // ============================================================================

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        }
      }
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // List of public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/register',
    '/services',
    '/service-areas',
    '/about',
    '/contact',
    '/quote',
    '/book',
    '/reviews',
  ];
  const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route));

  // If user is not logged in and trying to access protected route
  if (!session && !isPublicRoute && !req.nextUrl.pathname.startsWith('/api')) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is logged in and trying to access auth pages (not homepage or public pages)
  const authOnlyRoutes = ['/login', '/forgot-password', '/reset-password', '/register'];
  const isAuthRoute = authOnlyRoutes.some(route => req.nextUrl.pathname.startsWith(route));

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};