/* eslint-disable no-undef */
const CACHE_VERSION = 'v2';

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (self.workbox) {
  workbox.setConfig({debug: false});

  workbox.core.setCacheNameDetails({
    prefix: 'muneri',
    suffix: CACHE_VERSION,
    precache: 'precache',
    runtime: 'runtime',
  });

  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  workbox.precaching.precacheAndRoute([
    {url: '/', revision: CACHE_VERSION},
    {url: '/manifest.webmanifest', revision: CACHE_VERSION},
    {url: '/icon.svg', revision: CACHE_VERSION},
    {url: '/apple-icon.svg', revision: CACHE_VERSION},
  ]);

  workbox.precaching.cleanupOutdatedCaches();

  // Navegação sempre privilegia rede para evitar editor defasado preso em cache.
  workbox.routing.registerRoute(
    ({request}) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 4,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    }),
  );

  // Assets estáticos podem usar StaleWhileRevalidate para abertura rápida sem congelar versão para sempre.
  workbox.routing.registerRoute(
    ({request}) => ['style', 'script', 'worker'].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'assets',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 80,
          maxAgeSeconds: 7 * 24 * 60 * 60,
          purgeOnQuotaError: true,
        }),
      ],
    }),
  );

  workbox.routing.registerRoute(
    ({request}) => ['image', 'font'].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'media',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true,
        }),
      ],
    }),
  );

  workbox.routing.setCatchHandler(async ({event}) => {
    if (event.request.mode === 'navigate') {
      return caches.match('/');
    }

    return Response.error();
  });
} else {
  // Fallback mínimo se Workbox não carregar.
  self.addEventListener('fetch', event => {
    if (event.request.mode !== 'navigate') {
      return;
    }

    event.respondWith(fetch(event.request).catch(() => caches.match('/')));
  });
}
