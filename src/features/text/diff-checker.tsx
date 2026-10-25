"use client";

import { useMemo, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/form";
import { diffLines, diffStats } from "@/lib/diff";

export default function DiffCheckerTool() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  const ops = useMemo(() => diffLines(left, right), [left, right]);
  const stats = useMemo(() => diffStats(ops), [ops]);
  const hasDiff = left !== right && (left || right);

  async function copyMerged() {
    // Right side wins: the "after" version.
    await navigator.clipboard.writeText(right);
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
            <p className="font-display text-[9px] uppercase">
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

        {!hasDiff && <p className="text-sm text-ink-soft">Paste text on both sides — the comparison runs live, line by line.</p>}

        {hasDiff && (
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
