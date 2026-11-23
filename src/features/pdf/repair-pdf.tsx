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
import { baseName, suffixedName, type ResultFile } from "@/lib/utils";
import { readFileBytes, savePdf, yieldToUi } from "./pdf-core";

export default function RepairPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: true, maxFiles: 20, maxSizeMb: 100 });
  const { state, start, reset, retry } = useJob();
  const [repairNote, setRepairNote] = useState<string | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  async function repair() {
    const sources = queue.files;
    setRepairNote(null);
    await start(async ({ report }) => {
      const { PDFDocument } = await import("pdf-lib");
      const results: ResultFile[] = [];
      const failures: string[] = [];
      const encrypted: string[] = [];
      for (const [index, source] of sources.entries()) {
        report(`Rebuilding “${source.name}”…`, (index + 0.5) / sources.length);
        try {
          const bytes = await readFileBytes(source);
          const doc = await PDFDocument.load(bytes, {
            // Tolerate broken objects — re-save heals the structure when the
            // content itself is still present.
            ignoreEncryption: true,
            throwOnInvalidObject: false,
            updateMetadata: false,
          });
          // Encrypted strings repacked into object streams come out garbage
          // (object streams are never encrypted) — refuse instead of corrupting.
          if (doc.isEncrypted) {
            encrypted.push(source.name);
            continue;
          }
          await yieldToUi();
          results.push(await savePdf(doc, suffixedName(source.name, "-repaired")));
        } catch {
          failures.push(source.name);
        }
      }
      if (results.length === 0) {
        throw new Error(
          encrypted.length > 0
            ? `These files are password-protected — unlock them first, then repair: ${encrypted.join(", ")}.`
            : `None of the ${failures.length} ${failures.length === 1 ? "file" : "files"} could be recovered — the damage goes beyond the document structure.`,
        );
      }
      setRepairNote(
        "Structure rebuilt — open the copy to confirm it reads correctly." +
          (failures.length > 0 ? ` Not repaired: ${failures.join(", ")}.` : "") +
          (encrypted.length > 0 ? ` Password-protected, unlock first: ${encrypted.join(", ")}.` : ""),
      );
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
          note={repairNote ?? "Structure rebuilt — open the copy to confirm it reads correctly."}
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
          <FileList files={queue.files} onRemove={queue.removeAt} onUndo={queue.undoRemove} undoLabel={queue.lastRemoved} />

          {state.phase === "error" && <JobError error={state.error} detail={state.errorDetail} kind={state.errorKind} onRetry={retry} onDismiss={reset} />}

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
