import type { Metadata } from "next";
import Link from "next/link";
import { liveTools } from "@/lib/tools/registry";

export const metadata: Metadata = {
  title: "About",
  description:
    "OmniToolz is 55+ free, privacy-first tools that run entirely in your browser — PDFs, images, text, developer, security and media. No accounts, no uploads, no tracking.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-ink">About OmniToolz</h1>

      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-ink-soft">
        <p>
          OmniToolz is an all-in-one toolbox for the file tasks people actually run into: merging a
          PDF, protecting one with a password, signing a contract, shrinking a photo, removing a
          background, converting an iPhone photo, generating a password or a two-factor code, timing
          a regex, building an invoice. One consistent interface instead of a trail of ad-covered
          single-purpose sites.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-ink">Everything runs on your device</h2>
        <p>
          All <strong className="text-ink">{liveTools().length} tools</strong> process your files
          locally, in your browser. There is no upload step because there is no server doing the
          work. That is a deliberate architecture, not a marketing line:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-ink">Private by physics.</strong> Your contract, your IDs, your invoices never travel anywhere — not to us, not to anyone.</li>
          <li><strong className="text-ink">Fast.</strong> No upload queue, no processing queue. Files work at the speed of your own machine.</li>
          <li><strong className="text-ink">Free forever.</strong> Since we never touch your files, there are no storage or bandwidth costs to pass on. No account, no credits, no watermark.</li>
          <li><strong className="text-ink">Installable.</strong> Add OmniToolz to your home screen from your browser&apos;s menu — it always loads the latest version straight from the network, with no offline cache in the way.</li>
        </ul>
        <p>
          Where a tool needs a heavyweight engine — the AI background remover, OCR, the HEIF codec,
          the qpdf compressor — the engine itself is downloaded once from a public CDN and then
          runs entirely on your machine. Your files are never part of that download; the engine and
          your data never meet.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-ink">The honesty bar</h2>
        <p>
          We only publish a tool when it genuinely works and has been tested end-to-end. When a
          capability can&apos;t meet the quality bar yet, we say so instead of shipping something
          that silently damages files. Our PDF compression is strictly lossless; our document
          conversions state plainly that they are text-focused; every tool page carries a privacy
          note describing exactly what happens to your data, and the limits are spelled out in the
          FAQs.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-ink">The name</h2>
        <p>
          OmniToolz — <em>omni</em> (every) + toolz (tools, with an arcade &ldquo;z&rdquo; because
          the whole interface is a love letter to 16-bit consoles).
        </p>

        <p>
          Browse the{" "}
          <Link href="/" className="font-medium text-brand hover:underline">
            full catalog on the homepage
          </Link>{" "}
          — and if a tool you need is missing, it&apos;s probably on the roadmap: deeper document
          conversion fidelity, more OCR languages, touch-up brushes and audio tools are all next.
        </p>
      </div>
    </article>
  );
}
