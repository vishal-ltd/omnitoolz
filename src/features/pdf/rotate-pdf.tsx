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
import { parsePageRanges } from "@/lib/page-ranges";
import { suffixedName } from "@/lib/utils";
import { loadPdf, savePdf } from "./pdf-core";

type Angle = "90" | "180" | "270";

export default function RotatePdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();

  useHandoffFile(queue.addFiles, queue.files.length > 0);
  const [angle, setAngle] = useState<Angle>("90");
  const [pagesInput, setPagesInput] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);

  const file = queue.files[0];

  async function rotate() {
    const source = file!;
    setRangeError(null);
    await start(async ({ report }) => {
      const { degrees } = await import("pdf-lib");
      const doc = await loadPdf(source);
      const pageCount = doc.getPageCount();
      const targets = pagesInput.trim()
        ? parsePageRanges(pagesInput, pageCount)
        : Array.from({ length: pageCount }, (_, i) => i);
      report(`Rotating ${targets.length} ${targets.length === 1 ? "page" : "pages"}…`, 0.7);
      for (const index of targets) {
        const page = doc.getPage(index);
        page.setRotation(degrees((page.getRotation().angle + Number(angle)) % 360));
      }
      return [await savePdf(doc, suffixedName(source.name, `-rotated`))];
    }, "Rotating pages…");
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
            <OptionsPanel title="Rotation">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-ink">Turn pages</span>
                <SegmentedControl
                  ariaLabel="Rotation angle"
                  value={angle}
                  onChange={setAngle}
                  options={[
                    { value: "90", label: "90° clockwise" },
                    { value: "180", label: "180°" },
                    { value: "270", label: "270°" },
                  ]}
                />
              </div>
              <Field
                label="Pages (optional)"
                hint="Leave empty to rotate every page — e.g. 2, 5-7"
                className="sm:col-span-2"
              >
                <TextInput
                  value={pagesInput}
                  onChange={(event) => setPagesInput(event.target.value)}
                  placeholder="All pages"
                  aria-label="Pages to rotate"
                />
              </Field>
              {rangeError && <p className="text-sm text-err sm:col-span-2">{rangeError}</p>}
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Rotation never re-encodes page content — quality is untouched.</p>
            <Button size="lg" disabled={!file} onClick={rotate}>
              Rotate PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
