"use client";

import { useCallback, useRef, useState } from "react";
import type { ResultFile } from "@/lib/utils";

export type JobPhase = "idle" | "running" | "done" | "error";

export interface JobState {
  phase: JobPhase;
  /** Human-readable progress line shown while running. */
  statusMessage: string;
  /** Fraction 0..1 when measurable, null for indeterminate work. */
  progress: number | null;
  results: ResultFile[];
  /** What to show the user: our own wording, never an engine stack string. */
  error: string | null;
  /** Raw engine message, kept behind a disclosure for reporting. */
  errorDetail: string | null;
  /** e.g. "TypeError" — shown only next to the raw detail. */
  errorKind: string | null;
  elapsedMs: number | null;
}

export interface JobContext {
  report: (message: string, progress?: number) => void;
}

type JobFn = (ctx: JobContext) => Promise<ResultFile[]>;

const IDLE: JobState = {
  phase: "idle",
  statusMessage: "",
  progress: null,
  results: [],
  error: null,
  errorDetail: null,
  errorKind: null,
  elapsedMs: null,
};

/**
 * Engine failures carry V8 wording that means nothing here. Our own code throws
 * plain Error with a sentence aimed at the user, so anything coming from a
 * built-in error type gets replaced and the original stays available to report.
 */
const ENGINE_ERRORS = [TypeError, RangeError, ReferenceError, SyntaxError, URIError, EvalError];
const ENGINE_FALLBACK =
  "This file could not be processed. It may be corrupt, empty, or not the kind of file this tool expects.";

function describeError(error: unknown): Pick<JobState, "error" | "errorDetail" | "errorKind"> {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return { error: ENGINE_FALLBACK, errorDetail: null, errorKind: null };
  const isEngine = error instanceof Error && ENGINE_ERRORS.some((type) => error instanceof type);
  if (isEngine) {
    return { error: ENGINE_FALLBACK, errorDetail: raw, errorKind: error instanceof Error ? error.name : null };
  }
  return { error: raw, errorDetail: null, errorKind: null };
}

/**
 * Shared processing-job state machine for browser tools: idle → running →
 * done/error. Tool handlers report real progress (never fabricated, plan §7)
 * and any thrown error becomes a friendly message in the UI.
 */
export function useJob() {
  const [state, setState] = useState<JobState>(IDLE);
  const lastRun = useRef<{ fn: JobFn; busyMessage: string } | null>(null);

  const start = useCallback(async (fn: JobFn, busyMessage = "Processing…") => {
    lastRun.current = { fn, busyMessage };
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
        ...describeError(error),
        elapsedMs: performance.now() - startedAt,
      });
    }
  }, []);

  const reset = useCallback(() => setState(IDLE), []);

  /** Re-runs the last job — the retry the error panel offers. */
  const retry = useCallback(() => {
    const run = lastRun.current;
    if (run) void start(run.fn, run.busyMessage);
  }, [start]);

  return { state, start, reset, retry };
}
