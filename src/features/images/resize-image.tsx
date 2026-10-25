"use client";

import { useEffect, useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, RangeInput, Select, TextInput } from "@/components/ui/form";
import { baseName } from "@/lib/utils";
import {
  canvasToBlob,
  decodeToCanvas,
  imageResult,
  sameFamilyFormat,
  type ImageFormat,
} from "./image-core";

type ResizeMode = "percent" | "exact";

export default function ResizeImageTool() {
  const queue = useFileQueue({ accept: ["jpg", "jpeg", "png", "webp"], multiple: true, maxFiles: 10, maxSizeMb: 30 });
  const { state, start, reset } = useJob();
  const [mode, setMode] = useState<ResizeMode>("percent");
  const [percent, setPercent] = useState(50);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [lockAspect, setLockAspect] = useState(true);
  const [formatMode, setFormatMode] = useState("keep");

  // Track the first image's aspect ratio for the lock.
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    const first = queue.files[0];
    if (!first) return;
    createImageBitmap(first)
      .then((bitmap) => {
        setAspect(bitmap.width / bitmap.height);
        setWidth(bitmap.width);
        setHeight(bitmap.height);
        bitmap.close();
      })
      .catch(() => undefined);
  }, [queue.files]);

  const ready = queue.files.length >= 1;

  async function resize() {
    const files = queue.files;
    await start(async ({ report }) => {
      const results = [];
      for (const [index, file] of files.entries()) {
        report(`Resizing ${file.name} (${index + 1}/${files.length})…`, (index + 0.5) / files.length);
        const source = await decodeToCanvas(file);
        let targetWidth: number;
        let targetHeight: number;
        if (mode === "percent") {
          targetWidth = Math.max(1, Math.round((source.width * percent) / 100));
          targetHeight = Math.max(1, Math.round((source.height * percent) / 100));
        } else {
          targetWidth = Math.max(1, Math.round(width));
          targetHeight = Math.max(1, Math.round(height));
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Your browser blocked canvas rendering — try another browser.");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(source.canvas, 0, 0, targetWidth, targetHeight);

        const format: ImageFormat = formatMode === "keep" ? sameFamilyFormat(file.name) : (formatMode as ImageFormat);
        const blob = await canvasToBlob(canvas, format, 0.92);
        results.push(imageResult(file, blob, format));
      }
      return results;
    }, "Resizing images…");
  }

  function onWidthChange(value: number) {
    setWidth(value);
    if (lockAspect) setHeight(Math.max(1, Math.round(value / aspect)));
  }

  function onHeightChange(value: number) {
    setHeight(value);
    if (lockAspect) setWidth(Math.max(1, Math.round(value * aspect)));
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "images")}-resized`}
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
            maxFiles={10}
            maxSizeMb={30}
            existingCount={queue.files.length}
            onFiles={queue.addFiles}
          />
          <FileList files={queue.files} onRemove={queue.removeAt} thumbnails />

          {ready && (
            <OptionsPanel title="New size">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-ink">Resize by</span>
                <div className="inline-flex flex-wrap rounded-xl border border-line bg-canvas p-1">
                  {(
                    [
                      { value: "percent", label: "Percentage" },
                      { value: "exact", label: "Exact pixels" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={mode === option.value}
                      onClick={() => setMode(option.value)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        mode === option.value ? "bg-card text-brand shadow-card" : "text-ink-soft hover:text-ink"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "percent" ? (
                <Field label={`Scale — ${percent}%`} hint="Relative to each image's own dimensions" className="sm:col-span-2">
                  <RangeInput value={percent} min={5} max={200} onChange={setPercent} suffix="%" />
                </Field>
              ) : (
                <>
                  <Field label="Width" hint={lockAspect ? "Height follows the aspect lock" : undefined}>
                    <TextInput
                      type="number"
                      min={1}
                      value={width}
                      onChange={(event) => onWidthChange(Number(event.target.value) || 1)}
                      aria-label="Target width"
                    />
                  </Field>
                  <Field label="Height">
                    <TextInput
                      type="number"
                      min={1}
                      value={height}
                      onChange={(event) => onHeightChange(Number(event.target.value) || 1)}
                      aria-label="Target height"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Checkbox label="Lock aspect ratio (from the first image)" checked={lockAspect} onChange={setLockAspect} />
                  </div>
                </>
              )}

              <Field label="Output format" className="sm:col-span-2">
                <Select value={formatMode} onChange={(event) => setFormatMode(event.target.value)} aria-label="Output format">
                  <option value="keep">Keep original format</option>
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WebP</option>
                </Select>
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {mode === "percent"
                ? `Each image becomes ${percent}% of its original size`
                : `All images resize to ${width} × ${height}px`}
            </p>
            <Button size="lg" disabled={!ready} onClick={resize}>
              Resize {queue.files.length > 1 ? `${queue.files.length} Images` : "Image"}
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
