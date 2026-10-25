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
import { Field, SegmentedControl } from "@/components/ui/form";
import { suffixedName } from "@/lib/utils";
import { loadPdf, savePdf } from "./pdf-core";
import { inkRatio, isBlankPage, type BlankSensitivity } from "./page-analysis";
import { loadPdfjs } from "./pdfjs";

export default function RemoveBlankPagesTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [sensitivity, setSensitivity] = useState<BlankSensitivity>("normal");
  const [removedNote, setRemovedNote] = useState<string | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  async function remove() {
    const source = file!;
    setRemovedNote(null);
    await start(async ({ report }) => {
      const pdfjs = await loadPdfjs();
      const bytes = new Uint8Array(await source.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const pageCount = doc.numPages;

      const keep: number[] = [];
      const removed: number[] = [];
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        report(`Checking page ${pageNumber} of ${pageCount}…`, (pageNumber / pageCount) * 0.8);
        const page = await doc.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 120 / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Your browser blocked canvas rendering — try another browser.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        page.cleanup();
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const ratio = inkRatio(data, canvas.width, canvas.height);
        if (isBlankPage(ratio, sensitivity)) removed.push(pageNumber);
        else keep.push(pageNumber - 1);
      }
      await doc.destroy();

      if (keep.length === 0) {
        throw new Error("Every page looks blank — nothing would be left. Nothing was changed.");
      }
      if (keep.length === pageCount) {
        throw new Error("No blank pages found — this document is already tight.");
      }

      report("Building the cleaned PDF…", 0.95);
      const { PDFDocument } = await import("pdf-lib");
      const out = await loadPdf(source);
      const fresh = await PDFDocument.create();
      const copied = await fresh.copyPages(out, keep);
      for (const page of copied) fresh.addPage(page);
      const out2 = fresh;

      setRemovedNote(
        `Removed ${removed.length} blank ${removed.length === 1 ? "page" : "pages"} (${removed.join(", ")}).`,
      );
      return [await savePdf(out2, suffixedName(source.name, "-trimmed"))];
    }, "Scanning pages…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          note={removedNote ?? undefined}
          onReset={() => {
            queue.clear();
            setRemovedNote(null);
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {file && (
            <OptionsPanel title="Detection">
              <Field label="Sensitivity" hint="Normal = essentially pure white. Aggressive also catches faint marks." className="sm:col-span-2">
                <SegmentedControl
                  ariaLabel="Blank detection sensitivity"
                  value={sensitivity}
                  onChange={setSensitivity}
                  options={[
                    { value: "normal", label: "Normal" },
                    { value: "aggressive", label: "Aggressive" },
                  ]}
                />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Every page is rendered and checked for ink — locally.</p>
            <Button size="lg" disabled={!file} onClick={remove}>
              Remove Blank Pages
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
