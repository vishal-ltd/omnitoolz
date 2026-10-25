"use client";

import { useEffect, useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, RangeInput, Select } from "@/components/ui/form";
import { baseName, extensionOf } from "@/lib/utils";
import { canvasToBlob, decodeToCanvas, imageResult, type ImageFormat } from "./image-core";

export default function WebPConverterTool() {
  const queue = useFileQueue({ accept: ["jpg", "jpeg", "png", "webp"], multiple: true, maxFiles: 20, maxSizeMb: 30 });
  const { state, start, reset } = useJob();
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState(80);

  // Default direction: WebP inputs → JPG out; everything else → WebP out.
  useEffect(() => {
    const first = queue.files[0];
    if (!first) return;
    if (extensionOf(first.name) === "webp" && format === "webp") setFormat("jpg");
    if (extensionOf(first.name) !== "webp" && format === "jpg") setFormat("webp");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.files]);

  const ready = queue.files.length >= 1;

  async function convert() {
    const files = queue.files;
    const target = format;
    await start(async ({ report }) => {
      const results = [];
      for (const [index, file] of files.entries()) {
        report(`Converting ${file.name} (${index + 1}/${files.length})…`, (index + 0.5) / files.length);
        const background = target === "jpg" ? "#ffffff" : undefined;
        const { canvas } = await decodeToCanvas(file, { background });
        const blob = await canvasToBlob(canvas, target, quality / 100);
        results.push(imageResult(file, blob, target));
      }
      return results;
    }, "Converting images…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "images")}-converted`}
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
            maxFiles={20}
            maxSizeMb={30}
            existingCount={queue.files.length}
            onFiles={queue.addFiles}
            hint="Convert to WebP for smaller files, or from WebP to classic formats."
          />
          <FileList files={queue.files} onRemove={queue.removeAt} thumbnails />

          {ready && (
            <OptionsPanel title="Conversion">
              <Field label="Output format" hint={format === "webp" ? "WebP typically shrinks photos 25-35%" : "Classic formats for older apps"}>
                <Select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ImageFormat)}
                  aria-label="Output format"
                >
                  <option value="webp">To WebP</option>
                  <option value="jpg">To JPG</option>
                  <option value="png">To PNG</option>
                </Select>
              </Field>
              <Field label={`Quality — ${quality}`} hint={format === "png" ? "PNG is lossless — quality doesn't apply" : undefined}>
                <RangeInput value={quality} min={50} max={100} onChange={setQuality} suffix="%" disabled={format === "png"} />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Batches download together as a ZIP.</p>
            <Button size="lg" disabled={!ready} onClick={convert}>
              Convert
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
