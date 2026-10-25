/**
 * Tri-state theme control: "light" | "dark" | "system".
 *
 * The applied theme lives as a `.dark` class on <html>, set before first
 * paint by the inline script in app/layout.tsx (no flash of wrong theme).
 * The user's choice is persisted in localStorage under THEME_STORAGE_KEY.
 * While in "system" mode, OS preference changes are followed live.
 */

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "omnitoolz:theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function persistTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private-browsing modes may block storage; the in-page choice still applies.
  }
}

export function readStoredTheme(): ThemeChoice {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // ignore
  }
  return "system";
}

/* ── Funky accents (orthogonal to light/dark mode) ──────────────────
   The applied accent lives as data-accent on <html>, also set before
   first paint by the inline script. Accents recolor only highlights
   (buttons, links, ticker, logo, chips); surfaces stay classic.
   Swatches are shown in the header picker. */

export type AccentId = "arcade" | "gameboy" | "synthwave" | "amber" | "mono";

export interface AccentInfo {
  id: AccentId;
  label: string;
  /** Two swatch colors for the picker chip. */
  swatch: [string, string];
}

export const ACCENTS: AccentInfo[] = [
  { id: "arcade", label: "Arcade", swatch: ["#5b54e8", "#f2b824"] },
  { id: "gameboy", label: "Game Boy", swatch: ["#9bbc0a", "#0f380f"] },
  { id: "synthwave", label: "Synthwave", swatch: ["#ff2e88", "#00e5ff"] },
  { id: "amber", label: "Amber CRT", swatch: ["#ffb347", "#dc2626"] },
  { id: "mono", label: "Mono", swatch: ["#111111", "#ffffff"] },
];

export const ACCENT_STORAGE_KEY = "omnitoolz:accent";

export function applyAccent(id: AccentId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.accent = id;
}

export function persistAccent(id: AccentId): void {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, id);
  } catch {
    // Private-browsing modes may block storage; the in-page choice still applies.
  }
}

export function readStoredAccent(): AccentId {
  try {
    const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    const valid = ACCENTS.some((accent) => accent.id === raw);
    if (valid) return raw as AccentId;
  } catch {
    // ignore
  }
  return "arcade";
}
