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
import { loadPdf, savePdf, yieldToUi } from "./pdf-core";

export default function FlattenPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: true, maxFiles: 20, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [bakedTotal, setBakedTotal] = useState<number | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  async function flatten() {
    const sources = queue.files;
    setBakedTotal(null);
    await start(async ({ report }) => {
      const results: ResultFile[] = [];
      let baked = 0;
      for (const [index, source] of sources.entries()) {
        report(`Flattening “${source.name}”…`, (index + 0.5) / sources.length);
        const doc = await loadPdf(source);
        const form = doc.getForm();
        const fields = form.getFields();
        if (fields.length > 0) {
          form.flatten();
          baked += fields.length;
        }
        await yieldToUi();
        results.push(await savePdf(doc, suffixedName(source.name, "-flat")));
      }
      setBakedTotal(baked);
      return results;
    }, "Flattening forms…");
  }

  const note =
    bakedTotal !== null
      ? bakedTotal === 0
        ? "No fillable form fields were found — the copies are clean re-saves."
        : `${bakedTotal} form ${bakedTotal === 1 ? "field" : "fields"} baked into page content.`
      : undefined;

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={baseName(queue.files[0]?.name ?? "pdfs")}
          note={note}
          onReset={() => {
            queue.clear();
            setBakedTotal(null);
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
              Filled answers become permanent page content — perfect before submitting.
            </p>
            <Button
              size="lg"
              disabled={queue.files.length === 0}
              onClick={flatten}
            >
              Flatten Forms
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
