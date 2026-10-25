import { Laptop, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { StructuredData } from "@/components/structured-data";
import { ToolIcon } from "@/components/icons";
import { HeroSearch } from "@/components/layout/hero-search";
import { RecentTools } from "@/components/tools/recent-tools";
import { ToolCard } from "@/components/tools/tool-card";
import { site } from "@/lib/site";
import { activeCategories, featuredTools, liveTools } from "@/lib/tools/registry";

const HERO_CHIPS = ["FREE", "NO SIGN-UP", "100% IN-BROWSER"];

export default function HomePage() {
  const featured = featuredTools();
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
        <span className="absolute left-[8%] top-10 hidden size-3 animate-blink bg-brand sm:block" aria-hidden style={{ animationDelay: "0s" }} />
        <span className="absolute right-[10%] top-16 hidden size-3 animate-blink bg-gold sm:block" aria-hidden style={{ animationDelay: "0.4s" }} />
        <span className="absolute bottom-10 left-[16%] hidden size-2 animate-blink bg-ok sm:block" aria-hidden style={{ animationDelay: "0.8s" }} />
        <span className="absolute bottom-16 right-[14%] hidden size-2 animate-blink bg-err sm:block" aria-hidden style={{ animationDelay: "0.2s" }} />

        <div className="flex flex-wrap justify-center gap-2">
          {HERO_CHIPS.map((chip) => (
            <span
              key={chip}
              className="border-[3px] border-edge bg-card px-2.5 py-1 font-display text-[8px] text-ink-soft uppercase shadow-[2px_2px_0_0_var(--color-shadow)]"
            >
              {chip}
            </span>
          ))}
        </div>

        <h1 className="mx-auto mt-6 max-w-3xl animate-pixel-in text-base leading-[1.7] text-ink sm:text-xl">
          Every Tool.<br />
          <span className="text-brand">One Place.</span>
          <span className="ml-2 inline-block animate-blink text-gold" aria-hidden>▮</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
          Convert, compress, edit and organize documents, images and text —
          all free, all right in your browser. No uploads, ever.
        </p>

        <div className="mx-auto mt-8 max-w-xl">
          <HeroSearch />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {featured.slice(0, 6).map((tool, index) => (
            <Link
              key={tool.id}
              href={tool.route}
              className="animate-pixel-in border-[3px] border-edge bg-card px-3.5 py-1.5 font-display text-[9px] text-ink shadow-[3px_3px_0_0_var(--color-shadow)] transition-all hover:-translate-y-0.5 hover:text-brand hover:shadow-[4px_4px_0_0_var(--color-shadow)]"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              {tool.name}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Retro ticker ─────────────────────────────────────────── */}
      <div className="mt-6 overflow-hidden border-[3px] border-edge bg-brand py-2 shadow-[4px_4px_0_0_var(--color-shadow)]" aria-hidden>
        <div className="flex w-max animate-ticker gap-0">
          {ticker.map((tool, index) => (
            <span key={`${tool.id}-${index}`} className="flex items-center gap-3 whitespace-nowrap px-3 font-display text-[9px] text-on-brand uppercase">
              {tool.name}
              <span className="text-gold">◆</span>
            </span>
          ))}
        </div>
      </div>

      <RecentTools />

      {/* ── Featured tools ───────────────────────────────────────── */}
      <section className="mt-14" aria-labelledby="featured-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="featured-heading" className="text-sm text-ink">
            Featured tools <span className="text-brand" aria-hidden>★</span>
          </h2>
          <p className="font-body text-lg text-ink-soft">{liveTools().length} tools and counting</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((tool, index) => (
            <ToolCard key={tool.id} tool={tool} index={index} />
          ))}
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────── */}
      <section className="mt-14" aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="text-sm text-ink">
          Browse categories <span className="text-brand" aria-hidden>▸▸</span>
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/${category.slug}`}
              className="group animate-pixel-in border-[3px] border-edge bg-card p-5 shadow-[4px_4px_0_0_var(--color-shadow)] transition-[transform,box-shadow,background-color] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-brand-soft/40 hover:shadow-[6px_6px_0_0_var(--color-shadow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2.5 text-[11px] text-ink group-hover:text-brand">
                  <span className="flex size-9 items-center justify-center border-[3px] border-edge bg-brand-soft">
                    <ToolIcon name={category.icon} className="size-4.5 text-brand" />
                  </span>
                  {category.name}
                </h3>
                <span className="border-[3px] border-edge bg-brand px-2 py-0.5 font-display text-[9px] text-on-brand">
                  {category.toolCount}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Why ──────────────────────────────────────────────────── */}
      <section className="mt-14" aria-label="Why OmniToolz">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              Icon: ShieldCheck,
              title: "Private by design",
              body: "Files are processed on your device — nothing is uploaded, stored or shared.",
            },
            {
              Icon: Zap,
              title: "Fast by default",
              body: "No upload queues. Processing starts the moment you click the button.",
            },
            {
              Icon: Laptop,
              title: "Free, no account",
              body: "Every tool works without sign-up, without watermarks and without surprises.",
            },
          ].map(({ Icon, title, body }, index) => (
            <div
              key={title}
              className="animate-pixel-in border-[3px] border-edge bg-card p-6 shadow-[4px_4px_0_0_var(--color-shadow)]"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span className="flex size-12 items-center justify-center border-[3px] border-edge bg-gold shadow-[3px_3px_0_0_var(--color-shadow)]">
                <Icon className="size-6 text-ink" aria-hidden />
              </span>
              <h3 className="mt-4 text-[11px] text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
