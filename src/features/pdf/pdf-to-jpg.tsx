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
import { Field, RangeInput, Select, TextInput } from "@/components/ui/form";
import { parsePageRanges } from "@/lib/page-ranges";
import { bytesToBlob, baseName, type ResultFile } from "@/lib/utils";
import { loadPdf, outputBaseName } from "./pdf-core";
import { loadPdfjs } from "./pdfjs";

export default function PdfToJpgTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();

  useHandoffFile(queue.addFiles, queue.files.length > 0);
  const [dpi, setDpi] = useState("150");
  const [quality, setQuality] = useState(85);
  const [pagesInput, setPagesInput] = useState("");

  const file = queue.files[0];

  async function convert() {
    const source = file!;
    const base = outputBaseName(source);
    await start(async ({ report }) => {
      const pdfjs = await loadPdfjs();
      const bytes = await source.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const pageCount = doc.numPages;
      const targets = pagesInput.trim()
        ? parsePageRanges(pagesInput, pageCount)
        : Array.from({ length: pageCount }, (_, i) => i);

      const results: ResultFile[] = [];
      for (const [index, pageIndex] of targets.entries()) {
        report(`Rendering page ${pageIndex + 1} of ${pageCount}…`, (index + 0.4) / targets.length);
        const page = await doc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: Number(dpi) / 72 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Your browser blocked canvas rendering — try another browser.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        page.cleanup();
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality / 100),
        );
        if (!blob) throw new Error(`Rendering page ${pageIndex + 1} failed. Try a lower DPI.`);
        results.push({ name: `${base}-page-${pageIndex + 1}.jpg`, blob });
      }
      await doc.destroy();
      return results;
    }, "Preparing the PDF…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={baseName(file?.name ?? "document")}
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
            <OptionsPanel title="Image settings">
              <Field label="Resolution" hint="96 DPI for screens · 150 balanced · 300 print">
                <Select value={dpi} onChange={(event) => setDpi(event.target.value)} aria-label="Output resolution">
                  <option value="96">96 DPI — screen</option>
                  <option value="150">150 DPI — balanced</option>
                  <option value="300">300 DPI — print</option>
                </Select>
              </Field>
              <Field label={`JPG quality — ${quality}`}>
                <RangeInput value={quality} min={50} max={100} onChange={setQuality} suffix="%" />
              </Field>
              <Field label="Pages (optional)" hint="Leave empty to convert every page — e.g. 1-5" className="sm:col-span-2">
                <TextInput
                  value={pagesInput}
                  onChange={(event) => setPagesInput(event.target.value)}
                  placeholder="All pages"
                  aria-label="Pages to convert"
                />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Multi-page PDFs download as a ZIP of JPG images.</p>
            <Button size="lg" disabled={!file} onClick={convert}>
              Convert to JPG
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
