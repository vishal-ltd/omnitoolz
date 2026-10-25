"use client";

import { useEffect } from "react";

/**
 * Register the service worker in production builds only, so `next dev`
 * hot-reloading never fights the offline cache.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a bonus — never break the app over it.
    });
  }, []);
  return null;
}
