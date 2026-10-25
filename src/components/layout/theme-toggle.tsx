"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  type ThemeChoice,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
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
      {OPTIONS.map(({ value, label, Icon }) => {
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
              "flex items-center gap-1.5 px-2 py-1.5 transition-colors",
              compact && "px-1.5",
              active
                ? "bg-brand text-on-brand"
                : "text-ink-soft hover:bg-brand-soft hover:text-brand",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {!compact && (
              <span className="font-display text-[8px] uppercase">{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
