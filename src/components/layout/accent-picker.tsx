"use client";

import { useEffect, useState } from "react";
import {
  ACCENTS,
  applyAccent,
  persistAccent,
  readStoredAccent,
  type AccentId,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Funky accent picker: five pixel swatches (Arcade, Game Boy, Synthwave,
 * Amber CRT, Mono). Only highlight colors change — the classic paper/ink
 * surfaces stay put. Orthogonal to the light/dark/system toggle.
 */
export function AccentPicker() {
  const [accent, setAccent] = useState<AccentId>("arcade");

  useEffect(() => {
    setAccent(readStoredAccent());
  }, []);

  function select(id: AccentId) {
    setAccent(id);
    applyAccent(id);
    persistAccent(id);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Accent color"
      className="flex items-center gap-1.5 border-[3px] border-edge bg-card p-1 shadow-[3px_3px_0_0_var(--color-shadow)]"
    >
      {ACCENTS.map((option) => {
        const active = accent === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            aria-label={`${option.label} accent`}
            title={`${option.label} accent`}
            onClick={() => select(option.id)}
            onKeyDown={(event) => {
              // APG radio group: arrows move and select, roving tabindex.
              const index = ACCENTS.findIndex((entry) => entry.id === option.id);
              const next =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? (index + 1) % ACCENTS.length
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? (index - 1 + ACCENTS.length) % ACCENTS.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? ACCENTS.length - 1
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              select(ACCENTS[next].id);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]
                ?.focus();
            }}
            className={cn(
              // 44px swatches: reachable with a thumb and still small enough to read as chips.
              "size-11 border-[3px] transition-transform hover:-translate-y-0.5",
              active ? "border-ink" : "border-transparent",
            )}
            style={{
              backgroundImage: `linear-gradient(135deg, ${option.swatch[0]} 0 50%, ${option.swatch[1]} 50% 100%)`,
            }}
          />
        );
      })}
    </div>
  );
}
