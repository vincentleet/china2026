// Offline-first cache for the itinerary. GitHub Pages is slow/unreliable from
// China, so serve the saved copy immediately and refresh it in the background.
const CACHE = 'china2026-v3';
const PAGE = new URL('index.html', self.registration.scope).href;
const ASSETS = ['manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png'];

// Hosts differ: Cloudflare Pages 308s index.html -> /, githack 403s the bare
// folder. Browsers refuse a redirected response for a navigation, so store and
// serve a copy without the redirect flag.
const clean = res => res.redirected
  ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
  : res;

self.addEventListener('install', e => {
  self.skipWaiting();
  // Best effort: a stalled download must not block installation.
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all([PAGE, ...ASSETS].map(u =>
      fetch(u).then(r => r.ok && c.put(u, clean(r))).catch(() => {})
    ))
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
    // Navigations always fetch the page itself, following any redirect.
    const network = fetch(isPage ? PAGE : req).then(r => {
      const res = clean(r);
      if (res.ok) cache.put(key, res.clone());
      return res;
    });
    if (cached) {
      e.waitUntil(network.catch(() => {}));
      return cached;
    }
    return network;
  }));
});
