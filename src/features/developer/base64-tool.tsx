"use client";

import { useMemo, useState } from "react";
import { OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, TextArea } from "@/components/ui/form";

function encode(text: string, urlSafe: boolean): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base = btoa(binary);
  return urlSafe ? base.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : base;
}

function decode(input: string): string {
  const normalized = input.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function Base64Tool() {
  const [input, setInput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: "", error: null as string | null };
    try {
      return { output: mode === "encode" ? encode(input, urlSafe) : decode(input), error: null };
    } catch {
      return {
        output: "",
        error:
          mode === "decode"
            ? "That isn't valid Base64 — check for stray characters."
            : "Couldn't encode this text.",
      };
    }
    }, [input, mode, urlSafe]);

  async function copy() {
    if (output) await navigator.clipboard.writeText(output);
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        <div className="flex gap-2">
          {(["encode", "decode"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={`border-[3px] border-edge px-4 py-2 font-display text-[9px] uppercase shadow-[3px_3px_0_0_var(--color-shadow)] ${
                mode === option ? "bg-brand text-on-brand" : "bg-card text-ink-soft"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <Field label={mode === "encode" ? "Text" : "Base64"}>
          <TextArea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={mode === "encode" ? "Type or paste text…" : "Paste Base64…"}
            aria-label={mode === "encode" ? "Text to encode" : "Base64 to decode"}
            rows={5}
          />
        </Field>

        {error && <p className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">{error}</p>}

        <Field label="Result">
          <TextArea
            value={output}
            readOnly
            aria-label="Result"
            rows={5}
            placeholder="—"
          />
        </Field>

        <OptionsPanel title="Options">
          <div className="sm:col-span-2">
            <Checkbox
              checked={urlSafe}
              onChange={setUrlSafe}
              label="URL-safe alphabet (− and _ instead of + and /)"
            />
          </div>
        </OptionsPanel>

        <div className="flex gap-3">
          <Button onClick={copy} disabled={!output}>
            Copy result
          </Button>
          <Button variant="secondary" onClick={() => setInput("")}>
            Clear
          </Button>
        </div>
      </div>
    </ToolWidget>
  );
}
