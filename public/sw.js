const CACHE_NAME = 'welmora-scanner-v1';
const STATIC_CACHE_URLS = ['/', '/manifest.json', '/welmora-logo.svg', '/favicon.ico'];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with cache-first strategy for static assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Cache-first strategy for static assets
  if (
    STATIC_CACHE_URLS.includes(url.pathname) ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.includes('.css') ||
    url.pathname.includes('.js') ||
    url.pathname.includes('.svg') ||
    url.pathname.includes('.ico')
  ) {
    event.respondWith(
      caches
        .match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(request).then(response => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });

            return response;
          });
        })
        .catch(() => {
          // Return offline fallback for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
        })
    );
  }

  // Network-first strategy for API requests
  else if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Try to serve from cache if network fails
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a basic error response
            return new Response(JSON.stringify({ error: 'Network unavailable', offline: true }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          });
        })
    );
  }

  // Default: network-first for everything else
  else {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then(cachedResponse => {
          return cachedResponse || caches.match('/');
        });
      })
    );
  }
});
