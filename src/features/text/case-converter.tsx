"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/form";
import { convertCase, type CaseStyle } from "@/lib/case-convert";
import { downloadBlob } from "@/lib/utils";

export default function CaseConverterTool() {
  const [input, setInput] = useState("");
  const [style, setStyle] = useState<CaseStyle | null>(null);
  const [copied, setCopied] = useState(false);

  const output = style ? convertCase(input, style) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked; downloading remains available.
    }
  }

  const styles: Array<{ id: CaseStyle; label: string; hint: string }> = [
    { id: "upper", label: "UPPERCASE", hint: "SHOUT IT" },
    { id: "lower", label: "lowercase", hint: "quiet it down" },
    { id: "title", label: "Title Case", hint: "Capitalize Major Words" },
    { id: "sentence", label: "Sentence case", hint: "First letter of each sentence." },
    { id: "camel", label: "camelCase", hint: "variableNames" },
    { id: "pascal", label: "PascalCase", hint: "ComponentNames" },
    { id: "snake", label: "snake_case", hint: "file_names" },
    { id: "kebab", label: "kebab-case", hint: "url-slugs" },
    { id: "alternating", label: "aLtErNaTiNg", hint: "for the memes" },
    { id: "inverse", label: "iNVERSE", hint: "sWAP eVERY lETTER" },
  ];

  return (
    <ToolWidget>
      <div className="space-y-4">
        <label htmlFor="case-input" className="sr-only">
          Text to convert
        </label>
        <TextArea
          id="case-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste your text here, then pick a case style below…"
          className="min-h-40"
        />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Case styles">
          {styles.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={style === option.id}
              onClick={() => setStyle(option.id)}
              className={`border-[3px] px-3 py-2 font-display text-[9px] uppercase transition-all duration-100 ${
                style === option.id
                  ? "border-edge bg-brand text-on-brand shadow-[3px_3px_0_0_var(--color-shadow)]"
                  : "border-edge bg-card text-ink shadow-[3px_3px_0_0_var(--color-shadow)] hover:-translate-y-0.5 hover:text-brand hover:shadow-[4px_4px_0_0_var(--color-shadow)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {style && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="case-output" className="text-sm font-medium text-ink">
                Result
              </label>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={copy} disabled={output.length === 0}>
                  {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadBlob(new Blob([output], { type: "text/plain;charset=utf-8" }), "converted-text.txt")}
                  disabled={output.length === 0}
                >
                  <Download className="size-4" aria-hidden />
                  .txt
                </Button>
              </div>
            </div>
            <TextArea
              id="case-output"
              readOnly
              value={output}
              placeholder="The converted text appears here…"
              className="min-h-40 bg-canvas"
            />
          </div>
        )}
      </div>
    </ToolWidget>
  );
}
