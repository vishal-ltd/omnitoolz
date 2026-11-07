"use client";

import Link from "next/link";
import { ChromeIcon } from "@/components/icons";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobState } from "./use-job";

/** Pixel panel wrapping the interactive area of every tool page. */
export function ToolWidget({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "animate-pixel-in border-[3px] border-edge bg-card p-5 shadow-[6px_6px_0_0_var(--color-shadow)] sm:p-6",
        className,
      )}
      aria-label="Tool workspace"
    >
      {children}
    </section>
  );
}

/** Grouped options block inside the widget. */
export function OptionsPanel({
  title,
  children,
  columns = 2,
}: {
  title: string;
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <fieldset className="border-[3px] border-dashed border-line-strong bg-canvas/60 p-4">
      <legend className="px-2 font-display text-display-xs tracking-wide text-ink-soft uppercase">
        {title}
      </legend>
      <div
        className={cn(
          "mt-2 grid gap-x-4 gap-y-4",
          columns === 2 ? "sm:grid-cols-2" : "",
        )}
      >
        {children}
      </div>
    </fieldset>
  );
}

/** Live status with a real striped retro progress bar (never fake %). */
export function JobProgress({ state }: { state: JobState }) {
  const determinate = state.progress !== null;
  return (
    <div className="border-[3px] border-edge bg-brand-soft p-4" role="status" aria-live="polite">
      <p className="font-display text-display-xs leading-relaxed text-ink uppercase">
        <span className="mr-2 inline-block animate-blink" aria-hidden>▮</span>
        {state.statusMessage || "Working…"}
      </p>
      <div className="mt-3 h-5 overflow-hidden border-[3px] border-edge bg-card">
        {determinate ? (
          <div
            className="pixel-stripes h-full transition-[width] duration-300"
            style={{ width: `${Math.max(4, Math.round((state.progress ?? 0) * 100))}%` }}
          />
        ) : (
          <div className="pixel-stripes h-full w-full" />
        )}
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-2 font-body text-base text-ink-soft">
        <span className="border-[3px] border-edge bg-ok-soft px-1.5 font-display text-display-xs text-ink">0 B uploaded</span>
        {determinate && <span className="tabular-nums">{Math.round((state.progress ?? 0) * 100)}%</span>}
      </p>
    </div>
  );
}

/**
 * Error panel. The headline names the failure in the user's language, the raw
 * engine string stays behind a disclosure for reporting, and the panel always
 * leaves a way out — retry the same job or dismiss.
 */
export function JobError({
  error,
  detail = null,
  kind = null,
  onRetry,
  onDismiss,
}: {
  error: string | null;
  detail?: string | null;
  kind?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-[3px] border-err bg-err-soft p-4 shadow-[4px_4px_0_0_var(--color-shadow)]"
    >
      <p className="flex items-center gap-2.5 font-display text-display-xs uppercase text-ink">
        <ChromeIcon name="alert" className="size-4 shrink-0 text-err" />
        Run failed
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink">{error}</p>
      <p className="mt-1.5 text-xs text-ink-soft">
        Nothing was written and your files are still queued.
      </p>

      {detail && (
        <details className="mt-3">
          <summary className="cursor-pointer font-display text-display-xs uppercase text-ink-soft hover:text-ink">
            Technical detail
          </summary>
          <p className="mt-2 break-words font-body text-base leading-snug text-ink">
            {kind ? `${kind}: ` : ""}
            {detail}
          </p>
          <Link
            href="/contact"
            className="mt-2 inline-block font-body text-base text-brand-strong underline underline-offset-4 hover:text-brand"
          >
            Report this
          </Link>
        </details>
      )}

      {(onRetry || onDismiss) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}
          {onDismiss && (
            <Button size="sm" variant="secondary" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Small helper text under the primary action. */
export function ActionHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-soft">{children}</p>;
}
