const CACHE_NAME = 'reiseplaner-pro-v1.93';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(LOCAL_ASSETS);
      for (const url of CDN_ASSETS) {
        try {
          const res = await fetch(new Request(url, { mode: 'cors' }));
          if (res.ok) await cache.put(url, res);
        } catch {
          try {
            await cache.put(url, await fetch(new Request(url, { mode: 'no-cors' })));
          } catch (err) {
            console.warn('[SW] CDN-Asset nicht geladen:', url, err);
          }
        }
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (['blob:', 'chrome-extension:', 'data:'].includes(url.protocol) || url.hostname.includes('google.com')) {
    return;
  }

  // CDN: Cache-First + Stale-While-Revalidate
  if (url.hostname.includes('cdn.tailwindcss.com') || url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req, { ignoreVary: true });
        const networkFetch = fetch(req).then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => null);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Lokale Dateien: Network-First + Offline-Fallback
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res?.status === 200 && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? cache.match('./index.html') : undefined);
      })
  );
});
