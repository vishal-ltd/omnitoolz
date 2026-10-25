import Link from "next/link";
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
          <p className="mt-3 font-display text-[10px] text-ink-soft uppercase">{site.tagline}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Every tool runs locally in your browser. Your files never leave your
            device — no upload, no storage, no tracking.
          </p>
        </div>

        <nav aria-label="Categories">
          <h2 className="font-display text-[10px] text-ink uppercase">Categories</h2>
          <ul className="mt-4 space-y-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link href={`/${category.slug}`} className="font-body text-lg text-ink-soft transition-colors hover:text-brand">
                  ▸ {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Featured tools">
          <h2 className="font-display text-[10px] text-ink uppercase">Popular tools</h2>
          <ul className="mt-4 space-y-2">
            {featured.map((tool) => (
              <li key={tool.id}>
                <Link href={tool.route} className="font-body text-lg text-ink-soft transition-colors hover:text-brand">
                  ▸ {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="font-display text-[10px] text-ink uppercase">Company</h2>
          <ul className="mt-4 space-y-2">
            <li>
              <Link href="/about" className="font-body text-lg text-ink-soft transition-colors hover:text-brand">▸ About</Link>
            </li>
            <li>
              <Link href="/privacy" className="font-body text-lg text-ink-soft transition-colors hover:text-brand">▸ Privacy policy</Link>
            </li>
            <li>
              <Link href="/terms" className="font-body text-lg text-ink-soft transition-colors hover:text-brand">▸ Terms of use</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t-[3px] border-edge">
        <p className="mx-auto max-w-6xl px-4 py-5 text-center font-body text-base text-ink-soft">
          © {year} {site.name} · <span className="animate-blink" aria-hidden>▮</span> every tool runs on your device — no uploads, ever.
        </p>
      </div>
    </footer>
  );
}
