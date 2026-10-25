"use client";

import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { baseName } from "@/lib/utils";
import { loadPdf, outputBaseName, savePdf } from "./pdf-core";

export default function MergePdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: true, maxFiles: 20, maxSizeMb: 100 });
  const { state, start, reset } = useJob();

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const ready = queue.files.length >= 2;

  async function merge() {
    const files = queue.files;
    await start(async ({ report }) => {
      const { PDFDocument } = await import("pdf-lib");
      const merged = await PDFDocument.create();
      for (const [index, file] of files.entries()) {
        report(`Adding ${file.name}…`, (index + 0.5) / files.length);
        const source = await loadPdf(file);
        const copiedPages = await merged.copyPages(source, source.getPageIndices());
        for (const page of copiedPages) merged.addPage(page);
      }
      report("Writing the merged PDF…", 1);
      return [await savePdf(merged, `${outputBaseName(files[0])}-merged.pdf`)];
    }, "Merging PDFs…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "document")}-merged`}
          onReset={() => {
            queue.clear();
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone
            accept={["pdf"]}
            multiple
            maxFiles={20}
            maxSizeMb={100}
            existingCount={queue.files.length}
            onFiles={queue.addFiles}
            hint="Add files in any order — you can reorder them before merging."
          />
          <FileList files={queue.files} onRemove={queue.removeAt} onMove={queue.move} />
          {state.phase === "error" && <JobError message={state.error ?? ""} />}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {ready
                ? `${queue.files.length} files · merged in the order shown above`
                : "Add at least two PDF files to merge"}
            </p>
            <Button size="lg" disabled={!ready} onClick={merge}>
              Merge PDFs
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
