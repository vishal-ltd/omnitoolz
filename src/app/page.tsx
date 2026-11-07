import Link from "next/link";
import { StructuredData } from "@/components/structured-data";
import { ChromeIcon, PixelIcon, ToolIcon, type ChromeName } from "@/components/icons";
import { HeroSearch } from "@/components/layout/hero-search";
import { HeroPreview } from "@/components/layout/hero-preview";
import { RecentTools } from "@/components/tools/recent-tools";
import { IconBox } from "@/components/ui/icon-box";
import { site } from "@/lib/site";
import { activeCategories, liveTools, toolsInCategory } from "@/lib/tools/registry";

const HERO_CHIPS = ["FREE", "NO SIGN-UP", "100% IN-BROWSER"];

export default function HomePage() {
  const categories = activeCategories();
  const tickerTools = liveTools();

  const ticker = [...tickerTools, ...tickerTools];

  return (
    <>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: site.name,
          url: site.url,
          description: site.description,
        }}
      />
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative mt-2 overflow-hidden border-[3px] border-edge bg-dither px-4 pt-14 pb-10 text-center shadow-[6px_6px_0_0_var(--color-shadow)] sm:pt-20">
        {/* floating pixel decorations */}
        <span className="absolute left-[8%] top-10 hidden size-3 border-2 border-edge bg-brand sm:block" aria-hidden style={{ animationDelay: "0s" }} />
        <span className="absolute right-[10%] top-16 hidden size-3 border-2 border-edge bg-gold sm:block" aria-hidden style={{ animationDelay: "0.4s" }} />
        <span className="absolute bottom-10 left-[16%] hidden size-2.5 border-2 border-edge bg-ok sm:block" aria-hidden style={{ animationDelay: "0.8s" }} />
        <span className="absolute bottom-16 right-[14%] hidden size-2.5 border-2 border-edge bg-err sm:block" aria-hidden style={{ animationDelay: "0.2s" }} />

        <div className="flex flex-wrap justify-center gap-2">
          {HERO_CHIPS.map((chip) => (
            <span
              key={chip}
              className="border-[3px] border-edge bg-card px-2.5 py-1 font-display text-display-xs text-ink-soft uppercase shadow-[2px_2px_0_0_var(--color-shadow)]"
            >
              {chip}
            </span>
          ))}
        </div>

        <h1 className="mx-auto mt-6 max-w-3xl animate-pixel-in text-display-md leading-[1.5] text-ink sm:text-display-lg">
          Every Tool.<br />
          <span className="text-brand">One Place.</span>
          <span className="ml-2 inline-block animate-blink text-ink" aria-hidden>▮</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
          Convert, compress, edit and organize documents, images and text —
          all free, all right in your browser. No uploads, ever.
        </p>

        <div className="mx-auto mt-8 max-w-xl">
          <HeroSearch />
        </div>

        <HeroPreview />
      </section>

      {/* ── Retro ticker ─────────────────────────────────────────── */}
      <div className="mt-6 overflow-hidden border-[3px] border-edge bg-brand py-2 shadow-[4px_4px_0_0_var(--color-shadow)]" aria-hidden>
        <div className="ticker-mask overflow-hidden">
          <div className="flex w-max animate-ticker gap-0">
            {ticker.map((tool, index) => (
              <span key={`${tool.id}-${index}`} className="flex items-center gap-3 whitespace-nowrap px-3 font-display text-display-xs text-on-brand uppercase">
                {tool.name}
                <span className="text-on-brand">◆</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <RecentTools />

      {/* ── Level select ─────────────────────────────────────────── */}
      <section className="mt-14" aria-labelledby="levels-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="levels-heading" className="text-display-sm sm:text-display-md text-ink">
            Level select
          </h2>
          <p className="font-body text-lg text-ink-soft">
            {liveTools().length} tools · {categories.length} worlds
          </p>
        </div>

        <ul className="mt-5 divide-y-[3px] divide-line border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
          {categories.map((category) => {
            const categoryTools = toolsInCategory(category.id);
            return (
              <li key={category.id} className="group transition-colors hover:bg-brand-soft/40">
                <div className="flex items-center gap-3 px-4 pt-3 sm:px-5">
                  <IconBox tone="soft" className="size-9 shrink-0">
                    <ToolIcon name={category.icon} className="size-4" />
                  </IconBox>
                  <h3 className="text-display-sm text-ink">
                    <Link href={`/${category.slug}`} className="inline-flex min-h-6 items-center transition-colors group-hover:text-brand">
                      {category.name}
                    </Link>
                  </h3>
                  <span className="font-body text-lg text-ink-soft tabular-nums">{categoryTools.length}</span>
                  <Link
                    href={`/${category.slug}`}
                    className="ml-auto inline-flex min-h-11 items-center gap-1 font-display text-display-xs text-ink-soft uppercase transition-colors group-hover:text-brand"
                  >
                    All <PixelIcon name="chevron" className="size-4" />
                  </Link>
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-3 font-body text-lg leading-snug text-ink-soft sm:px-5 sm:pl-[4.25rem]">
                  {categoryTools.slice(0, 4).map((tool) => (
                    <li key={tool.id}>
                      <Link href={tool.route} className="inline-flex min-h-6 items-center transition-colors hover:text-brand hover:underline">
                        {tool.name}
                      </Link>
                    </li>
                  ))}
                  {categoryTools.length > 4 && (
                    <li className="text-ink-soft">+{categoryTools.length - 4} more</li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Why ──────────────────────────────────────────────────── */}
      <section
        className="mt-14 border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]"
        aria-label="Why OmniToolz"
      >
        <div className="grid divide-y-[3px] divide-line sm:grid-cols-3 sm:divide-x-[3px] sm:divide-y-0">
          {[
            {
              icon: "shield" as ChromeName,
              title: "Private by design",
              body: "Files are processed on your device — nothing is uploaded, stored or shared.",
            },
            {
              icon: "zap" as ChromeName,
              title: "Fast by default",
              body: "No upload queues. Processing starts the moment you click the button.",
            },
            {
              icon: "laptop" as ChromeName,
              title: "Free, no account",
              body: "Every tool works without sign-up, without watermarks and without surprises.",
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="p-5">
              <IconBox tone="gold" className="size-10 shadow-[3px_3px_0_0_var(--color-shadow)]">
                <ChromeIcon name={icon} className="size-6" />
              </IconBox>
              <h3 className="mt-3 text-display-sm text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
