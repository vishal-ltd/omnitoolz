import Link from "next/link";
import { ChromeIcon, PixelIcon, ToolIcon, type ChromeName } from "@/components/icons";
import { ToolRenderer } from "@/components/tools/tool-renderer";
import { IconBox } from "@/components/ui/icon-box";
import { dropsContent, intentOf, type Intent } from "@/lib/tools/intent";
import { relatedTools } from "@/lib/tools/registry";
import type { ToolWithRoute } from "@/lib/tools/types";

/**
 * What the tool does to your files, said plainly. The three header badges used
 * to be identical for a word counter and a password-protected PDF; this one is
 * the badge that actually tells you something.
 */
const FILE_OUTCOME: Record<Intent, { icon: ChromeName; label: string }> = {
  convert: { icon: "download", label: "Writes a new file — original untouched" },
  edit: { icon: "download", label: "Writes a new file — original untouched" },
  inspect: { icon: "eye", label: "Reads only — nothing is written" },
  create: { icon: "sparkles", label: "Generates a new file from what you type" },
};

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
          <li><Link href="/" className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-brand">Home</Link></li>
          <li aria-hidden className="font-display text-display-xs">▸</li>
          <li><Link href={`/${categorySlug}`} className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-brand">{categoryName}</Link></li>
          <li aria-hidden className="font-display text-display-xs">▸</li>
          <li aria-current="page" className="text-ink">{tool.name}</li>
        </ol>
      </nav>

      <header className="mt-5">
        <div className="flex items-start gap-4">
          <IconBox className="size-16 shrink-0 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <ToolIcon name={tool.icon} className="size-8" />
          </IconBox>
          <div>
            <h1 className="text-display-md text-ink sm:text-display-lg">{tool.name}</h1>
            <p className="mt-2 max-w-2xl text-base leading-snug text-ink-soft">{tool.description}</p>
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          <li className="flex items-center gap-1.5 border-[3px] border-edge bg-ok-soft px-2.5 py-1 font-display text-display-xs text-ink uppercase shadow-[2px_2px_0_0_var(--color-shadow)]">
            <ChromeIcon name="shield" className="size-3.5 text-ok" /> Files never leave your device
          </li>
          <li className="flex items-center gap-1.5 border-[3px] border-edge bg-brand-soft px-2.5 py-1 font-display text-display-xs text-ink uppercase shadow-[2px_2px_0_0_var(--color-shadow)]">
            <ChromeIcon name="laptop" className="size-3.5 text-brand" /> Runs in your browser
          </li>
          <li className="flex items-center gap-1.5 border-[3px] border-edge bg-canvas px-2.5 py-1 font-display text-display-xs text-ink-soft uppercase shadow-[2px_2px_0_0_var(--color-shadow)]">
            <ChromeIcon name={FILE_OUTCOME[intentOf(tool)].icon} className="size-4" /> {FILE_OUTCOME[intentOf(tool)].label}
          </li>
        </ul>
        {dropsContent(tool.id) && (
          <p className="mt-3 flex items-start gap-2.5 border-[3px] border-warn bg-warn-soft px-3 py-2 text-sm leading-snug text-ink">
            <span className="mt-0.5 shrink-0 font-display text-display-xs text-warn" aria-hidden>
              !
            </span>
            This one leaves something out of the result — pages, fields or pixels are gone by
            design. Check the download before you replace the original.
          </p>
        )}
      </header>

      <div id="workspace" className="mt-6 scroll-mt-24">
        <ToolRenderer toolId={tool.id} />
      </div>

      <div className="mt-12 grid max-w-3xl gap-10">
        <section aria-labelledby="how-to-heading">
          <h2 id="how-to-heading" className="text-display-sm sm:text-display-md text-ink">
            How to use {tool.name}
          </h2>
          <ol className="mt-4 space-y-3">
            {tool.howTo.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                <span className="flex size-7 shrink-0 items-center justify-center border-[3px] border-edge bg-brand-soft font-display text-display-xs text-ink">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-display-sm sm:text-display-md text-ink">FAQ</h2>
          <div className="mt-4 divide-y-[3px] divide-line border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
            {tool.faqs.map((faq) => (
              <details key={faq.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-display text-display-xs leading-relaxed text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {faq.q}
                    <span className="mt-0.5 shrink-0 text-brand transition-transform duration-100 group-open:rotate-90" aria-hidden>
                      <PixelIcon name="chevron" className="size-4" />
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="privacy-heading" className="border-[3px] border-edge bg-card p-5 shadow-[4px_4px_0_0_var(--color-shadow)]">
          <h2 id="privacy-heading" className="flex items-center gap-2 text-display-sm text-ink">
            <ChromeIcon name="shield" className="size-4 text-ok" />
            Privacy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{tool.privacyNote}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Read more in our <Link href="/privacy" className="font-medium text-brand hover:underline">privacy policy</Link>.
          </p>
        </section>
      </div>

      <section className="mt-14" aria-labelledby="related-heading">
        <h2 id="related-heading" className="text-display-sm sm:text-display-md text-ink">Related tools</h2>
        <ul className="mt-4 divide-y-[3px] divide-line border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
          {related.map((relatedTool) => (
            <li key={relatedTool.id}>
              <Link
                href={relatedTool.route}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-soft"
              >
                <ToolIcon name={relatedTool.icon} className="size-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-display-xs text-ink group-hover:text-brand">
                    {relatedTool.name}
                  </span>
                  <span className="mt-1 block truncate text-sm text-ink-soft">{relatedTool.description}</span>
                </span>
                <PixelIcon name="chevron" className="size-4 shrink-0 text-ink-soft group-hover:text-brand" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-[3px] border-edge pt-6">
        <a
          href="#workspace"
          className="inline-flex min-h-11 items-center border-[3px] border-edge bg-brand px-4 font-display text-display-xs text-on-brand uppercase shadow-[3px_3px_0_0_var(--color-shadow)] transition-[transform,box-shadow,background-color,border-color,color] hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-[4px_4px_0_0_var(--color-shadow)] active:translate-y-0.5 active:shadow-none"
        >
          {tool.acceptedFormats.length > 0 ? "Process another file" : "Start again"}
        </a>
        <p className="font-body text-lg text-ink-soft">
          {tool.acceptedFormats.length > 0
            ? "end of level — your files are still on this page, nothing left your device."
            : "end of level — nothing you typed left your device."}
        </p>
      </div>
    </>
  );
}
