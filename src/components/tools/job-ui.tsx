"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
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
      <legend className="px-2 font-display text-[9px] tracking-wide text-ink-soft uppercase">
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
      <p className="font-display text-[10px] leading-relaxed text-ink uppercase">
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
      {determinate && (
        <p className="mt-1.5 text-right font-body text-base text-ink-soft tabular-nums">
          {Math.round((state.progress ?? 0) * 100)}%
        </p>
      )}
    </div>
  );
}

/** Error banner; message comes from the job state machine. */
export function JobError({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="border-[3px] border-err bg-err-soft p-4 shadow-[4px_4px_0_0_var(--color-shadow)]" role="alert">
      <p className="flex items-start gap-2.5 font-display text-[10px] leading-relaxed text-err uppercase">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {message}
      </p>
      {children}
    </div>
  );
}

/** Small helper text under the primary action. */
export function ActionHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-soft">{children}</p>;
}
