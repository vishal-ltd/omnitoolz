import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "OmniToolz terms of use: the service is provided as-is, your files stay yours, tools must not be used for unlawful content.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Terms of Use</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated: October 25, 2026</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-soft">
        <section>
          <h2 className="text-lg font-semibold text-ink">1. Acceptance</h2>
          <p>
            By using OmniToolz (&ldquo;the service&rdquo;) you agree to these terms. If you don&apos;t
            agree, please don&apos;t use the service. These terms apply to every tool on the site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">2. What the service is</h2>
          <p>
            OmniToolz provides free utilities that run in your web browser. All processing happens
            on your own device: the service has no servers that receive your files, and no
            infrastructure that could retain them. The service is provided free of charge, without
            an account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">3. Your files and content</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-ink">You keep every right.</strong> We claim no ownership or
              license over files you process, text you type, or results you download. We never see
              them — they are processed on your device and remain yours.
            </li>
            <li>
              <strong className="text-ink">You are responsible for what you process.</strong> Use
              the tools only with content you have the right to use, and only for lawful purposes.
              Don&apos;t use the service to process illegal material, to infringe others&apos;
              rights, or to violate any applicable law.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">4. Acceptable use</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Don&apos;t abuse the service: no automated bulk scraping of the site, no attempts to break or overload it, no interference with its operation.</li>
            <li>Don&apos;t redistribute or resell the site itself as your own service without permission.</li>
            <li>Don&apos;t misrepresent outputs of tools like signatures or invoices in a way that violates law or others&apos; rights. Signature placement, for example, places your own mark on a document — the legal validity of any signed document depends on your jurisdiction and the agreement involved, not on us.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">5. No warranty</h2>
          <p>
            The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
            warranties of any kind, express or implied — including fitness for a particular
            purpose, accuracy, or uninterrupted availability. File processing is performed by
            your browser using third-party open-source engines (pdf-lib, pdf.js, qpdf, libheif,
            Tesseract and others, each under its own open-source license); results may vary with
            your device, browser and input files.
          </p>
          <p>
            Tools that state limits — text-only document conversion, JPEG-only image extraction,
            text-level PDF comparison — mean them. Check important output before relying on it,
            and keep your originals.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">6. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, the service&apos;s operators are not liable
            for any indirect, incidental, special or consequential damages, or any loss of data,
            profits or business, arising from use of or inability to use the service. Nothing in
            these terms limits liability that cannot be limited by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">7. Intellectual property</h2>
          <p>
            The site&apos;s design, code and branding are the property of OmniToolz. Open-source
            engines used by the tools remain the property of their authors under their respective
            licenses (MIT, Apache-2.0 and similar). You retain all rights to your own content.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">8. Changes</h2>
          <p>
            We may update the service and these terms. Material changes to the terms will be
            posted on this page with a new date; continuing to use the service after a change
            means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">9. Governing law</h2>
          <p>
            These terms are governed by the laws applicable at the operator&apos;s place of
            business, without prejudice to mandatory consumer-protection rights in your country
            of residence.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">10. Contact</h2>
          <p>
            Questions about these terms? Use the contact address that will be published on this
            page alongside the final domain launch. See also our{" "}
            <Link href="/privacy" className="font-medium text-brand hover:underline">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </article>
  );
}
