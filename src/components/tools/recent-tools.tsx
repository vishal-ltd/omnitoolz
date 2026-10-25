"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { liveTools } from "@/lib/tools/registry";

const STORAGE_KEY = "omnitoolz:recent-tools";
const MAX_RECENT = 6;

/** Anonymous, local-only recent tools (plan §6.5). No file contents stored. */
export function readRecentTools(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function recordRecentTool(toolId: string): void {
  try {
    const next = [toolId, ...readRecentTools().filter((id) => id !== toolId)].slice(0, MAX_RECENT);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private-browsing modes may block storage; recents are best-effort only.
  }
}

/** Homepage section: chips of recently used tools with a clear control. */
export function RecentTools() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readRecentTools());
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setRecent([]);
  }, []);

  const tools = recent
    .map((id) => liveTools().find((tool) => tool.id === id))
    .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));

  if (tools.length === 0) return null;

  return (
    <section className="mt-12" aria-label="Recently used tools">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-ink">Continue playing</h2>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 border-2 border-edge bg-card px-2 py-1 font-display text-[8px] text-ink-soft uppercase transition-colors hover:border-err hover:bg-err hover:text-canvas"
        >
          <X className="size-3" aria-hidden />
          Clear
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tools.map((tool, index) => (
          <a
            key={tool.id}
            href={tool.route}
            className="animate-pixel-in border-[3px] border-edge bg-card px-4 py-2 font-body text-lg text-ink shadow-[3px_3px_0_0_var(--color-shadow)] transition-all hover:-translate-y-0.5 hover:text-brand hover:shadow-[4px_4px_0_0_var(--color-shadow)]"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            ▸ {tool.name}
          </a>
        ))}
      </div>
    </section>
  );
}
