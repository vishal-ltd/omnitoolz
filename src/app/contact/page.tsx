import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact and Feedback",
  description: "Contact OmniToolz for product feedback, broken outputs and support.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="text-display-lg font-bold tracking-tight text-ink">Contact and feedback</h1>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-soft">
        <p>
          OmniToolz is maintained in the open. Report a reproducible bug, suggest a tool, or tell us
          when an output is not useful through the project issue tracker.
        </p>
        <p>
          Please do not attach private documents, passwords, tokens or other sensitive content to a
          public issue. Describe the file type and the steps that failed instead.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/vishal-ltd/omnitoolz/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center border-[3px] border-edge bg-brand px-4 py-3 font-display text-display-xs text-on-brand shadow-[3px_3px_0_0_var(--color-shadow)]"
          >
            Open an issue ↗
          </a>
          <Link href="/security" className="inline-flex items-center border-[3px] border-edge bg-card px-4 py-3 font-display text-display-xs text-ink shadow-[3px_3px_0_0_var(--color-shadow)]">
            Report a security issue
          </Link>
        </div>
      </div>
    </article>
  );
}
