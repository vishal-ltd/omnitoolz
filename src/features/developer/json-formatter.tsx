"use client";

import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Select, TextArea } from "@/components/ui/form";
import { countJsonNodes, formatJson, locateJsonError, minifyJson, type Indent } from "@/lib/json-tools";
import { cn } from "@/lib/utils";

interface Status {
  kind: "idle" | "valid" | "error";
  message: string;
  line?: number;
  column?: number;
}

export default function JsonFormatterTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState<Indent>(2);
  const [status, setStatus] = useState<Status>({ kind: "idle", message: "" });

  function run(mode: "format" | "minify") {
    if (input.trim().length === 0) {
      setStatus({ kind: "idle", message: "" });
      setOutput("");
      return;
    }
    try {
      const result = mode === "format" ? formatJson(input, indent) : minifyJson(input);
      const { keys, depth } = countJsonNodes(input);
      setOutput(result);
      setStatus({
        kind: "valid",
        message: `Valid JSON · ${keys.toLocaleString()} keys · nesting depth ${depth} · ${result.length.toLocaleString()} chars out`,
      });
    } catch (error) {
      const location = locateJsonError(error, input);
      setStatus({
        kind: "error",
        message: location.message,
        line: location.line,
        column: location.column,
      });
      setOutput("");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // Clipboard may be blocked — the textarea remains selectable.
    }
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label htmlFor="json-input" className="text-sm font-medium text-ink">
            JSON input
          </label>
          <div className="flex items-center gap-2">
            <label htmlFor="json-indent" className="text-sm text-ink-soft">
              Indent
            </label>
            <Select
              id="json-indent"
              value={indent}
              onChange={(event) => setIndent(Number(event.target.value) === 4 ? 4 : event.target.value === "tab" ? "tab" : 2)}
              className="h-9"
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value="tab">Tab</option>
            </Select>
          </div>
        </div>

        <TextArea
          id="json-input"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            if (status.kind !== "idle") setStatus({ kind: "idle", message: "" });
          }}
          placeholder={'{"paste": "your JSON here"}'}
          className="code-area min-h-44"
          spellCheck={false}
        />

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run("format")}>Format</Button>
          <Button variant="secondary" onClick={() => run("minify")}>
            Minify
          </Button>
          <Button variant="secondary" onClick={copy} disabled={output.length === 0}>
            Copy result
          </Button>
        </div>

        {status.kind === "valid" && (
          <p className="flex items-center gap-2 rounded-xl border border-ok/30 bg-ok-soft px-4 py-2.5 text-sm text-ok">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            {status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p
            className={cn(
              "rounded-xl border border-err/30 bg-err-soft px-4 py-2.5 text-sm text-err",
              "code-area",
            )}
            role="alert"
          >
            {status.line !== undefined && (
              <strong className="font-semibold">
                Error at line {status.line}, character {status.column}:{" "}
              </strong>
            )}
            {status.message}
          </p>
        )}

        <div>
          <label htmlFor="json-output" className="mb-2 block text-sm font-medium text-ink">
            Output
          </label>
          <TextArea
            id="json-output"
            readOnly
            value={output}
            placeholder="Formatted JSON appears here…"
            className="code-area min-h-44 bg-canvas"
            spellCheck={false}
          />
        </div>
      </div>
    </ToolWidget>
  );
}
