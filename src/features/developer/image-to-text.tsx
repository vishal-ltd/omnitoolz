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
  const { state, start, reset } = useJob();
  const [preview, setPreview] = useState<string | null>(null);

  async function extract() {
    const sources = queue.files;
    setPreview(null);
    await start(async ({ report }) => {
      report("Loading the OCR engine (first run downloads it once)…", 0.1);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
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
      setPreview(allText.slice(0, 1200));
      return results;
    }, "Starting OCR…");
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
                {preview.length >= 1200 ? "…" : ""}
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
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

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
