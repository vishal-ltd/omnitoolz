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
import { Field, Select, TextInput } from "@/components/ui/form";
import { suffixedName } from "@/lib/utils";
import { loadPdf, savePdf } from "./pdf-core";

type Position = "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";
type NumberFormat = "plain" | "n-of-total" | "page-n-of-total";

export default function AddPageNumbersTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();

  useHandoffFile(queue.addFiles, queue.files.length > 0);
  const [position, setPosition] = useState<Position>("bottom-center");
  const [format, setFormat] = useState<NumberFormat>("n-of-total");
  const [startNumber, setStartNumber] = useState(1);
  const [firstPage, setFirstPage] = useState(1);
  const [fontSize, setFontSize] = useState(11);

  const file = queue.files[0];

  async function addNumbers() {
    const source = file!;
    await start(async ({ report }) => {
      const { StandardFonts, rgb } = await import("pdf-lib");
      const doc = await loadPdf(source);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pageCount = doc.getPageCount();

      const first = Math.min(Math.max(1, Math.round(firstPage)), pageCount);
      const numberedPages = pageCount - first + 1;
      if (numberedPages < 1) throw new Error("The first numbered page is beyond the end of the document.");

      report(`Numbering ${numberedPages} ${numberedPages === 1 ? "page" : "pages"}…`, 0.7);
      for (let index = first - 1; index < pageCount; index++) {
        const page = doc.getPage(index);
        const number = startNumber + (index - (first - 1));
        const text =
          format === "plain"
            ? String(number)
            : format === "n-of-total"
              ? `${number} / ${startNumber + numberedPages - 1}`
              : `Page ${number} of ${startNumber + numberedPages - 1}`;

        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const margin = 28;
        const isTop = position.startsWith("top");
        const y = isTop ? height - margin - fontSize : margin;
        const x = position.endsWith("left")
          ? margin
          : position.endsWith("right")
            ? width - margin - textWidth
            : (width - textWidth) / 2;

        page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.25, 0.25, 0.25) });
      }
      return [await savePdf(doc, suffixedName(source.name, "-numbered"))];
    }, "Adding page numbers…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          onReset={() => {
            queue.clear();
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
            <OptionsPanel title="Numbering">
              <Field label="Position">
                <Select value={position} onChange={(event) => setPosition(event.target.value as Position)} aria-label="Number position">
                  <option value="bottom-center">Bottom center</option>
                  <option value="bottom-right">Bottom right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="top-center">Top center</option>
                  <option value="top-right">Top right</option>
                  <option value="top-left">Top left</option>
                </Select>
              </Field>
              <Field label="Format">
                <Select value={format} onChange={(event) => setFormat(event.target.value as NumberFormat)} aria-label="Number format">
                  <option value="plain">1, 2, 3…</option>
                  <option value="n-of-total">1 / 12</option>
                  <option value="page-n-of-total">Page 1 of 12</option>
                </Select>
              </Field>
              <Field label="First numbered page" hint="Use 2 to skip the cover page">
                <TextInput
                  type="number"
                  min={1}
                  value={firstPage}
                  onChange={(event) => setFirstPage(Number(event.target.value) || 1)}
                  aria-label="First numbered page"
                />
              </Field>
              <Field label="Start numbering at" hint="Shown on the first numbered page">
                <TextInput
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(event) => setStartNumber(Number(event.target.value) || 1)}
                  aria-label="Start numbering at"
                />
              </Field>
              <Field label={`Font size — ${fontSize}pt`}>
                <TextInput
                  type="number"
                  min={6}
                  max={36}
                  value={fontSize}
                  onChange={(event) => setFontSize(Math.min(36, Math.max(6, Number(event.target.value) || 11)))}
                  aria-label="Font size"
                />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Numbers are drawn in dark gray so they stay readable without shouting.</p>
            <Button size="lg" disabled={!file} onClick={addNumbers}>
              Add Page Numbers
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
