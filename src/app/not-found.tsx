import Link from "next/link";
import { featuredTools } from "@/lib/tools/registry";

export default function NotFound() {
  const suggestions = featuredTools().slice(0, 4);

  return (
    <div className="bg-dither mx-auto mt-8 max-w-xl border-[3px] border-edge px-6 py-14 text-center shadow-[6px_6px_0_0_var(--color-shadow)]">
      <p className="font-display text-[10px] tracking-widest text-brand uppercase">Error 404</p>
      <h1 className="mt-4 text-base leading-[1.7] text-ink sm:text-lg">
        Game over —<br />page not found
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        The page you&apos;re looking for doesn&apos;t exist… but one of these tools might
        be what you came for.
      </p>
      <p className="mt-6 animate-blink font-display text-[10px] text-ink-soft uppercase" aria-hidden>
        ▾ press start ▾
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {suggestions.map((tool) => (
          <Link
            key={tool.id}
            href={tool.route}
            className="border-[3px] border-edge bg-card px-3.5 py-2 font-display text-[9px] text-ink shadow-[3px_3px_0_0_var(--color-shadow)] transition-all hover:-translate-y-0.5 hover:text-brand hover:shadow-[4px_4px_0_0_var(--color-shadow)]"
          >
            {tool.name}
          </Link>
        ))}
      </div>
      <Link
        href="/"
        className="mt-8 inline-block border-[3px] border-edge bg-brand px-6 py-3 font-display text-[10px] text-on-brand uppercase shadow-[4px_4px_0_0_var(--color-shadow)] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-shadow)] active:translate-y-1 active:shadow-none"
      >
        ▸ Back to homepage
      </Link>
    </div>
  );
}
