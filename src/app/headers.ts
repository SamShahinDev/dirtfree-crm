/**
 * Security Headers Utility
 *
 * This file provides utilities for setting security headers across the application.
 * Most headers are configured in vercel.json, but this provides programmatic access
 * for dynamic header generation in API routes and special cases.
 */

export interface SecurityHeaders {
  'X-Content-Type-Options': string;
  'Referrer-Policy': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'X-Robots-Tag'?: string;
  'Strict-Transport-Security'?: string;
  'Content-Security-Policy'?: string;
}

/**
 * Get standard security headers
 */
export function getSecurityHeaders(options?: {
  includeHSTS?: boolean;
  includeCSP?: boolean;
  robotsTag?: string;
}): SecurityHeaders {
  const headers: SecurityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  // Add HSTS for production HTTPS
  if (options?.includeHSTS) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  // Add robots meta tag if specified
  if (options?.robotsTag) {
    headers['X-Robots-Tag'] = options.robotsTag;
  }

  // Add Content Security Policy if requested
  if (options?.includeCSP) {
    headers['Content-Security-Policy'] = getDefaultCSP();
  }

  return headers;
}

/**
 * Get environment-specific security headers
 */
export function getEnvironmentHeaders(): SecurityHeaders {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  const isProduction = vercelEnv === 'production';

  const baseHeaders = getSecurityHeaders({
    includeHSTS: isProduction,
    includeCSP: true,
  });

  // Add no-index for non-production environments
  if (!isProduction) {
    baseHeaders['X-Robots-Tag'] = 'noindex, nofollow';
  }

  return baseHeaders;
}

/**
 * Get default Content Security Policy
 */
function getDefaultCSP(): string {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  const isProduction = vercelEnv === 'production';

  // Allow unsafe-eval and unsafe-inline in development for better DX
  const scriptSrc = isProduction
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-eval' 'unsafe-inline'";

  const styleSrc = "'self' 'unsafe-inline' fonts.googleapis.com";
  const fontSrc = "'self' fonts.gstatic.com data:";
  const imgSrc = "'self' data: blob: https:";
  const connectSrc = isProduction
    ? "'self' https://*.supabase.co wss://*.supabase.co https://api.twilio.com"
    : "'self' http://localhost:* https://*.supabase.co wss://*.supabase.co https://api.twilio.com";

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `font-src ${fontSrc}`,
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    isProduction ? `upgrade-insecure-requests` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/**
 * Apply security headers to a Response object
 */
export function applySecurityHeaders(
  response: Response,
  additionalHeaders?: Record<string, string>
): Response {
  const securityHeaders = getEnvironmentHeaders();

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });

  // Apply additional headers
  if (additionalHeaders) {
    Object.entries(additionalHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * Create a Response with security headers
 */
export function createSecureResponse(
  body?: BodyInit | null,
  init?: ResponseInit,
  additionalHeaders?: Record<string, string>
): Response {
  const response = new Response(body, init);
  return applySecurityHeaders(response, additionalHeaders);
}

/**
 * Get headers object for Next.js API routes
 */
export function getApiHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
  const securityHeaders = getEnvironmentHeaders();

  return {
    ...securityHeaders,
    ...additionalHeaders,
  };
}

/**
 * Check if current environment allows indexing
 */
export function isIndexingAllowed(): boolean {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  return vercelEnv === 'production';
}

/**
 * Get environment-specific cache headers
 */
export function getCacheHeaders(maxAge: number = 3600): Record<string, string> {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  const isProduction = vercelEnv === 'production';

  // Shorter cache times for non-production
  const cacheMaxAge = isProduction ? maxAge : Math.min(maxAge, 300);

  return {
    'Cache-Control': `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}`,
  };
}