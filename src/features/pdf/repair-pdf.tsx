"use client";

import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { baseName, suffixedName, type ResultFile } from "@/lib/utils";
import { readFileBytes, savePdf, yieldToUi } from "./pdf-core";

export default function RepairPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: true, maxFiles: 20, maxSizeMb: 100 });
  const { state, start, reset } = useJob();

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  async function repair() {
    const sources = queue.files;
    await start(async ({ report }) => {
      const { PDFDocument } = await import("pdf-lib");
      const results: ResultFile[] = [];
      const failures: string[] = [];
      for (const [index, source] of sources.entries()) {
        report(`Rebuilding “${source.name}”…`, (index + 0.5) / sources.length);
        try {
          const bytes = await readFileBytes(source);
          const doc = await PDFDocument.load(bytes, {
            // Tolerate broken objects and encrypted stubs — re-save heals the
            // structure when the content itself is still present.
            ignoreEncryption: true,
            throwOnInvalidObject: false,
            updateMetadata: false,
          });
          await yieldToUi();
          results.push(await savePdf(doc, suffixedName(source.name, "-repaired")));
        } catch {
          failures.push(source.name);
        }
      }
      if (results.length === 0) {
        throw new Error(
          `None of the ${failures.length} ${failures.length === 1 ? "file" : "files"} could be recovered — the damage goes beyond the document structure.`,
        );
      }
      return results;
    }, "Repairing documents…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={baseName(queue.files[0]?.name ?? "pdfs")}
          note="Structure rebuilt — open the copy to confirm it reads correctly."
          onReset={() => {
            queue.clear();
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple maxFiles={20} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              Fixes structural damage (broken references, truncated streams). Missing content can&apos;t be conjured back.
            </p>
            <Button
              size="lg"
              disabled={queue.files.length === 0}
              onClick={repair}
            >
              Repair PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
