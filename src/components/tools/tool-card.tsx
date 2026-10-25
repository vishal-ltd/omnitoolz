import Link from "next/link";
import { ToolIcon } from "@/components/icons";
import type { ToolWithRoute } from "@/lib/tools/types";

/** Pixel card used on the homepage, category pages and related-tool sections. */
export function ToolCard({ tool, index = 0 }: { tool: ToolWithRoute; index?: number }) {
  return (
    <Link
      href={tool.route}
      className="group flex animate-pixel-in flex-col gap-3 border-[3px] border-edge bg-card p-5 shadow-[4px_4px_0_0_var(--color-shadow)] transition-[transform,box-shadow,background-color] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-brand-soft/40 hover:shadow-[6px_6px_0_0_var(--color-shadow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="flex items-start justify-between">
        <span className="flex size-11 items-center justify-center border-[3px] border-edge bg-brand-soft shadow-[3px_3px_0_0_var(--color-shadow)] transition-colors group-hover:bg-brand-softer">
          <ToolIcon name={tool.icon} className="size-5 text-brand" />
        </span>
        <span
          className="font-display text-xs text-brand opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        >
          ▸
        </span>
      </div>
      <div>
        <h3 className="text-[11px] text-ink group-hover:text-brand">{tool.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-ink-soft">{tool.description}</p>
      </div>
      <span className="mt-auto border-t-2 border-dashed border-line pt-2 font-display text-[8px] tracking-wide text-ink-soft uppercase">
        {tool.categoryName}
      </span>
    </Link>
  );
}
