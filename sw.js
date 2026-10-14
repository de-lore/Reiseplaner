const CACHE_NAME = 'reiseplaner-pro-v1.86';

// 1. Lokale App-Shell (muss zwingend vorhanden sein)
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 2. Externe CDN-Ressourcen inkl. der Font-Awesome-Schriftdateien (.woff2)
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2'
];

// INSTALL: App-Shell & CDNs sofort beim ersten Aufruf vorab in den Cache laden
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Lokale Dateien cachen
      await cache.addAll(LOCAL_ASSETS);

      // Externe CDN-Dateien einzeln abrufen und cachen (fehlertolerant & Redirect-sicher)
      for (const url of CDN_ASSETS) {
        try {
          const req = new Request(url, { mode: 'cors' });
          const res = await fetch(req);
          if (res.ok) {
            await cache.put(url, res);
          }
        } catch (err) {
          // Fallback für Ressourcen ohne expliziten CORS-Header (z. B. Redirects)
          try {
            const noCorsReq = new Request(url, { mode: 'no-cors' });
            const noCorsRes = await fetch(noCorsReq);
            await cache.put(url, noCorsRes);
          } catch (innerErr) {
            console.warn('[SW] Konnte CDN-Asset nicht vorab laden:', url, innerErr);
          }
        }
      }
    })
  );
});

// ACTIVATE: Alte Caches (z. B. v1.85 oder älter) sauber entfernen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Lösche alten Cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH: Intelligente Offline-Strategie
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nur GET-Anfragen behandeln
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Blob-URLs (lokale PDF-/Bild-Vorschauen aus IndexedDB) und Chrome-Extensions ignorieren
  if (url.protocol === 'blob:' || url.protocol === 'chrome-extension:' || url.protocol === 'data:') {
    return;
  }

  // Externe Karten-Aufrufe (Google Maps) nicht abfangen, sondern normal ans System weiterleiten
  if (url.hostname.includes('google.com')) {
    return;
  }

  // STRATEGIE A: CDN-Anfragen (Tailwind CSS & Font Awesome) -> Cache-First mit Stale-While-Revalidate
  if (url.hostname.includes('cdn.tailwindcss.com') || url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(req, { ignoreVary: true });

        // Im Hintergrund aktualisieren, falls online
        const networkFetch = fetch(req).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);

        // Sofort aus dem Cache liefern (null Verzögerung + 100 % offline-sicher)
        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // STRATEGIE B: Lokale Dateien (index.html, manifest.json, Icons) -> Network-First mit sofortigem Offline-Fallback
  // Dadurch bekommst du zuhause im WLAN sofort Code-Updates, bist unterwegs ohne Netz aber zu 100 % geschützt.
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;

        // Wenn die Hauptseite (Navigation) angefragt wurde, immer auf ./index.html zurückfallen
        if (req.mode === 'navigate') {
          return cache.match('./index.html');
        }
      })
  );
});
