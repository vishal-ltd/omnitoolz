"use client";

import { useEffect } from "react";

/**
 * The site is online-only: no service worker, no offline app-shell cache.
 * Visitors who loaded an earlier version still carry the old worker — this
 * unregisters it and empties its caches, then does nothing on later loads.
 * Only THIS app's leftovers are touched (the old /sw.js worker and its
 * "omnitoolz-" caches): on shared origins like localhost:3000, other
 * projects' workers and caches must survive.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          const scriptURL =
            registration.active?.scriptURL ??
            registration.waiting?.scriptURL ??
            registration.installing?.scriptURL;
          if (scriptURL && new URL(scriptURL).pathname === "/sw.js") {
            await registration.unregister();
          }
        }
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name.startsWith("omnitoolz-")) await caches.delete(name);
        }
      } catch {
        // Cleanup is best-effort — never break the app over it.
      }
    })();
  }, []);
  return null;
}
