const CACHE_NAME = 'reiseplaner-pro-v2.39';

const OFFLINE_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.json',
  './icon-192-v2.png',
  './icon-512-v2.png',
  './vendor/tailwindcss/tailwindcss.js',
  './vendor/fontawesome/css/all.min.css',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './vendor/fontawesome/webfonts/fa-regular-400.woff2',
  './vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CHECK_OFFLINE_ASSETS') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    let missing = 0;
    for (const url of OFFLINE_ASSETS) {
      if (!(await cache.match(url, { ignoreVary: true }))) missing++;
    }
    event.ports?.[0]?.postMessage({ missing, total: OFFLINE_ASSETS.length });
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (['blob:', 'chrome-extension:', 'data:'].includes(url.protocol) || url.hostname.includes('google.com')) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res?.status === 200 && url.origin === self.location.origin) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
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