"use client";

import { useEffect, useRef, useState } from "react";
import { AccentPicker } from "./accent-picker";
import { ThemeToggle } from "./theme-toggle";

/**
 * Screen and palette choices behind one 44px pixel button. These two clusters
 * used to sit inline in the header and pushed each other past the viewport
 * from 768 to 1599px — the accent picker was unreachable on a 1280 laptop.
 */
export function AppearanceControl() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        aria-controls="appearance-panel"
        aria-label="Appearance"
        title="Screen and palette"
        className="flex size-11 items-center justify-center border-[3px] border-edge bg-card text-ink shadow-[3px_3px_0_0_var(--color-shadow)] transition-all hover:-translate-y-0.5 hover:text-brand hover:shadow-[4px_4px_0_0_var(--color-shadow)] active:translate-y-0.5 active:shadow-none aria-expanded:bg-brand-soft"
      >
        <PixelContrastIcon aria-hidden />
      </button>

      {open && (
        <div
          id="appearance-panel"
          className="absolute right-0 top-[calc(100%+10px)] z-50 flex flex-col gap-3 border-[3px] border-edge bg-card p-3 shadow-[5px_5px_0_0_var(--color-shadow)]"
        >
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-display-xs tracking-wide text-ink-soft uppercase" aria-hidden>
              Screen
            </span>
            <ThemeToggle />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-display-xs tracking-wide text-ink-soft uppercase" aria-hidden>
              Palette
            </span>
            <AccentPicker />
          </div>
        </div>
      )}
    </div>
  );
}

/** Contrast glyph built from solid pixel blocks so it stays crisp on the 8px grid. */
function PixelContrastIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden shapeRendering="crispEdges">
      <rect x="0" y="0" width="16" height="2" fill="currentColor" />
      <rect x="0" y="14" width="16" height="2" fill="currentColor" />
      <rect x="0" y="0" width="2" height="16" fill="currentColor" />
      <rect x="14" y="0" width="2" height="16" fill="currentColor" />
      <rect x="2" y="2" width="6" height="12" fill="currentColor" />
    </svg>
  );
}
