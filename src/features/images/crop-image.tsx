"use client";

import { useEffect, useRef, useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form";
import { clamp, suffixedName } from "@/lib/utils";
import {
  canvasToBlob,
  decodeToCanvas,
  imageResult,
  sameFamilyFormat,
} from "./image-core";

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PRESETS: Array<{ label: string; aspect: number | null }> = [
  { label: "Full image", aspect: null },
  { label: "Square 1:1", aspect: 1 },
  { label: "Wide 16:9", aspect: 16 / 9 },
  { label: "Classic 4:3", aspect: 4 / 3 },
  { label: "Photo 3:2", aspect: 3 / 2 },
];

export default function CropImageTool() {
  const queue = useFileQueue({ accept: ["jpg", "jpeg", "png", "webp"], multiple: false, maxFiles: 1, maxSizeMb: 30 });
  const { state, start, reset } = useJob();
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const file = queue.files[0];
  const bitmapRef = useRef<ImageBitmap | null>(null);

  // Decode once per file; keep the bitmap around for cheap preview redraws.
  // The stored bitmap is closed only when replaced or on unmount — closing it
  // sooner would make drawImage throw InvalidStateError.
  useEffect(() => {
    if (!file) {
      setImageSize(null);
      setCrop(null);
      setBitmap((previous) => {
        previous?.close();
        return null;
      });
      return;
    }
    let cancelled = false;
    createImageBitmap(file)
      .then((decoded) => {
        if (cancelled) {
          decoded.close();
          return;
        }
        setImageSize({ width: decoded.width, height: decoded.height });
        setCrop({ x: 0, y: 0, w: decoded.width, h: decoded.height });
        setBitmap((previous) => {
          previous?.close();
          return decoded;
        });
      })
      .catch(() => setImageSize(null));
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    bitmapRef.current = bitmap;
  }, [bitmap]);

  useEffect(() => {
    return () => bitmapRef.current?.close();
  }, []);

  // Redraw the preview whenever the bitmap or the crop rectangle changes.
  useEffect(() => {
    if (!bitmap || !crop) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const maxW = 640;
    const maxH = 360;
    const scale = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // Dim everything outside the crop, then frame the crop itself.
    ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
    const cx = crop.x * scale;
    const cy = crop.y * scale;
    const cw = crop.w * scale;
    const ch = crop.h * scale;
    ctx.fillRect(0, 0, canvas.width, cy);
    ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch);
    ctx.fillRect(0, cy, cx, ch);
    ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch);
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 1, cy + 1, cw - 2, ch - 2);
  }, [bitmap, crop]);

  function applyPreset(aspect: number | null) {
    if (!imageSize) return;
    if (aspect === null) {
      setCrop({ x: 0, y: 0, w: imageSize.width, h: imageSize.height });
      return;
    }
    let w = imageSize.width;
    let h = Math.round(w / aspect);
    if (h > imageSize.height) {
      h = imageSize.height;
      w = Math.round(h * aspect);
    }
    setCrop({
      x: Math.round((imageSize.width - w) / 2),
      y: Math.round((imageSize.height - h) / 2),
      w,
      h,
    });
  }

  function updateCrop(key: keyof CropRect, value: number) {
    if (!imageSize || !crop) return;
    const next = { ...crop, [key]: Math.max(1, Math.round(value) || 0) };
    next.x = clamp(next.x, 0, imageSize.width - 1);
    next.y = clamp(next.y, 0, imageSize.height - 1);
    next.w = clamp(next.w, 1, imageSize.width - next.x);
    next.h = clamp(next.h, 1, imageSize.height - next.y);
    setCrop(next);
  }

  async function cropAndDownload() {
    const source = file!;
    const rect = crop!;
    await start(async ({ report }) => {
      report("Cropping…", 0.6);
      const prepared = await decodeToCanvas(source);
      const canvas = document.createElement("canvas");
      canvas.width = rect.w;
      canvas.height = rect.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser blocked canvas rendering — try another browser.");
      ctx.drawImage(prepared.canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      const format = sameFamilyFormat(source.name);
      const blob = await canvasToBlob(canvas, format, 0.92);
      return [imageResult({ ...source, name: suffixedName(source.name, "-cropped") }, blob, format)];
    }, "Cropping the image…");
  }

  const cropValid =
    Boolean(file && imageSize && crop) &&
    crop!.w >= 8 &&
    crop!.h >= 8 &&
    (crop!.w < imageSize!.width || crop!.h < imageSize!.height);

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
          <FileDropZone accept={["jpg", "jpeg", "png", "webp"]} multiple={false} maxFiles={1} maxSizeMb={30} onFiles={queue.addFiles} />

          {file && imageSize && crop && (
            <>
              <div className="overflow-hidden border-[3px] border-edge bg-canvas shadow-[4px_4px_0_0_var(--color-shadow)]">
                <canvas ref={previewRef} className="block w-full" aria-label="Crop preview" />
              </div>

              <OptionsPanel title="Crop area" columns={2}>
                {(
                  [
                    { key: "x" as const, label: "Left" },
                    { key: "y" as const, label: "Top" },
                    { key: "w" as const, label: "Width" },
                    { key: "h" as const, label: "Height" },
                  ]
                ).map((field) => (
                  <Field key={field.key} label={field.label} hint="pixels">
                    <TextInput
                      type="number"
                      min={1}
                      value={crop[field.key]}
                      onChange={(event) => updateCrop(field.key, Number(event.target.value))}
                      aria-label={`Crop ${field.label}`}
                    />
                  </Field>
                ))}
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  {PRESETS.map((preset) => (
                    <Button key={preset.label} variant="secondary" size="sm" onClick={() => applyPreset(preset.aspect)}>
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </OptionsPanel>
            </>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {file
                ? imageSize
                  ? `Image is ${imageSize.width} × ${imageSize.height}px — crop is ${crop?.w} × ${crop?.h}px`
                  : "Decoding the image…"
                : "Add an image to crop"}
            </p>
            <Button size="lg" disabled={!cropValid} onClick={cropAndDownload}>
              Crop & Download
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
