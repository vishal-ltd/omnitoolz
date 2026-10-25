"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, RangeInput, Select } from "@/components/ui/form";
import { baseName, formatBytes } from "@/lib/utils";
import {
  canvasToBlob,
  decodeToCanvas,
  imageResult,
  sameFamilyFormat,
  type ImageFormat,
} from "./image-core";

export default function CompressImageTool() {
  const queue = useFileQueue({ accept: ["jpg", "jpeg", "png", "webp"], multiple: true, maxFiles: 20, maxSizeMb: 30 });
  const { state, start, reset } = useJob();
  const [quality, setQuality] = useState(75);
  const [formatMode, setFormatMode] = useState("smart");
  const [maxEdge, setMaxEdge] = useState("none");

  const ready = queue.files.length >= 1;

  async function compress() {
    const files = queue.files;
    await start(async ({ report }) => {
      const results = [];
      for (const [index, file] of files.entries()) {
        report(`Compressing ${file.name} (${index + 1}/${files.length})…`, (index + 0.5) / files.length);
        const format: ImageFormat =
          formatMode === "smart" ? (sameFamilyFormat(file.name) === "png" ? "webp" : "jpg") : (formatMode as ImageFormat);
        const { canvas } = await decodeToCanvas(file, {
          maxLongEdge: maxEdge === "none" ? undefined : Number(maxEdge),
        });
        const blob = await canvasToBlob(canvas, format, quality / 100);
        results.push(imageResult(file, blob, format));
      }
      return results;
    }, "Compressing images…");
  }

  const files = queue.files;
  const originalTotal = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(files[0]?.name ?? "images")}-compressed`}
          note={savingsNote(state.results, originalTotal)}
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
          />
          <FileList files={queue.files} onRemove={queue.removeAt} thumbnails />

          {ready && (
            <OptionsPanel title="Compression">
              <Field label={`Quality — ${quality}`} hint="75 is a strong default for photos">
                <RangeInput value={quality} min={10} max={100} onChange={setQuality} suffix="%" />
              </Field>
              <Field label="Output format" hint="Smart: JPG for photos, WebP for PNGs">
                <Select value={formatMode} onChange={(event) => setFormatMode(event.target.value)} aria-label="Output format">
                  <option value="smart">Smart (recommended)</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WebP</option>
                </Select>
              </Field>
              <Field label="Max dimension" hint="Downscales large photos — big savings on camera images" className="sm:col-span-2">
                <Select value={maxEdge} onChange={(event) => setMaxEdge(event.target.value)} aria-label="Maximum dimension">
                  <option value="none">Keep original size</option>
                  <option value="3840">Cap at 4K (3840px)</option>
                  <option value="2560">Cap at 2560px</option>
                  <option value="1920">Cap at 1920px</option>
                  <option value="1280">Cap at 1280px</option>
                </Select>
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {files.length > 0
                ? `${files.length} ${files.length === 1 ? "image" : "images"} · ${formatBytes(originalTotal)} total`
                : "Add images to compress"}
            </p>
            <Button size="lg" disabled={!ready} onClick={compress}>
              Compress {files.length > 1 ? `${files.length} Images` : "Image"}
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}

function savingsNote(results: Array<{ blob: Blob }>, originalTotal: number): string | undefined {
  if (originalTotal <= 0) return undefined;
  const outputTotal = results.reduce((sum, file) => sum + file.blob.size, 0);
  const saved = Math.round((1 - outputTotal / originalTotal) * 100);
  return saved > 0
    ? `Saved ${saved}% — ${formatBytes(originalTotal - outputTotal)} smaller than the originals.`
    : "Output wasn't smaller than the original — try a lower quality or a WebP target.";
}
