import { ChromeIcon } from "@/components/icons";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const linkBase =
  "inline-flex items-center justify-center gap-2 border-[3px] border-edge font-display uppercase tracking-wide shadow-[3px_3px_0_0_var(--color-shadow)] transition-[transform,box-shadow,background-color,border-color,color] duration-100 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_var(--color-shadow)] active:translate-y-0.5 active:shadow-none";

/**
 * The one place that knows where the repository lives. Every star affordance
 * on the site is an outbound link, so it is always safe to render on the
 * server — no API call, no third-party script, no tracking.
 */
function starHref() {
  return site.github.url;
}

/** Compact header control: gold star + "Star", label widens on large screens. */
export function GitHubStarButton({ className }: { className?: string }) {
  return (
    <a
      href={starHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Star ${site.name} on GitHub`}
      title={`Star ${site.name} on GitHub`}
      className={cn(linkBase, "group h-11 bg-card px-2.5 text-ink-soft hover:bg-gold hover:text-on-gold sm:px-3", className)}
    >
      <ChromeIcon name="star" className="size-4 text-gold group-hover:text-on-gold" />
      <span className="hidden xl:inline">Star on GitHub</span>
    </a>
  );
}

/** Full-width call to action used on the home page. */
export function GitHubStarBanner({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex flex-col items-center gap-4 border-[3px] border-edge bg-card p-5 shadow-[4px_4px_0_0_var(--color-shadow)] sm:flex-row sm:text-left",
        className,
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center border-[3px] border-edge bg-gold text-on-gold shadow-[2px_2px_0_0_var(--color-shadow)]">
        <ChromeIcon name="star" className="size-6" />
      </span>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="font-display text-display-xs uppercase text-ink">Built in the open</p>
        <p className="mt-2 text-base leading-snug text-ink-soft">
          Like {site.name}? Give the project a star on GitHub — it helps more people find free,
          private tools.
        </p>
      </div>
      <a
        href={starHref()}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(linkBase, "shrink-0 bg-brand px-4 py-3 text-on-brand hover:bg-brand-strong")}
      >
        <ChromeIcon name="star" className="size-4" />
        Star on GitHub
      </a>
    </aside>
  );
}

/** Full-width row for the mobile navigation drawer. */
export function GitHubStarMenuLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <a
      href={starHref()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onNavigate}
      className="flex items-center justify-between border-[3px] border-edge bg-gold px-3 py-2.5 font-display text-display-xs text-on-gold uppercase shadow-[2px_2px_0_0_var(--color-shadow)] transition-transform active:translate-y-0.5"
    >
      <span className="flex items-center gap-2">
        <ChromeIcon name="star" className="size-4" />
        Star on GitHub
      </span>
      <span aria-hidden>↗</span>
    </a>
  );
}
