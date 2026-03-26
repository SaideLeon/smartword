const CACHE_VERSION = 'v3';
const PRECACHE = `muneri-precache-${CACHE_VERSION}`;
const PAGES_CACHE = `muneri-pages-${CACHE_VERSION}`;
const ASSETS_CACHE = `muneri-assets-${CACHE_VERSION}`;
const MEDIA_CACHE = `muneri-media-${CACHE_VERSION}`;

const APP_SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/apple-icon.svg'];
const ASSET_DESTINATIONS = new Set(['style', 'script', 'worker']);
const MEDIA_DESTINATIONS = new Set(['image', 'font']);

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then(cache => cache.addAll(APP_SHELL))
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

self.addEventListener('fetch', event => {
  const {request} = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, '/'));
    return;
  }

  if (ASSET_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE, 80));
    return;
  }

  if (MEDIA_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE, 100));
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
