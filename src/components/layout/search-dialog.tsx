"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChromeIcon, PixelIcon, ToolIcon } from "@/components/icons";
import { IconBox } from "@/components/ui/icon-box";
import { searchTools } from "@/lib/search";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "omnitoolz:open-search";

/** Anywhere in the app can open the search dialog by dispatching this event. */
export function openSearch(): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/**
 * Registry-driven tool search dialog: keyboard navigable (↑ ↓ Enter Esc),
 * Cmd/Ctrl+K shortcut, pixel "▸" selector on the active row.
 */
export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  const hits = searchTools(query, 8);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    function onOpen() {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    }
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => {
          if (!prev) previousFocusRef.current = document.activeElement as HTMLElement | null;
          return !prev;
        });
      }
      if (event.key === "Escape" && open) close();
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    // Ctrl+K usually opens with focus on <body>, so the remembered element is
    // often useless — fall back to the header trigger instead of dropping
    // focus at the top of the document.
    const remembered = previousFocusRef.current;
    const target =
      remembered && remembered !== document.body && remembered.isConnected
        ? remembered
        : document.querySelector<HTMLElement>('button[aria-label="Search tools"]');
    target?.focus();
    previousFocusRef.current = null;
  }, [open]);

  function go(route: string) {
    close();
    router.push(route);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tools"
        ref={dialogRef}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ) ?? [],
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl animate-pixel-in overflow-hidden border-[3px] border-edge bg-card shadow-[8px_8px_0_0_var(--color-shadow)]"
      >
        <div className="flex items-center gap-3 border-b-[3px] border-edge bg-canvas px-4">
          <ChromeIcon name="search" className="size-5 shrink-0 text-brand" />
          <input
            ref={inputRef}
            type="text"
            value={query}
             onChange={(event) => {
               setQuery(event.target.value);
               setActiveIndex(0);
             }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, hits.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && hits[activeIndex]) {
                event.preventDefault();
                go(hits[activeIndex].route);
              }
            }}
            placeholder="Search tools — try “merge”, “compress”, “qr”…"
            className="h-14 w-full bg-transparent font-body text-xl text-ink outline-none placeholder:text-ink-soft"
            aria-label="Search tools"
            aria-controls="search-results"
            aria-activedescendant={hits[activeIndex] ? `search-result-${hits[activeIndex].id}` : undefined}
            autoComplete="off"
          />
          <kbd className="hidden shrink-0 border-2 border-line-strong bg-card px-2 py-1 font-display text-display-xs text-ink-soft sm:block">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-6 text-center font-body text-lg text-ink-soft">
              Type at least two characters to search the tool catalogue.
            </p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-6 text-center font-body text-lg text-ink-soft">
              Nothing matches “{query}”. Try fewer words — “merge”, “compress”, “password”.
            </p>
          ) : (
            <ul id="search-results" role="listbox" aria-label="Tool search results">
              {hits.map((hit, index) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    role="option"
                    id={`search-result-${hit.id}`}
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(hit.route)}
                    className={cn(
                      "flex w-full items-center gap-3 border-[3px] px-3 py-2.5 text-left transition-colors",
                      index === activeIndex
                        ? "border-edge bg-brand-soft"
                        : "border-transparent hover:bg-canvas",
                    )}
                  >
                    <span className="w-4 shrink-0 font-display text-display-xs text-brand" aria-hidden>
                      {index === activeIndex && <PixelIcon name="chevron" className="size-4" />}
                    </span>
                    <IconBox tone="card" className="size-9 shrink-0 shadow-[2px_2px_0_0_var(--color-shadow)]">
                      <ToolIcon name={hit.icon} className="size-4" />
                    </IconBox>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-display-xs text-ink">{hit.name}</span>
                      <span className="block truncate font-body text-base text-ink-soft">{hit.description}</span>
                    </span>
                    <span className="shrink-0 font-body text-sm uppercase text-ink-soft">{hit.categoryName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
