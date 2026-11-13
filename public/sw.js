const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // data and auth always go to the network

  // Hashed build files never change: cache first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Pages: network first so you always get fresh HTML online, cached copy when offline
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match("/"));
    if (hit) return hit;
    return new Response("You are offline and this page was never cached.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
