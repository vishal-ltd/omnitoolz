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
import { suffixedName } from "@/lib/utils";
import { loadPdf, savePdf } from "./pdf-core";

export default function ExtractPagesTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();

  useHandoffFile(queue.addFiles, queue.files.length > 0);
  const [pagesInput, setPagesInput] = useState("");

  const file = queue.files[0];
  const valid = Boolean(file) && /^\s*\d+([-\s,]+\d+)*\s*$/.test(pagesInput) && pagesInput.trim().length > 0;

  async function extract() {
    const source = file!;
    await start(async ({ report }) => {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await loadPdf(source);
      const pages = parsePageRanges(pagesInput, doc.getPageCount());
      report(`Extracting ${pages.length} ${pages.length === 1 ? "page" : "pages"}…`, 0.7);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(doc, pages);
      for (const page of copied) out.addPage(page);
      return [await savePdf(out, suffixedName(source.name, "-extracted"))];
    }, "Extracting pages…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          onReset={() => {
            queue.clear();
            setPagesInput("");
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
            <OptionsPanel title="Pages to keep" columns={1}>
              <Field
                label="Page selection"
                hint="Pages appear in the order you list them — e.g. 1-3, 9, 12-14"
              >
                <TextInput
                  value={pagesInput}
                  onChange={(event) => setPagesInput(event.target.value)}
                  placeholder="1-3, 9"
                  aria-label="Pages to extract"
                />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {valid ? "Ready to extract" : "Enter the pages to keep, e.g. 1-3, 9"}
            </p>
            <Button size="lg" disabled={!valid} onClick={extract}>
              Extract Pages
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
