"use client";

import { useMemo, useState } from "react";
import { INTENTS, groupByIntent, type Intent } from "@/lib/tools/intent";
import type { ToolWithRoute } from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { ToolCard } from "./tool-card";

/**
 * Category catalogue: a filter row and the tools grouped by intent. A flat
 * wall of 33 identical cards gives nothing to grab onto; four named groups and
 * a search box do.
 */
export function ToolCatalog({
  tools,
  showCategory = true,
}: {
  tools: ToolWithRoute[];
  showCategory?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? tools.filter((tool) =>
          `${tool.name} ${tool.description} ${tool.keywords.join(" ")}`.toLowerCase().includes(needle),
        )
      : tools;
    return groupByIntent(matched).filter((group) => !intent || group.intent.id === intent);
  }, [tools, query, intent]);

  const shown = groups.reduce((total, group) => total + group.tools.length, 0);
  const filtered = query.trim().length > 0 || intent !== null;

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)] sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2">
          <span className="sr-only">Filter tools</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name or what it does…"
            className="h-11 w-full border-[3px] border-edge bg-canvas px-3 font-body text-lg text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Group by intent">
          {[{ id: null as Intent | null, label: "All" }, ...INTENTS.map((entry) => ({ id: entry.id as Intent | null, label: entry.label }))].map(
            (chip) => (
              <button
                key={chip.label}
                type="button"
                aria-pressed={intent === chip.id}
                onClick={() => setIntent(chip.id)}
                className={cn(
                  "h-11 border-[3px] border-edge px-3 font-display text-display-xs uppercase transition-colors",
                  intent === chip.id
                    ? "bg-brand text-on-brand"
                    : "bg-canvas text-ink-soft hover:bg-brand-soft hover:text-brand",
                )}
              >
                {chip.label}
              </button>
            ),
          )}
        </div>
      </div>

      <p role="status" aria-live="polite" className="mt-3 font-body text-lg text-ink-soft">
        {shown} of {tools.length} tools{filtered ? " match" : ""}
      </p>

      {shown === 0 && (
        <div className="mt-6 border-[3px] border-edge bg-canvas p-6 text-center shadow-[4px_4px_0_0_var(--color-shadow)]">
          <p className="font-display text-display-sm text-ink">Nothing matches that</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Try a plainer word — “pdf”, “image”, “merge” — or clear the filters and browse the groups.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIntent(null);
            }}
            className="mt-4 h-11 border-[3px] border-edge bg-brand px-4 font-display text-display-xs text-on-brand uppercase shadow-[3px_3px_0_0_var(--color-shadow)] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_var(--color-shadow)]"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.intent.id} aria-labelledby={`intent-${group.intent.id}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-[3px] border-edge pb-2">
              <h2 id={`intent-${group.intent.id}`} className="text-display-sm text-ink sm:text-display-md">
                {group.intent.label}
              </h2>
              <p className="font-body text-lg text-ink-soft">{group.intent.blurb}</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool, index) => (
                <ToolCard key={tool.id} tool={tool} index={index} showCategory={showCategory} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
