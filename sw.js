const CACHE_NAME = 'reiseplaner-pro-v2.25';

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
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
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

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CHECK_OFFLINE_ASSETS') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of CDN_ASSETS) {
      if (await cache.match(url, { ignoreVary: true })) continue;
      if (self.navigator?.onLine === false) continue;
      try {
        let response = await fetch(new Request(url, { mode: 'cors' }));
        if (!response.ok) response = await fetch(new Request(url, { mode: 'no-cors' }));
        if (response.ok || response.type === 'opaque') await cache.put(url, response);
      } catch (error) {
        console.warn('[SW] Offline-Asset konnte nicht nachgeladen werden:', url, error);
      }
    }
    let missing = 0;
    for (const url of CDN_ASSETS) if (!(await cache.match(url, { ignoreVary: true }))) missing++;
    event.ports?.[0]?.postMessage({ missing, total: CDN_ASSETS.length });
  })());
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
        }).catch(() => Response.error());
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
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const appShell = await cache.match('./index.html');
          if (appShell) return appShell;
        }
        return Response.error();
      })
  );
});
