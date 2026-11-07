"use client";

import { ChromeIcon, type ChromeName } from "@/components/icons";
import { useEffect, useState } from "react";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  type ThemeChoice,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: ChromeName }> = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

/**
 * Light / Dark / System switcher. The inline head script already applied the
 * right class pre-paint; this component syncs from storage on mount, applies
 * changes immediately, and follows OS changes while in system mode.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  // Follow OS preference changes live while using the system setting.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function choose(next: ThemeChoice) {
    setTheme(next);
    applyTheme(next);
    persistTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="inline-flex items-center gap-1 border-[3px] border-edge bg-card p-1 shadow-[3px_3px_0_0_var(--color-shadow)]"
    >
      {OPTIONS.map(({ value, label, icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => choose(value)}
            className={cn(
              "flex min-h-11 items-center gap-1.5 px-2 py-1.5 transition-colors",
              compact && "px-1.5",
              active
                ? "bg-brand text-on-brand"
                : "text-ink-soft hover:bg-brand-soft hover:text-brand",
            )}
          >
            <ChromeIcon name={icon} className="size-4" />
            {!compact && (
              <span className="font-display text-display-xs uppercase">{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
