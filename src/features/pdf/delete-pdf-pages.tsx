"use client";

import Link from "next/link";

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

export default function DeletePdfPagesTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [pagesInput, setPagesInput] = useState("");

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  async function removePages() {
    const source = file!;
    await start(async ({ report }) => {
      const doc = await loadPdf(source);
      const pageCount = doc.getPageCount();
      const targets = parsePageRanges(pagesInput, pageCount);
      if (targets.length >= pageCount) {
        throw new Error("That would delete every page — a PDF needs at least one.");
      }
      report(`Removing ${targets.length} ${targets.length === 1 ? "page" : "pages"}…`, 0.7);
      // Remove from the back so earlier indices stay valid.
      for (const index of [...targets].sort((a, b) => b - a)) {
        doc.removePage(index);
      }
      return [await savePdf(doc, suffixedName(source.name, "-edited"))];
    }, "Deleting pages…");
  }

  const valid = file && pagesInput.trim().length > 0;

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
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {file && (
            <OptionsPanel title="Pages to delete">
              <Field
                label="Page numbers"
                hint={`This document has ${file ? "some" : ""} pages — e.g. 2, 5-7`}
                className="sm:col-span-2"
              >
                <TextInput
                  value={pagesInput}
                  onChange={(event) => setPagesInput(event.target.value)}
                  placeholder="e.g. 1, 4-6"
                  aria-label="Pages to delete"
                />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              Want to see the pages first? Use <Link className="underline" href="/pdf-tools/organize-pdf">Organize PDF Pages</Link>.
            </p>
            <Button size="lg" disabled={!valid} onClick={removePages}>
              Delete Pages
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
