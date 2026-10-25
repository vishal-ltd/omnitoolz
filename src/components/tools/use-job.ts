"use client";

import { useCallback, useState } from "react";
import type { ResultFile } from "@/lib/utils";

export type JobPhase = "idle" | "running" | "done" | "error";

export interface JobState {
  phase: JobPhase;
  /** Human-readable progress line shown while running. */
  statusMessage: string;
  /** Fraction 0..1 when measurable, null for indeterminate work. */
  progress: number | null;
  results: ResultFile[];
  error: string | null;
  elapsedMs: number | null;
}

export interface JobContext {
  report: (message: string, progress?: number) => void;
}

const IDLE: JobState = {
  phase: "idle",
  statusMessage: "",
  progress: null,
  results: [],
  error: null,
  elapsedMs: null,
};

/**
 * Shared processing-job state machine for browser tools: idle → running →
 * done/error. Tool handlers report real progress (never fabricated, plan §7)
 * and any thrown error becomes a friendly message in the UI.
 */
export function useJob() {
  const [state, setState] = useState<JobState>(IDLE);

  const start = useCallback(
    async (fn: (ctx: JobContext) => Promise<ResultFile[]>, busyMessage = "Processing…") => {
      setState({ ...IDLE, phase: "running", statusMessage: busyMessage });
      const startedAt = performance.now();
      try {
        const results = await fn({
          report: (message, progress) =>
            setState((prev) =>
              prev.phase === "running"
                ? {
                    ...prev,
                    statusMessage: message,
                    progress:
                      typeof progress === "number"
                        ? Math.min(1, Math.max(0, progress))
                        : null,
                  }
                : prev,
            ),
        });
        setState({
          ...IDLE,
          phase: "done",
          progress: 1,
          results,
          elapsedMs: performance.now() - startedAt,
        });
      } catch (error) {
        setState({
          ...IDLE,
          phase: "error",
          error:
            error instanceof Error && error.message
              ? error.message
              : "Something went wrong while processing. Please try again.",
          elapsedMs: performance.now() - startedAt,
        });
      }
    },
    [],
  );

  const reset = useCallback(() => setState(IDLE), []);

  return { state, start, reset };
}
