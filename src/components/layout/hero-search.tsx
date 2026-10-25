"use client";

import { Search } from "lucide-react";
import { liveTools } from "@/lib/tools/registry";
import { openSearch } from "./search-dialog";

/** Homepage hero search trigger — opens the global search dialog. */
export function HeroSearch() {
  return (
    <button
      type="button"
      onClick={() => openSearch()}
      className="group flex h-16 w-full items-center gap-3 border-[3px] border-edge bg-card px-5 text-left shadow-[5px_5px_0_0_var(--color-shadow)] transition-all hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_var(--color-shadow)] active:translate-y-1 active:shadow-none"
      aria-label="Search tools"
    >
      <span className="flex size-10 shrink-0 items-center justify-center border-[3px] border-edge bg-brand text-on-brand">
        <Search className="size-5" aria-hidden />
      </span>
      <span className="flex-1 truncate font-body text-xl text-ink-soft">
        Search {liveTools().length} tools — “merge pdf”, “watermark pdf”, “invoice”…
      </span>
      <span className="animate-blink font-display text-sm text-brand" aria-hidden>
        ▮
      </span>
    </button>
  );
}
