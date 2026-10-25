"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form";
import { parsePageRanges } from "@/lib/page-ranges";
import { baseName, bytesToBlob } from "@/lib/utils";
import type { ResultFile } from "@/lib/utils";
import { loadPdfjs } from "./pdfjs";

function collapseSpaces(text: string): string {
  return text.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

export default function ExtractPdfTextTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [pagesInput, setPagesInput] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  async function extract() {
    const source = file!;
    setPreview(null);
    await start(async ({ report }) => {
      const pdfjs = await loadPdfjs();
      const bytes = new Uint8Array(await source.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const pageCount = doc.numPages;
      const targets = pagesInput.trim()
        ? parsePageRanges(pagesInput, pageCount)
        : Array.from({ length: pageCount }, (_, i) => i);

      const sections: string[] = [];
      let allText = "";
      for (const [index, pageIndex] of targets.entries()) {
        report(`Reading page ${pageIndex + 1} of ${pageCount}…`, (index + 0.5) / targets.length);
        const page = await doc.getPage(pageIndex + 1);
        const content = await page.getTextContent();
        page.cleanup();
        let pageText = "";
        for (const item of content.items) {
          if (!("str" in item)) continue;
          pageText += item.str;
          if (item.hasEOL) pageText += "\n";
        }
        pageText = collapseSpaces(pageText);
        if (targets.length > 1) {
          sections.push(`── Page ${pageIndex + 1} ──\n${pageText || "(no text on this page)"}`);
        }
        allText += pageText;
      }
      await doc.destroy();

      if (!allText.trim()) {
        throw new Error(
          "No text found — this PDF is probably a pure image scan. It needs OCR before text can be extracted.",
        );
      }

      const text = sections.length > 0 ? sections.join("\n\n") : allText;
      setPreview(text.slice(0, 1500));
      const result: ResultFile = {
        name: `${baseName(source.name)}.txt`,
        blob: bytesToBlob(new TextEncoder().encode(text), "text/plain;charset=utf-8"),
      };
      return [result];
    }, "Reading the PDF…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <div className="space-y-4">
          {preview && (
            <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
              <p className="font-display text-[9px] text-ink-soft uppercase">Preview</p>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap font-body text-lg leading-snug text-ink">
                {preview}
                {preview.length >= 1500 ? "…" : ""}
              </pre>
            </div>
          )}
          <Results
            results={state.results}
            elapsedMs={state.elapsedMs}
            onReset={() => {
              queue.clear();
              setPagesInput("");
              setPreview(null);
              reset();
            }}
          />
        </div>
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {file && (
            <OptionsPanel title="Extraction">
              <Field label="Pages (optional)" hint="Leave empty for the whole document — e.g. 1-5" className="sm:col-span-2">
                <TextInput
                  value={pagesInput}
                  onChange={(event) => setPagesInput(event.target.value)}
                  placeholder="All pages"
                  aria-label="Pages to extract"
                />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Output is plain UTF-8 text with page markers.</p>
            <Button size="lg" disabled={!file} onClick={extract}>
              Extract Text
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
