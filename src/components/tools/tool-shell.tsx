import { ChevronRight, CloudDownload, Laptop, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ToolIcon } from "@/components/icons";
import { ToolCard } from "@/components/tools/tool-card";
import { ToolRenderer } from "@/components/tools/tool-renderer";
import { relatedTools } from "@/lib/tools/registry";
import type { ToolWithRoute } from "@/lib/tools/types";

/**
 * Shared tool page layout (plan §7): breadcrumbs, header with badges, the
 * interactive widget, how-to steps, FAQs, related tools and the privacy note —
 * all in the pixel design system.
 */
export function ToolShell({
  tool,
  categoryName,
  categorySlug,
}: {
  tool: ToolWithRoute;
  categoryName: string;
  categorySlug: string;
}) {
  const related = relatedTools(tool);

  return (
    <>
      <nav aria-label="Breadcrumb" className="font-body text-base text-ink-soft">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="transition-colors hover:text-brand">Home</Link></li>
          <li aria-hidden className="font-display text-[8px]">▸</li>
          <li><Link href={`/${categorySlug}`} className="transition-colors hover:text-brand">{categoryName}</Link></li>
          <li aria-hidden className="font-display text-[8px]">▸</li>
          <li aria-current="page" className="text-ink">{tool.name}</li>
        </ol>
      </nav>

      <header className="mt-5">
        <div className="flex items-start gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center border-[3px] border-edge bg-brand-soft shadow-[4px_4px_0_0_var(--color-shadow)]">
            <ToolIcon name={tool.icon} className="size-8 text-brand" />
          </span>
          <div>
            <h1 className="text-lg text-ink sm:text-xl">{tool.name}</h1>
            <p className="mt-2 max-w-2xl text-base leading-snug text-ink-soft">{tool.description}</p>
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          <li className="flex items-center gap-1.5 border-[3px] border-edge bg-ok-soft px-2.5 py-1 font-display text-[8px] text-ok uppercase shadow-[2px_2px_0_0_var(--color-shadow)]">
            <ShieldCheck className="size-3.5" aria-hidden /> Files never leave your device
          </li>
          <li className="flex items-center gap-1.5 border-[3px] border-edge bg-brand-soft px-2.5 py-1 font-display text-[8px] text-ink uppercase shadow-[2px_2px_0_0_var(--color-shadow)]">
            <Laptop className="size-3.5" aria-hidden /> Runs in your browser
          </li>
          <li className="flex items-center gap-1.5 border-[3px] border-edge bg-canvas px-2.5 py-1 font-display text-[8px] text-ink-soft uppercase shadow-[2px_2px_0_0_var(--color-shadow)]">
            <CloudDownload className="size-3.5" aria-hidden /> Always the latest version
          </li>
        </ul>
      </header>

      <div className="mt-6 max-w-3xl">
        <ToolRenderer toolId={tool.id} />
      </div>

      <div className="mt-12 grid max-w-3xl gap-10">
        <section aria-labelledby="how-to-heading" className="animate-pixel-in">
          <h2 id="how-to-heading" className="text-sm text-ink">
            How to use {tool.name}
          </h2>
          <ol className="mt-4 space-y-3">
            {tool.howTo.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                <span className="flex size-7 shrink-0 items-center justify-center border-[3px] border-edge bg-brand-soft font-display text-[9px] text-ink">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq-heading" className="animate-pixel-in">
          <h2 id="faq-heading" className="text-sm text-ink">FAQ</h2>
          <div className="mt-4 divide-y-[3px] divide-line border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
            {tool.faqs.map((faq) => (
              <details key={faq.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-display text-[10px] leading-relaxed text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {faq.q}
                    <span className="mt-0.5 shrink-0 text-brand transition-transform duration-100 group-open:rotate-90" aria-hidden>
                      ▸
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="privacy-heading" className="border-[3px] border-edge bg-card p-5 shadow-[4px_4px_0_0_var(--color-shadow)]">
          <h2 id="privacy-heading" className="flex items-center gap-2 text-[11px] text-ink">
            <ShieldCheck className="size-4 text-ok" aria-hidden />
            Privacy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{tool.privacyNote}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Read more in our <Link href="/privacy" className="font-medium text-brand hover:underline">privacy policy</Link>.
          </p>
        </section>
      </div>

      <section className="mt-14" aria-labelledby="related-heading">
        <h2 id="related-heading" className="text-sm text-ink">Related tools</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((relatedTool, index) => (
            <ToolCard key={relatedTool.id} tool={relatedTool} index={index} />
          ))}
        </div>
      </section>

      <div className="mt-8 flex items-center gap-1.5 text-ink-soft" aria-hidden>
        <ChevronRight className="size-3" />
        <span className="font-body text-sm">end of level — scroll back up to process another file</span>
      </div>
    </>
  );
}
