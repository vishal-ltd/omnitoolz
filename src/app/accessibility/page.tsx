import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "Accessibility information for OmniToolz.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Accessibility</h1>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-soft">
        <p>
          OmniToolz supports keyboard navigation, visible focus indicators, semantic headings, reduced
          motion preferences, and labelled controls throughout the shared interface.
        </p>
        <section>
          <h2 className="text-lg font-semibold text-ink">Known limitations</h2>
          <p className="mt-2">
            Canvas-based tools such as signing, cropping and touch-up editing have limited support for
            non-pointer input. Use the issue tracker to report a barrier or request an alternative
            interaction.
          </p>
        </section>
        <p>
          If a page is difficult to use with your assistive technology, please report the route,
          browser and interaction that failed through the <a className="font-medium text-brand underline" href="https://github.com/vishal-ltd/omnitoolz/issues" target="_blank" rel="noopener noreferrer">issue tracker</a>.
        </p>
      </div>
    </article>
  );
}
