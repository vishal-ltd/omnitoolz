import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security",
  description: "How to report security issues in OmniToolz.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="text-display-lg font-bold tracking-tight text-ink">Security</h1>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-soft">
        <p>
          OmniToolz processes user files in the browser. If you discover a security vulnerability in
          the application or its dependencies, please report it privately through GitHub&apos;s security
          advisory form rather than publishing exploit details.
        </p>
        <a
          href="https://github.com/vishal-ltd/omnitoolz/security/advisories/new"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex border-[3px] border-edge bg-brand px-4 py-3 font-display text-display-xs text-on-brand shadow-[3px_3px_0_0_var(--color-shadow)]"
        >
          Submit a private report ↗
        </a>
        <section>
          <h2 className="text-display-sm font-semibold text-ink">What to include</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>A short description and affected route or dependency.</li>
            <li>Reproduction steps that do not require private files or secrets.</li>
            <li>The potential impact and any suggested mitigation.</li>
          </ul>
        </section>
        <p>
          Do not include passwords, private documents, access tokens or personal information in a
          report. See the <a className="font-medium text-brand underline" href="https://github.com/vishal-ltd/omnitoolz/security/policy" target="_blank" rel="noopener noreferrer">security policy</a> for the project&apos;s current disclosure guidance.
        </p>
      </div>
    </article>
  );
}
