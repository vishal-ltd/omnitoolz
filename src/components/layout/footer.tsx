import Link from "next/link";
import { ChromeIcon } from "@/components/icons";
import { site } from "@/lib/site";
import { activeCategories, featuredTools } from "@/lib/tools/registry";
import { LogoMark } from "./logo";

export function Footer() {
  const categories = activeCategories();
  const featured = featuredTools().slice(0, 6);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-[3px] border-edge bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <span className="font-display text-xs text-ink">
              OMNI<span className="text-brand">TOOLZ</span>
            </span>
          </div>
          <p className="mt-3 font-display text-display-xs text-ink-soft uppercase">{site.tagline}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Every tool runs locally in your browser. Your files never leave your
            device — no upload, no storage, no tracking.
          </p>
        </div>

        <nav aria-label="Categories">
          <h2 className="font-display text-display-xs text-ink uppercase">Categories</h2>
          <ul className="mt-4 space-y-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link href={`/${category.slug}`} className="inline-flex min-h-11 items-center font-body text-lg text-ink-soft transition-colors hover:text-brand">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Featured tools">
          <h2 className="font-display text-display-xs text-ink uppercase">Popular tools</h2>
          <ul className="mt-4 space-y-2">
            {featured.map((tool) => (
              <li key={tool.id}>
                <Link href={tool.route} className="inline-flex min-h-11 items-center font-body text-lg text-ink-soft transition-colors hover:text-brand">
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="font-display text-display-xs text-ink uppercase">Company</h2>
          <ul className="mt-4 space-y-2">
            <li>
              <Link href="/about" className="inline-flex min-h-11 items-center font-body text-lg text-ink-soft transition-colors hover:text-brand">About</Link>
            </li>
            <li>
              <Link href="/privacy" className="inline-flex min-h-11 items-center font-body text-lg text-ink-soft transition-colors hover:text-brand">Privacy policy</Link>
            </li>
            <li>
              <Link href="/terms" className="inline-flex min-h-11 items-center font-body text-lg text-ink-soft transition-colors hover:text-brand">Terms of use</Link>
            </li>
            <li>
              <Link href="/contact" className="inline-flex min-h-11 items-center font-body text-lg text-ink-soft transition-colors hover:text-brand">Contact & feedback</Link>
            </li>
            <li>
              <Link href="/security" className="inline-flex min-h-11 items-center font-body text-lg text-ink-soft transition-colors hover:text-brand">Security</Link>
            </li>
            <li>
              <Link href="/accessibility" className="inline-flex min-h-11 items-center font-body text-lg text-ink-soft transition-colors hover:text-brand">Accessibility</Link>
            </li>
            <li>
              <a
                href={site.github.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 font-body text-lg text-ink-soft transition-colors hover:text-brand"
              >
                <ChromeIcon name="star" className="size-4 text-gold" />
                Star on GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>

      {/* ── Star call to action ──────────────────────────────────── */}
      <div className="border-t-[3px] border-edge">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center border-[3px] border-edge bg-gold text-on-gold shadow-[2px_2px_0_0_var(--color-shadow)]">
              <ChromeIcon name="star" className="size-5" />
            </span>
            <p className="font-display text-display-xs uppercase text-ink">Built in the open. Star it on GitHub.</p>
          </div>
          <a
            href={site.github.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border-[3px] border-edge bg-brand px-4 py-2.5 font-display text-display-xs text-on-brand uppercase shadow-[3px_3px_0_0_var(--color-shadow)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_var(--color-shadow)] active:translate-y-0.5 active:shadow-none"
          >
            <ChromeIcon name="star" className="size-4" />
            Star on GitHub
          </a>
        </div>
      </div>

      <div className="border-t-[3px] border-edge">
        <p className="mx-auto max-w-6xl px-4 py-5 text-center font-body text-base text-ink-soft">
          © {year} {site.name} every tool runs on your device — no uploads, ever.
        </p>
      </div>
    </footer>
  );
}
