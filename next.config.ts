import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    // Remove React DevTools attributes in production
    reactRemoveProperties: process.env.NODE_ENV === "production",
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  experimental: {
    optimizePackageImports: ["@radix-ui/react-icons", "lucide-react"],
  },
  transpilePackages: [],

  // Webpack optimization
  webpack: (config) => {
    return config;
  },

  // Image Optimization Configuration
  images: {
    formats: ['image/avif', 'image/webp'], // Modern formats for better compression
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840], // Common device sizes
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // Common image sizes
    minimumCacheTTL: 60, // Cache images for 60 seconds
    dangerouslyAllowSVG: true, // Allow SVG images
    contentDispositionType: 'attachment', // Security for SVGs
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;", // CSP for SVGs
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
    ],
  },

  // Content Security Policy for MapLibre workers - TEMPORARILY DISABLED FOR TESTING
  // async headers() {
  //   return [
  //     {
  //       source: '/:path*',
  //       headers: [
  //         {
  //           key: 'Content-Security-Policy',
  //           value: [
  //             "default-src 'self'",
  //             "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  //             "worker-src 'self' blob:",
  //             "child-src 'self' blob:",
  //             "style-src 'self' 'unsafe-inline'",
  //             "img-src 'self' data: https:",
  //             "font-src 'self' data:",
  //             "connect-src 'self' https://*.cartocdn.com https://demotiles.maplibre.org https://tile.openstreetmap.org"
  //           ].join('; ')
  //         }
  //       ]
  //     }
  //   ]
  // }
};

export default nextConfig;