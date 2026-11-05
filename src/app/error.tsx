"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-8 max-w-xl border-[3px] border-err bg-err-soft p-8 text-center shadow-[6px_6px_0_0_var(--color-shadow)]">
      <p className="font-display text-display-xs text-err uppercase">Something went wrong</p>
      <h1 className="mt-4 text-display-md text-ink">The tool hit an unexpected error.</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">
        Your local files remain in your browser. Try again, or return to the catalogue.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/"
          className="inline-flex h-11 items-center border-[3px] border-edge bg-card px-4 font-display text-display-xs uppercase text-ink shadow-[3px_3px_0_0_var(--color-shadow)]"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
