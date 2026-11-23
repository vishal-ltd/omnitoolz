"use client";

import { useEffect } from "react";

/**
 * A file dropped anywhere outside a drop zone makes the browser navigate the
 * tab to that file — killing a running job and its queue. Swallow stray
 * dragover/drop at the window level; zones handle their own drops.
 */
export function DropGuard() {
  useEffect(() => {
    const prevent = (event: DragEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.("[data-dropzone]")) return;
      event.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);
  return null;
}