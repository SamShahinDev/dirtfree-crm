import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// Clean up old caches
cleanupOutdatedCaches();

// Precache all build assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache static assets (fonts, styles, images)
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache /tech-weekly route for offline reading (current week only)
registerRoute(
  ({ url }) => url.pathname === '/tech-weekly' || url.pathname.startsWith('/tech-weekly/'),
  new NetworkFirst({
    cacheName: 'tech-weekly-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 10, // Only cache a few pages
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days (1 week)
      }),
    ],
  })
);

// Cache API responses for tech-weekly data (read-only)
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/tech-weekly') &&
    url.searchParams.get('method') !== 'POST' && // Don't cache POST requests
    url.searchParams.get('method') !== 'PUT' && // Don't cache PUT requests
    url.searchParams.get('method') !== 'DELETE', // Don't cache DELETE requests
  new StaleWhileRevalidate({
    cacheName: 'tech-weekly-api',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
    ],
  })
);

// Cache other static resources with stale-while-revalidate
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'worker' ||
    request.destination === 'manifest',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Explicitly avoid caching sensitive routes
const SENSITIVE_PATTERNS = [
  '/api/auth',
  '/api/customers',
  '/api/jobs',
  '/api/reminders',
  '/api/user',
  '/api/settings',
  '/dashboard',
  '/customers',
  '/jobs',
  '/reminders',
  '/settings'
];

// Skip caching for sensitive data
registerRoute(
  ({ url }) => {
    return SENSITIVE_PATTERNS.some(pattern =>
      url.pathname.startsWith(pattern)
    );
  },
  new NetworkFirst({
    cacheName: 'no-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      // This effectively disables caching by making entries expire immediately
      new ExpirationPlugin({
        maxEntries: 1,
        maxAgeSeconds: 1, // Expire immediately
      }),
    ],
  })
);

// Install prompt handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Show install prompt when service worker is ready
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '1.0.0' });
  }
});