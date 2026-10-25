"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { baseName } from "@/lib/utils";
import { loadPdf, readFileBytes, savePdf } from "./pdf-core";

const PAPER: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export default function JpgToPdfTool() {
  const queue = useFileQueue({ accept: ["jpg", "jpeg", "png", "webp"], multiple: true, maxFiles: 30, maxSizeMb: 30 });
  const { state, start, reset } = useJob();
  const [pageSize, setPageSize] = useState("auto");
  const [margin, setMargin] = useState("36");

  const ready = queue.files.length >= 1;

  async function create() {
    const files = queue.files;
    const base = baseName(files[0].name) || "images";
    await start(async ({ report }) => {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();

      for (const [index, file] of files.entries()) {
        report(`Placing ${file.name} (${index + 1}/${files.length})…`, (index + 0.5) / files.length);
        let embedded;
        const nameLower = file.name.toLowerCase();
        const bytes = await readFileBytes(file);
        if (nameLower.endsWith(".jpg") || nameLower.endsWith(".jpeg")) {
          embedded = await doc.embedJpg(bytes);
        } else if (nameLower.endsWith(".png")) {
          embedded = await doc.embedPng(bytes);
        } else {
          // WebP (and anything else canvas can decode) → PNG bytes.
          embedded = await doc.embedPng(await reencodeToPng(file));
        }

        if (pageSize === "auto") {
          const page = doc.addPage([embedded.width, embedded.height]);
          page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
        } else {
          const [short, long] = PAPER[pageSize];
          const landscape = embedded.width > embedded.height;
          const pw = landscape ? long : short;
          const ph = landscape ? short : long;
          const page = doc.addPage([pw, ph]);
          const m = Number(margin);
          const scale = Math.min((pw - 2 * m) / embedded.width, (ph - 2 * m) / embedded.height);
          const dw = embedded.width * scale;
          const dh = embedded.height * scale;
          page.drawImage(embedded, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
        }
      }

      report("Writing the PDF…", 1);
      return [await savePdf(doc, `${base}.pdf`)];
    }, "Creating the PDF…");
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
          <FileDropZone
            accept={["jpg", "jpeg", "png", "webp"]}
            multiple
            maxFiles={30}
            maxSizeMb={30}
            existingCount={queue.files.length}
            onFiles={queue.addFiles}
            hint="JPG, PNG and WebP — one image per page, reorder freely."
          />
          <FileList files={queue.files} onRemove={queue.removeAt} onMove={queue.move} thumbnails />

          {ready && (
            <OptionsPanel title="Page layout">
              <Field label="Page size" hint="Automatic matches each image exactly">
                <Select value={pageSize} onChange={(event) => setPageSize(event.target.value)} aria-label="Page size">
                  <option value="auto">Automatic — fit to image</option>
                  <option value="a4">A4</option>
                  <option value="letter">US Letter</option>
                </Select>
              </Field>
              <Field label="Margin" hint={pageSize === "auto" ? "Used only with paper sizes" : undefined}>
                <Select
                  value={margin}
                  onChange={(event) => setMargin(event.target.value)}
                  disabled={pageSize === "auto"}
                  aria-label="Page margin"
                >
                  <option value="0">None</option>
                  <option value="36">Normal (½ inch)</option>
                  <option value="72">Wide (1 inch)</option>
                </Select>
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {queue.files.length > 0 ? `${queue.files.length} ${queue.files.length === 1 ? "image" : "images"} ready` : "Add images to build a PDF"}
            </p>
            <Button size="lg" disabled={!ready} onClick={create}>
              Create PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}

/** Decode any browser-supported image and re-encode it as PNG bytes. */
async function reencodeToPng(file: File): Promise<Uint8Array> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error(`“${file.name}” couldn't be decoded as an image.`);
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    throw new Error(`“${file.name}” couldn't be decoded as an image.`);
  }
}
