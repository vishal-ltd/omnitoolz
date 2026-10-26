import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "OmniToolz privacy policy: every tool processes files locally in your browser. No uploads, no accounts, no tracking cookies, no analytics.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated: October 25, 2026</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-soft">
        <section className="border-[3px] border-ok bg-ok-soft p-4">
          <p className="font-body text-lg text-ink">
            <strong className="font-semibold">The short version:</strong> every tool on this site
            runs entirely inside your web browser. Your files and text are processed on your own
            device and are never uploaded, received, read, stored or shared by us. We couldn&apos;t
            look at your data if we wanted to — it never reaches any server we control.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">1. What stays on your device</h2>
          <p>
            Files you select, text you type, passwords you generate and results you download are
            handled by client-side JavaScript running in your browser. When a tool says &ldquo;runs
            in your browser&rdquo;, that is a technical statement, not a slogan: no network request
            carries your content anywhere. You can verify this yourself — open your browser&apos;s
            developer tools, watch the network tab, and run any tool. The only requests are the
            site&apos;s own app files.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">2. What we collect</h2>
          <p>Nothing, in the ordinary sense of the word:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong className="text-ink">No accounts.</strong> There is no sign-up, so there are no user profiles.</li>
            <li><strong className="text-ink">No cookies.</strong> This site sets no tracking or advertising cookies.</li>
            <li><strong className="text-ink">No analytics.</strong> This build ships without analytics of any kind. If privacy-respecting, aggregate analytics are added later, this policy will be updated first, and collection will never include file contents, file names, typed text, passwords or generated codes.</li>
            <li><strong className="text-ink">No server logs of your work.</strong> Since your files never reach a server, there is nothing to log about them.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">3. What is stored in your browser (localStorage)</h2>
          <p>
            Three small preferences live in your browser&apos;s localStorage, all of which you
            control and can delete at any time from your browser settings:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong className="text-ink">Recently used tools</strong> — tool names only, never file names or contents. Clear it with the “Clear” button on the homepage list.</li>
            <li><strong className="text-ink">Theme choice</strong> — light, dark or system.</li>
            <li><strong className="text-ink">Accent color</strong> — which color palette you picked.</li>
          </ul>
          <p>
            This data never leaves your browser and is not transmitted to us. It is not shared
            between devices because it is not stored anywhere else.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">4. Engines downloaded from CDNs</h2>
          <p>
            A few heavyweight tools fetch their processing engine once from a public CDN (jsDelivr
            / staticimgly / this site&apos;s own static files): the OCR engine (Tesseract), the AI
            background-removal model, the HEIF codec, the qpdf compressor and the PDF rendering
            worker. These downloads contain only code and model weights. Your files are never
            attached to these requests. OmniToolz keeps no offline copy of itself — every visit
            loads fresh from the network.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">5. No service worker</h2>
          <p>
            OmniToolz does not install a service worker and does not keep an offline cache of
            itself. If this site were ever unreachable, the tools would be too — by design, so you
            always run the latest version. Your browser&apos;s ordinary HTTP cache may hold static
            files (as it does for any website), and your saved preferences are limited to the
            settings listed in section 3.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">6. Third-party content</h2>
          <p>
            The site loads its two bitmap fonts from its own files and, where noted, engines from
            public CDNs. We do not embed advertising scripts, social-media widgets or third-party
            trackers of any kind.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">7. Children&apos;s privacy</h2>
          <p>
            The service collects no personal information from anyone, of any age — there is
            nothing to disclose under children&apos;s privacy rules because there is no data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">8. Your rights (GDPR, CCPA &amp; friends)</h2>
          <p>
            Regulations like the GDPR and CCPA give you rights over personal data that services
            hold about you. OmniToolz holds nothing: there is no account, no database of users, no
            file history on any server. The only data associated with your use lives in your own
            browser and is yours to delete at any time. In effect, every data right (access,
            erasure, portability) is satisfied by design.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">9. If server-side tools are ever added</h2>
          <p>
            Some future capabilities (pixel-perfect document conversion, for example) may require
            server processing. Before any such tool ships, this policy will be updated to disclose
            it clearly — what is transmitted, how long it is retained, and how it is deleted — and
            the tool page itself will state where processing happens. Browser-only tools will
            remain browser-only, and every page will keep its honest label.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">10. Changes to this policy</h2>
          <p>
            If this policy changes, the updated version will be posted on this page with a new
            &ldquo;last updated&rdquo; date. Material changes will be called out at the top.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">11. Contact</h2>
          <p>
            Privacy questions or a security report? Reach out through the contact address that
            will be published on this page alongside the final domain launch.
          </p>
        </section>
      </div>
    </article>
  );
}
