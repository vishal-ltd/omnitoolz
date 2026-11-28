import { ChromeIcon, PixelIcon } from "@/components/icons";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const linkBase =
  "items-center justify-center gap-2 border-[3px] border-edge font-display text-display-xs uppercase tracking-wide shadow-[3px_3px_0_0_var(--color-shadow)] transition-[transform,box-shadow,background-color,border-color,color] duration-100 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_var(--color-shadow)] active:translate-y-0.5 active:shadow-none";

/**
 * The one place that knows where the repository lives. Every star affordance
 * on the site is an outbound link, so it is always safe to render on the
 * server — no API call, no third-party script, no tracking.
 */
function starHref() {
  return site.github.url;
}

/**
 * Compact header control, shown from lg up. The short label appears at xl
 * alongside the main nav; below that the star stands alone.
 */
export function GitHubStarButton({ className }: { className?: string }) {
  return (
    <a
      href={starHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Star ${site.name} on GitHub`}
      title={`Star ${site.name} on GitHub`}
      className={cn(
        linkBase,
        "hidden h-11 shrink-0 whitespace-nowrap bg-gold px-3 text-on-gold hover:bg-brand hover:text-on-brand lg:inline-flex",
        className,
      )}
    >
      <ChromeIcon name="star" className="size-4 shrink-0" />
      <span className="hidden xl:inline">Star</span>
    </a>
  );
}

/** Solid brand button shared by the banner and the footer strip. */
export function GitHubStarCta({ className }: { className?: string }) {
  return (
    <a
      href={starHref()}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        linkBase,
        "inline-flex min-h-11 shrink-0 bg-brand px-4 py-3 text-on-brand hover:bg-brand-strong",
        className,
      )}
    >
      <ChromeIcon name="star" className="size-4 shrink-0" />
      Star on GitHub
    </a>
  );
}

/** Full-width call to action used on the home page. */
export function GitHubStarBanner({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex flex-col items-center gap-4 border-[3px] border-edge bg-card p-5 shadow-[4px_4px_0_0_var(--color-shadow)] sm:flex-row",
        className,
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center border-[3px] border-edge bg-gold text-on-gold shadow-[2px_2px_0_0_var(--color-shadow)]">
        <ChromeIcon name="star" className="size-6" />
      </span>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h2 className="font-display text-display-xs uppercase text-ink">Built in the open</h2>
        <p className="mt-2 text-base leading-snug text-ink-soft">
          Like {site.name}? Give the project a star on GitHub — it helps more people find free,
          private tools.
        </p>
      </div>
      <GitHubStarCta />
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
      className="flex min-h-11 items-center justify-between border-[3px] border-edge bg-gold px-3 py-2.5 font-display text-display-xs text-on-gold uppercase shadow-[2px_2px_0_0_var(--color-shadow)] transition-transform active:translate-y-0.5"
    >
      <span className="flex items-center gap-2">
        <ChromeIcon name="star" className="size-4" />
        Star on GitHub
      </span>
      <PixelIcon name="chevron" className="size-4" />
    </a>
  );
}
