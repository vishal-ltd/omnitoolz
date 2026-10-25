"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ToolIcon } from "@/components/icons";
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

  const hits = searchTools(query, 8);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

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
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl animate-pixel-in overflow-hidden border-[3px] border-edge bg-card shadow-[8px_8px_0_0_var(--color-shadow)]"
      >
        <div className="flex items-center gap-3 border-b-[3px] border-edge bg-canvas px-4">
          <Search className="size-5 shrink-0 text-brand" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
            className="h-14 w-full bg-transparent font-body text-xl text-ink outline-none placeholder:text-ink-soft/70"
            aria-label="Search tools"
            autoComplete="off"
          />
          <kbd className="hidden shrink-0 border-2 border-line-strong bg-card px-2 py-1 font-display text-[8px] text-ink-soft sm:block">
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
              No tools match “{query}”. Try “pdf”, “image” or “convert”.
            </p>
          ) : (
            <ul role="listbox">
              {hits.map((hit, index) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    role="option"
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
                    <span className="w-4 shrink-0 font-display text-[10px] text-brand" aria-hidden>
                      {index === activeIndex ? "▸" : ""}
                    </span>
                    <span className="flex size-9 shrink-0 items-center justify-center border-[3px] border-edge bg-card shadow-[2px_2px_0_0_var(--color-shadow)]">
                      <ToolIcon name={hit.icon} className="size-4 text-brand" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[10px] text-ink">{hit.name}</span>
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
