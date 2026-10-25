/*
  OmniToolz service worker — offline support for an all-client-side app.
  Strategy: cache-first for immutable build assets, fonts, icons and the
  pdf.js worker; network-first for navigations with a cached-home fallback.
  User files are NEVER seen by this worker (no fetch of blobs/local data).
*/
const CACHE = "omnitoolz-v1";
const PRECACHE = ["/", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const IMMUTABLE = ["/_next/static/", "/pdf.worker.min.mjs", "/icon-", "/og.png", "/manifest.webmanifest"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first: hashed build assets, fonts, icons, engine worker.
  if (IMMUTABLE.some((prefix) => url.pathname.startsWith(prefix) || url.pathname.includes(prefix))) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Network-first for pages; offline falls back to the cached homepage.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/"))),
    );
  }
});
