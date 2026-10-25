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
import { Field, SegmentedControl, TextInput } from "@/components/ui/form";
import { PageRangeError, computeSplitGroups, type SplitMode } from "@/lib/page-ranges";
import { baseName } from "@/lib/utils";
import { loadPdf, outputBaseName, savePdf } from "./pdf-core";

export default function SplitPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();

  useHandoffFile(queue.addFiles, queue.files.length > 0);
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [spec, setSpec] = useState("");
  const [specError, setSpecError] = useState<string | null>(null);

  const file = queue.files[0];

  function validateSpec(): { ok: true } | { ok: false; error: string } {
    if (mode === "single") return { ok: true };
    if (!file) return { ok: true };
    try {
      if (mode === "chunks") {
        if (!/^\d+$/.test(spec.trim())) throw new PageRangeError("Enter a chunk size, e.g. 4.");
        computeSplitGroups("chunks", spec, 1000);
      } else {
        computeSplitGroups("ranges", spec, 1000);
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Check the split settings." };
    }
  }

  async function split() {
    const validation = validateSpec();
    if (!validation.ok) {
      setSpecError(validation.error);
      return;
    }
    setSpecError(null);
    const source = file!;
    await start(async ({ report }) => {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await loadPdf(source);
      const pageCount = doc.getPageCount();
      const groups = computeSplitGroups(mode, spec, pageCount);
      const results = [];
      for (const [index, group] of groups.entries()) {
        report(`Building ${group.label} (${index + 1}/${groups.length})…`, (index + 0.5) / groups.length);
        const out = await PDFDocument.create();
        const copied = await out.copyPages(doc, group.pages);
        for (const page of copied) out.addPage(page);
        results.push(await savePdf(out, `${outputBaseName(source)}-${group.label}.pdf`));
      }
      return results;
    }, "Splitting the PDF…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(file?.name ?? "document")}-split`}
          onReset={() => {
            queue.clear();
            setSpec("");
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {file && (
            <OptionsPanel title="Split settings">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-ink">Split mode</span>
                <SegmentedControl
                  ariaLabel="Split mode"
                  value={mode}
                  onChange={(next) => {
                    setMode(next);
                    setSpecError(null);
                  }}
                  options={[
                    { value: "ranges", label: "Custom ranges" },
                    { value: "chunks", label: "Fixed chunks" },
                    { value: "single", label: "One file per page" },
                  ]}
                />
              </div>
              {mode === "ranges" && (
                <Field label="Ranges" hint="One output file per item — e.g. 1-3, 4-8, 9" className="sm:col-span-2">
                  <TextInput
                    value={spec}
                    onChange={(event) => setSpec(event.target.value)}
                    placeholder="1-3, 4-8"
                    inputMode="text"
                    aria-label="Page ranges"
                  />
                </Field>
              )}
              {mode === "chunks" && (
                <Field label="Pages per file" hint="Split into equal chunks of this many pages" className="sm:col-span-2">
                  <TextInput
                    value={spec}
                    onChange={(event) => setSpec(event.target.value)}
                    placeholder="4"
                    inputMode="numeric"
                    aria-label="Pages per file"
                  />
                </Field>
              )}
              {specError && <p className="text-sm text-err sm:col-span-2">{specError}</p>}
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {mode === "single"
                ? "Every page becomes its own PDF"
                : "Multiple outputs download together as a ZIP"}
            </p>
            <Button size="lg" disabled={!file} onClick={split}>
              Split PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
