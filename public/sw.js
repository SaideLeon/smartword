const CACHE_VERSION = 'v6';
const PRECACHE = `muneri-precache-${CACHE_VERSION}`;
const PAGES_CACHE = `muneri-pages-${CACHE_VERSION}`;
const ASSETS_CACHE = `muneri-assets-${CACHE_VERSION}`;
const MEDIA_CACHE = `muneri-media-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/offline',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-icon-180.png',
];
const ASSET_DESTINATIONS = new Set(['style', 'script', 'worker']);
const MEDIA_DESTINATIONS = new Set(['image', 'font']);

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then(cache =>
        Promise.allSettled(
          APP_SHELL.map(url =>
            cache
              .add(url)
              .catch(error => console.warn('[SW] Precache falhou:', url, error)),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => !key.endsWith(CACHE_VERSION))
            .map(key => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const {request} = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(caches.match(request).then(cached => cached ?? fetch(request)));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, '/offline'));
    return;
  }

  if (ASSET_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE, 80));
    return;
  }

  if (request.destination === '' && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE, 120));
    return;
  }

  if (MEDIA_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE, 100));
    return;
  }
});

async function networkFirst(request, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (isCacheable(networkResponse)) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const fallbackResponse = await caches.match(fallbackPath);
    return fallbackResponse ?? Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async networkResponse => {
      if (isCacheable(networkResponse)) {
        await cache.put(request, networkResponse.clone());
        await trimCache(cache, maxEntries);
      }
      return networkResponse;
    })
    .catch(() => undefined);

  if (cachedResponse) {
    void networkPromise;
    return cachedResponse;
  }

  const networkResponse = await networkPromise;
  return networkResponse ?? Response.error();
}

function isCacheable(response) {
  return Boolean(response && (response.status === 200 || response.status === 0));
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const overflow = keys.length - maxEntries;

  if (overflow <= 0) {
    return;
  }

  await Promise.all(keys.slice(0, overflow).map(key => cache.delete(key)));
}
