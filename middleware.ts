import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

async function handlePreviewProtection(request: NextRequest) {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  const isPreview = vercelEnv === 'preview';

  if (!isPreview) {
    return null;
  }

  // Skip protection for API routes, static assets, and health checks
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.') ||
    pathname === '/api/ready' ||
    pathname === '/api/ops/heartbeat'
  ) {
    return null;
  }

  // Check for basic auth if configured
  const previewAuth = process.env.PREVIEW_BASIC_AUTH;
  if (previewAuth) {
    const authorization = request.headers.get('authorization');

    if (!authorization) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Preview Environment"',
        },
      });
    }

    const [scheme, credentials] = authorization.split(' ');
    if (scheme !== 'Basic' || !credentials) {
      return new NextResponse('Invalid authentication', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Preview Environment"',
        },
      });
    }

    try {
      const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
      const [username, password] = decoded.split(':');

      // Simple validation - no logging of credentials
      if (!username || !password || `${username}:${password}` !== previewAuth) {
        return new NextResponse('Invalid credentials', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Preview Environment"',
          },
        });
      }
    } catch {
      return new NextResponse('Invalid credentials format', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Preview Environment"',
        },
      });
    }
  }

  // Block common bots on preview
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  const botPatterns = [
    'googlebot',
    'bingbot',
    'slurp',
    'duckduckbot',
    'baiduspider',
    'yandexbot',
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'whatsapp',
    'telegram',
  ];

  if (botPatterns.some(pattern => userAgent.includes(pattern))) {
    return new NextResponse('Not available', {
      status: 403,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  return null;
}

export async function middleware(request: NextRequest) {
  // Handle preview protection first
  const previewResponse = await handlePreviewProtection(request);
  if (previewResponse) {
    return previewResponse;
  }

  // Handle CORS for public API endpoints
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/public/')) {
    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_WEBSITE_URL || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400', // 24 hours
        },
      });
    }

    // Add CORS headers to actual requests
    const response = await updateSession(request);
    response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_WEBSITE_URL || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  }

  // Add security headers to all responses
  const response = await updateSession(request);

  // Ensure no-index headers are set for non-production environments
  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  const isProduction = vercelEnv === 'production';

  if (!isProduction) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     * - sw.js (service worker)
     * - workbox-* (workbox files)
     * - icons/ (PWA icons)
     * - static assets (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}