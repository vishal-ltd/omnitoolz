"use client";

import { useMemo, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/form";
import { diffLines, diffStats } from "@/lib/diff";

export default function DiffCheckerTool() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  // The LCS table is O(a·b): two 10K-line pastes would allocate ~800 MB and
  // crash the tab. Cap the live diff and say so instead of dying silently.
  const MAX_DIFF_LINES = 2000;
  const tooLarge =
    left.split("\n").length > MAX_DIFF_LINES || right.split("\n").length > MAX_DIFF_LINES;

  const ops = useMemo(() => (tooLarge ? [] : diffLines(left, right)), [left, right, tooLarge]);
  const stats = useMemo(() => diffStats(ops), [ops]);
  const hasDiff = !tooLarge && left !== right && (left || right);

  async function copyMerged() {
    // Right side wins: the "after" version.
    try {
      await navigator.clipboard.writeText(right);
    } catch {
      // Clipboard may be blocked — the text areas remain selectable.
    }
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Field label="Original">
            <TextArea
              value={left}
              onChange={(event) => setLeft(event.target.value)}
              placeholder="Paste the original text…"
              aria-label="Original text"
              rows={8}
            />
          </Field>
          <Field label="Changed">
            <TextArea
              value={right}
              onChange={(event) => setRight(event.target.value)}
              placeholder="Paste the changed text…"
              aria-label="Changed text"
              rows={8}
            />
          </Field>
        </div>

        {hasDiff && (
          <div className="border-[3px] border-edge bg-card p-3 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <p className="font-display text-display-xs uppercase">
              <span className="text-ok">+{stats.added}</span> <span className="text-ink-soft">added ·</span>{" "}
              <span className="text-err">-{stats.removed}</span> <span className="text-ink-soft">removed</span>
            </p>
          </div>
        )}

        {hasDiff && (
          <div className="max-h-96 overflow-auto border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
            {ops.map((op, index) => (
              <pre
                key={index}
                className={`whitespace-pre-wrap break-words border-l-[6px] px-4 py-1.5 font-body text-lg leading-snug ${
                  op.type === "add"
                    ? "border-ok bg-ok-soft text-ink"
                    : op.type === "remove"
                      ? "border-err bg-err-soft text-ink-soft"
                      : "border-transparent text-ink-soft"
                }`}
              >
                {op.type === "add" ? "+ " : op.type === "remove" ? "- " : "  "}
                {op.text}
              </pre>
            ))}
          </div>
        )}

        {tooLarge && (
          <p className="border-[3px] border-warn bg-warn-soft p-3 font-body text-lg text-ink">
            These texts are over {MAX_DIFF_LINES.toLocaleString()} lines — too large for the live diff. Trim them to compare.
          </p>
        )}

        {!hasDiff && !tooLarge && <p className="text-sm text-ink-soft">Paste text on both sides — the comparison runs live, line by line.</p>}

        {(hasDiff || tooLarge) && (
          <div className="flex gap-3">
            <Button onClick={copyMerged}>Copy changed version</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setLeft("");
                setRight("");
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    </ToolWidget>
  );
}
