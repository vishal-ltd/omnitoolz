"use client";

import { useEffect } from "react";

/**
 * The site is online-only: no service worker, no offline app-shell cache.
 * Visitors who loaded an earlier version still carry the old worker — this
 * unregisters it and empties its caches, then does nothing on later loads.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      } catch {
        // Cleanup is best-effort — never break the app over it.
      }
    })();
  }, []);
  return null;
}
