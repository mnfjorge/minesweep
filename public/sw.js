/* Offline-first service worker for Minesweeper (Next.js app dir) */
const CACHE_VERSION = 'ms-v3';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Precache core routes and assets necessary to load the app offline
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (!key.includes(CACHE_VERSION)) {
          return caches.delete(key);
        }
      })
    )).then(() => self.clients.claim())
  );
});

// Helper: network-first for navigation requests (pages), cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Do NOT cache or intercept API requests (e.g., NextAuth session/signout)
  if (url.pathname.startsWith('/api/')) {
    return; // Let the browser hit the network directly
  }

  // For navigations, try network first, fallback to cache, then offline page
  if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch (err) {
          const cacheMatch = await caches.match(request);
          return cacheMatch || caches.match('/offline.html');
        }
      })()
    );
    return;
  }

  // For static assets: cache-first, then network fallback
  if (request.method === 'GET') {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone());
          return response;
        } catch (err) {
          // As a last resort, return something from precache if available
          return caches.match('/offline.html');
        }
      })()
    );
  }
});

