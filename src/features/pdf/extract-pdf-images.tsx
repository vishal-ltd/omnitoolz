"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { baseName, bytesToBlob, type ResultFile } from "@/lib/utils";
import { loadPdf } from "./pdf-core";

export default function ExtractPdfImagesTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [stats, setStats] = useState<{ extracted: number; skipped: number } | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  async function extract() {
    const source = file!;
    setStats(null);
    await start(async ({ report }) => {
      const { PDFName, PDFRawStream } = await import("pdf-lib");
      const doc = await loadPdf(source);

      report("Scanning embedded objects…", 0.5);
      const results: ResultFile[] = [];
      let skipped = 0;
      for (const [, object] of doc.context.enumerateIndirectObjects()) {
        if (!(object instanceof PDFRawStream)) continue;
        const dict = object.dict;
        const subtype = dict.get(PDFName.of("Subtype"));
        if (!subtype || subtype.toString() !== "/Image") continue;
        const filter = dict.get(PDFName.of("Filter"))?.toString() ?? "";
        if (filter.includes("DCTDecode")) {
          // A plain embedded JPEG — export bytes untouched.
          results.push({
            name: `image-${results.length + 1}.jpg`,
            blob: bytesToBlob(object.contents, "image/jpeg"),
          });
        } else {
          skipped++;
        }
      }

      if (results.length === 0) {
        throw new Error(
          skipped > 0
            ? `Found ${skipped} image${skipped === 1 ? "" : "s"}, but in encodings this tool can't export losslessly. Use “PDF to JPG” to render the pages instead.`
            : "No embedded pictures found in this PDF — the pages may be pure text or vector graphics. Use “PDF to JPG” to render pages as images.",
        );
      }
      setStats({ extracted: results.length, skipped });
      return results;
    }, "Scanning the PDF…");
  }

  const note =
    stats && stats.skipped > 0
      ? `${stats.extracted} JPEG ${stats.extracted === 1 ? "image" : "images"} recovered at original quality · ${stats.skipped} in other ${stats.skipped === 1 ? "encoding" : "encodings"} skipped.`
      : stats
        ? `${stats.extracted} JPEG ${stats.extracted === 1 ? "image" : "images"} recovered at original quality.`
        : undefined;

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(file?.name ?? "pdf")}-images`}
          note={note}
          onReset={() => {
            queue.clear();
            setStats(null);
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Pictures come out byte-for-byte — no re-compression.</p>
            <Button size="lg" disabled={!file} onClick={extract}>
              Extract Images
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
