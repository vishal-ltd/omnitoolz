"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { baseName, bytesToBlob, type ResultFile } from "@/lib/utils";

export default function ImageToTextTool() {
  const queue = useFileQueue({ accept: ["png", "jpg", "jpeg", "webp", "bmp"], multiple: true, maxFiles: 10, maxSizeMb: 20 });
  const { state, start, reset, retry } = useJob();
  const [preview, setPreview] = useState<string | null>(null);

  async function extract() {
    const sources = queue.files;
    setPreview(null);
    await start(async ({ report }) => {
      report("Loading the OCR engine (first run downloads it once)…", 0.1);
      const { createWorker } = await import("tesseract.js");
      // tesseract.js never settles createWorker when the language download
      // fails (only core-load failures reject), so bound the wait ourselves.
      // errorHandler stops the library rethrowing inside its own message
      // handler; failures already surface through the rejected promise.
      let loadTimer = 0;
      const worker = await Promise.race([
        createWorker("eng", undefined, { errorHandler: () => {} }),
        new Promise<never>((_, reject) => {
          loadTimer = window.setTimeout(
            () => reject(new Error("The OCR engine took too long to download — check your connection and try again.")),
            90_000,
          );
        }),
      ]).finally(() => window.clearTimeout(loadTimer));
      const results: ResultFile[] = [];
      let allText = "";
      try {
        for (const [index, source] of sources.entries()) {
          report(`Reading “${source.name}”…`, (index + 0.2) / (sources.length + 0.2));
          const { data } = await worker.recognize(source);
          const text = data.text.replace(/\n{3,}/g, "\n\n").trim();
          allText += (allText ? "\n\n" : "") + text;
          results.push({
            name: `${baseName(source.name)}.txt`,
            blob: bytesToBlob(new TextEncoder().encode(text || "(no text detected)"), "text/plain;charset=utf-8"),
          });
        }
      } finally {
        await worker.terminate();
      }
      if (!allText.trim()) {
        throw new Error("No readable text found in these images — try higher resolution or stronger contrast.");
      }
      // Cut on a code-point boundary so the preview never ends in half an emoji.
      let previewText = allText.slice(0, 1200);
      if (/[\uD800-\uDBFF]$/.test(previewText)) previewText = previewText.slice(0, -1);
      setPreview(previewText);
      return results;
    }, "Starting OCR…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <div className="space-y-4">
          {preview && (
            <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
              <p className="font-display text-display-xs text-ink-soft uppercase">Preview</p>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap font-body text-lg leading-snug text-ink">
                {preview}
                {preview.length >= 1199 ? "…" : ""}
              </pre>
            </div>
          )}
          <Results
            results={state.results}
            elapsedMs={state.elapsedMs}
            zipBaseName={`${baseName(queue.files[0]?.name ?? "ocr")}-text`}
            onReset={() => {
              queue.clear();
              setPreview(null);
              reset();
            }}
          />
        </div>
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone
            accept={["png", "jpg", "jpeg", "webp", "bmp"]}
            multiple
            maxFiles={10}
            maxSizeMb={20}
            onFiles={queue.addFiles}
            existingCount={queue.files.length}
          />
          <FileList files={queue.files} onRemove={queue.removeAt} onUndo={queue.undoRemove} undoLabel={queue.lastRemoved} />

          {state.phase === "error" && <JobError error={state.error} detail={state.errorDetail} kind={state.errorKind} onRetry={retry} onDismiss={reset} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              The OCR engine (Tesseract, English) loads once from a CDN and then runs locally — your
              images are never uploaded.
            </p>
            <Button size="lg" disabled={queue.files.length === 0} onClick={extract}>
              Extract Text
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
