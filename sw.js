// Offline-first cache for the itinerary. GitHub Pages is slow/unreliable from
// China, so serve the saved copy immediately and refresh it in the background.
const CACHE = 'china2026-v2';
const PAGE = new URL('index.html', self.registration.scope).href;
const ASSETS = ['manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  // Best effort: a stalled download must not block installation.
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all([PAGE, ...ASSETS].map(u => c.add(u).catch(() => {})))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.endsWith('/sw.js')) return;

  const isPage = req.mode === 'navigate';
  if (isPage && !/\/(index\.html)?$/.test(url.pathname)) return;
  const key = isPage ? PAGE : req;

  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(key, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res.ok && !res.redirected) cache.put(key, res.clone());
      return res;
    });
    if (cached) {
      e.waitUntil(network.catch(() => {}));
      return cached;
    }
    return network;
  }));
});
