import { NextResponse } from 'next/server';

export async function GET() {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  const isProduction = vercelEnv === 'production';

  if (isProduction) {
    // Production: Allow crawling with sitemap
    const robots = `User-agent: *
Allow: /

# Important pages
Allow: /login
Allow: /signup
Allow: /about
Allow: /contact

# Block sensitive areas
Disallow: /dashboard
Disallow: /jobs
Disallow: /customers
Disallow: /schedule
Disallow: /reminders
Disallow: /reports
Disallow: /settings
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /test/

# Performance
Crawl-delay: 1

# Sitemap
Sitemap: ${process.env.NEXT_PUBLIC_APP_URL || 'https://dirt-free-crm.com'}/sitemap.xml`;

    return new NextResponse(robots, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } else {
    // Preview/Staging: Block all crawling
    const robots = `User-agent: *
Disallow: /

# Block everything for non-production environments
# This includes staging, preview, and development environments`;

    return new NextResponse(robots, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
}