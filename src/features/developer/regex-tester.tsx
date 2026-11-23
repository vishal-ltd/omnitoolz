"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Checkbox, Field, TextArea, TextInput } from "@/components/ui/form";
import { regexWorkerSource, type RegexMatchInfo } from "@/lib/utils";

const SAFE_TEST_TEXT_MAX = 20_000;
const MAX_MATCHES = 500;
const WORKER_TIMEOUT_MS = 2_000;

interface RunResult {
  matches: RegexMatchInfo[];
  error: string | null;
  capped: boolean;
}

const IDLE_RESULT: RunResult = { matches: [], error: null, capped: false };

export default function RegexTesterTool() {
  const [pattern, setPattern] = useState("");
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [multiline, setMultiline] = useState(false);
  const [dotAll, setDotAll] = useState(false);
  const [unicode, setUnicode] = useState(false);
  const [testText, setTestText] = useState("");

  // One model only. A free-text flags box used to sit next to these checkboxes
  // and quietly ignored everything except "u".
  const effectiveFlags = useMemo(
    () => `g${caseInsensitive ? "i" : ""}${multiline ? "m" : ""}${dotAll ? "s" : ""}${unicode ? "u" : ""}`,
    [caseInsensitive, multiline, dotAll, unicode],
  );

  const [result, setResult] = useState<RunResult>(IDLE_RESULT);
  const workerUrlRef = useRef<string | null>(null);

  // The old 20K text cap never bounded execution: (a+)+$ against 30 characters
  // backtracks for minutes on the main thread. Every run now happens inside a
  // worker that is terminated on a hard deadline — no pattern can freeze the
  // tab, and a newer keystroke terminates the previous run.
  useEffect(() => {
    if (!pattern || !testText) {
      setResult(IDLE_RESULT);
      return;
    }
    const safeText = testText.length > SAFE_TEST_TEXT_MAX ? testText.slice(0, SAFE_TEST_TEXT_MAX) : testText;
    if (!workerUrlRef.current) {
      workerUrlRef.current = URL.createObjectURL(new Blob([regexWorkerSource()], { type: "text/javascript" }));
    }
    const worker = new Worker(workerUrlRef.current);
    let settled = false;
    let timer = 0;
    const finish = (next: RunResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      worker.terminate();
      setResult(next);
    };
    timer = window.setTimeout(() => {
      finish({
        matches: [],
        capped: false,
        error:
          "Stopped after 2 seconds — this pattern backtracks catastrophically on your text. Simplify nested quantifiers like (a+)+ or shorten the test text.",
      });
    }, WORKER_TIMEOUT_MS);
    worker.onmessage = (
      event: MessageEvent<{ ok: boolean; matches?: RegexMatchInfo[]; capped?: boolean; error?: string }>,
    ) => {
      const data = event.data;
      finish(
        data.ok
          ? { matches: data.matches ?? [], capped: data.capped ?? false, error: null }
          : { matches: [], capped: false, error: data.error ?? "Invalid pattern." },
      );
    };
    worker.onerror = () => {
      finish({ matches: [], capped: false, error: "The pattern runner couldn't start — reload the page and try again." });
    };
    worker.postMessage({ pattern, flags: effectiveFlags, text: safeText, maxMatches: MAX_MATCHES });
    return () => {
      settled = true;
      window.clearTimeout(timer);
      worker.terminate();
    };
  }, [pattern, testText, effectiveFlags]);

  // Revoke the shared worker-script URL on unmount; null the ref so a
  // StrictMode remount builds a fresh one instead of reusing a revoked URL.
  useEffect(
    () => () => {
      if (workerUrlRef.current) {
        URL.revokeObjectURL(workerUrlRef.current);
        workerUrlRef.current = null;
      }
    },
    [],
  );

  // Build highlighted output pieces. Zero-width matches highlight nothing but
  // must not swallow the character that follows them.
  const segments = useMemo(() => {
    const parts: Array<{ text: string; hit: boolean }> = [];
    let cursor = 0;
    for (const match of result.matches) {
      if (match.index > cursor) parts.push({ text: testText.slice(cursor, match.index), hit: false });
      if (match.text.length > 0) {
        parts.push({ text: match.text, hit: true });
        cursor = match.index + match.text.length;
      }
    }
    if (cursor < testText.length) parts.push({ text: testText.slice(cursor), hit: false });
    return parts;
  }, [result.matches, testText]);

  return (
    <ToolWidget>
      <div className="space-y-4">
        <Field label="Pattern">
          <TextInput
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder="\b\w+@\w+\.\w+\b"
            aria-label="Regular expression"
            className="font-body"
          />
        </Field>

        <OptionsPanel title="Flags">
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <Checkbox checked={caseInsensitive} onChange={setCaseInsensitive} label="i — case-insensitive" />
            <Checkbox checked={multiline} onChange={setMultiline} label="m — multiline ^$" />
            <Checkbox checked={dotAll} onChange={setDotAll} label="s — dot matches all" />
            <Checkbox checked={unicode} onChange={setUnicode} label="u — unicode" />
          </div>
        </OptionsPanel>

        <Field label="Test text">
          <TextArea
            value={testText}
            onChange={(event) => setTestText(event.target.value)}
            placeholder="Paste the text to match against…"
            aria-label="Test text"
            rows={6}
          />
        </Field>

        {result.error && <p className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">{result.error}</p>}

        <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
          <p className="font-display text-display-xs text-ink-soft uppercase">
            {result.matches.length} {result.matches.length === 1 ? "match" : "matches"}
            {result.capped && ` · showing first ${MAX_MATCHES}`}
            {result.matches.length > 0 && ` · flags /${effectiveFlags}/`}
          </p>
          {testText.length > SAFE_TEST_TEXT_MAX && (
            <p className="mt-1 text-sm text-ink-soft">
              Only the first {SAFE_TEST_TEXT_MAX.toLocaleString()} characters are tested.
            </p>
          )}
          <p className="mt-2 whitespace-pre-wrap break-words font-body text-lg leading-snug text-ink">
            {segments.map((segment, index) =>
              segment.hit ? (
                <mark key={index} className="bg-gold/60 px-0.5 text-on-gold">
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </p>
        </div>

        {result.matches.some((match) => match.groups.length > 0) && (
          <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card">
            {result.matches.slice(0, 20).map((match, index) => (
              <li key={index} className="px-4 py-2 font-body text-lg text-ink">
                <span className="text-ink-soft">#{index + 1} </span>
                “{match.text.slice(0, 40)}”
                {match.groups.length > 0 && (
                  <span className="text-ink-soft"> — groups: {match.groups.map((g, i) => `$${i + 1}=${g}`).join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ToolWidget>
  );
}
