"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { ComponentType } from "react";
import { toolLoaders } from "@/features/tool-loaders";
import { recordRecentTool } from "./recent-tools";

function WidgetSkeleton() {
  return (
    <div className="flex h-72 animate-pixel-in flex-col items-center justify-center gap-4 border-[3px] border-edge bg-card shadow-[6px_6px_0_0_var(--color-shadow)]">
      <div className="flex gap-2" aria-hidden>
        <span className="size-4 animate-blink bg-brand" style={{ animationDelay: "0s" }} />
        <span className="size-4 animate-blink bg-gold" style={{ animationDelay: "0.2s" }} />
        <span className="size-4 animate-blink bg-ok" style={{ animationDelay: "0.4s" }} />
      </div>
      <p className="font-display text-[10px] text-ink-soft uppercase">Loading tool…</p>
    </div>
  );
}

/* Per-tool code-split chunks: only the active tool's UI ships to the page. */
const components: Record<string, ComponentType> = Object.fromEntries(
  Object.entries(toolLoaders).map(([id, load]) => [
    id,
    dynamic(load, { ssr: false, loading: () => <WidgetSkeleton /> }),
  ]),
);

/**
 * Renders the interactive widget for a tool id and records usage in the
 * anonymous local "recent tools" list (plan §6.5).
 */
export function ToolRenderer({ toolId }: { toolId: string }) {
  useEffect(() => {
    recordRecentTool(toolId);
  }, [toolId]);

  const Component = components[toolId];
  if (!Component) return <WidgetSkeleton />;
  return <Component />;
}
