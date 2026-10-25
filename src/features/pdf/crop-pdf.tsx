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
import { Field, RangeInput, SegmentedControl } from "@/components/ui/form";
import { clamp, suffixedName } from "@/lib/utils";
import { loadPdf, savePdf } from "./pdf-core";
import { findInkBounds } from "./page-analysis";
import { loadPdfjs } from "./pdfjs";

type Mode = "auto" | "manual";
const MM_TO_PT = 72 / 25.4;

export default function CropPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [mode, setMode] = useState<Mode>("auto");
  const [marginMm, setMarginMm] = useState(5);
  const [trimCapMm, setTrimCapMm] = useState(30);
  const [cropNote, setCropNote] = useState<string | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  async function crop() {
    const source = file!;
    setCropNote(null);
    await start(async ({ report }) => {
      const doc = await loadPdf(source);
      const pages = doc.getPages();

      if (mode === "manual") {
        const inset = marginMm * MM_TO_PT;
        report(`Cropping ${pages.length} ${pages.length === 1 ? "page" : "pages"}…`, 0.8);
        for (const page of pages) {
          const { width, height } = page.getSize();
          const left = clamp(inset, 0, width / 2 - 1);
          const bottom = clamp(inset, 0, height / 2 - 1);
          page.setCropBox(left, bottom, Math.max(left + 1, width - left), Math.max(bottom + 1, height - bottom));
        }
        setCropNote(`Every page cropped by ${marginMm} mm on all sides.`);
      } else {
        // Auto: render each page small, find the ink bounding box, set the
        // crop window to that box (padded) — never enlarged, never over-trimmed.
        const pdfjs = await loadPdfjs();
        const bytes = new Uint8Array(await source.arrayBuffer());
        const rendered = await pdfjs.getDocument({ data: bytes }).promise;
        const pad = 4;
        const maxTrim = trimCapMm * MM_TO_PT;
        let adjusted = 0;

        for (let index = 0; index < pages.length; index++) {
          report(`Measuring page ${index + 1} of ${pages.length}…`, ((index + 1) / pages.length) * 0.9);
          const pdfPage = await rendered.getPage(index + 1);
          const base = pdfPage.getViewport({ scale: 1 });
          const viewport = pdfPage.getViewport({ scale: 140 / base.width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Your browser blocked canvas rendering — try another browser.");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          await pdfPage.render({ canvasContext: context, viewport }).promise;
          pdfPage.cleanup();
          const bounds = findInkBounds(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
            canvas.width,
            canvas.height,
          );
          if (!bounds) continue; // blank page — leave its box alone

          // Ink box in PDF coordinates (canvas y grows downward).
          const scale = base.width / canvas.width;
          const inkX0 = bounds.left * scale - pad;
          const inkY0 = base.height - bounds.bottom * scale - pad;
          const inkX1 = bounds.right * scale + pad;
          const inkY1 = base.height - bounds.top * scale + pad;

          const page = pages[index];
          const media = page.getMediaBox();
          const mediaLeft = media.x;
          const mediaBottom = media.y;
          const mediaRight = media.x + media.width;
          const mediaTop = media.y + media.height;
          // Window rules: stay inside the media box, keep at least 10pt
          // visible, and never trim more than the cap on a single side.
          const left = Math.max(
            Math.min(clamp(inkX0, mediaLeft, mediaRight - 10), mediaLeft + maxTrim),
            mediaLeft,
          );
          const bottom = Math.max(
            Math.min(clamp(inkY0, mediaBottom, mediaTop - 10), mediaBottom + maxTrim),
            mediaBottom,
          );
          const right = Math.min(
            Math.max(clamp(inkX1, left + 10, mediaRight), mediaRight - maxTrim),
            mediaRight,
          );
          const top = Math.min(
            Math.max(clamp(inkY1, bottom + 10, mediaTop), mediaTop - maxTrim),
            mediaTop,
          );
          if (media.width - (right - left) < 0.5 && media.height - (top - bottom) < 0.5) continue;

          page.setCropBox(left, bottom, right, top);
          adjusted++;
        }
        await rendered.destroy();
        setCropNote(
          adjusted === 0
            ? "No white space worth trimming was found — the file is unchanged apart from a clean re-save."
            : `${adjusted} of ${pages.length} ${pages.length === 1 ? "page" : "pages"} trimmed to their content.`,
        );
      }

      return [await savePdf(doc, suffixedName(source.name, "-cropped"))];
    }, "Cropping pages…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          note={cropNote ?? undefined}
          onReset={() => {
            queue.clear();
            setCropNote(null);
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
            <OptionsPanel title="Crop mode">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <SegmentedControl
                  ariaLabel="Crop mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "auto", label: "Auto-trim white space" },
                    { value: "manual", label: "Manual margins" },
                  ]}
                />
              </div>
              {mode === "manual" ? (
                <Field label={`Margin — ${marginMm} mm on every side`}>
                  <RangeInput value={marginMm} min={0} max={50} onChange={setMarginMm} suffix="mm" />
                </Field>
              ) : (
                <Field label={`Safety cap — at most ${trimCapMm} mm per side`} hint="Protects pages with a small logo in the corner">
                  <RangeInput value={trimCapMm} min={5} max={80} onChange={setTrimCapMm} suffix="mm" />
                </Field>
              )}
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Cropping only changes the visible window — content is never deleted.</p>
            <Button size="lg" disabled={!file} onClick={crop}>
              Crop PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
