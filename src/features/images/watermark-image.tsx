"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, RangeInput, Select, TextInput } from "@/components/ui/form";
import { baseName } from "@/lib/utils";
import { canvasToBlob, decodeToCanvas, imageResult, sameFamilyFormat, type ImageFormat } from "./image-core";

type Anchor = "top-left" | "top-center" | "top-right" | "middle-left" | "middle-center" | "middle-right" | "bottom-left" | "bottom-center" | "bottom-right";

const ANCHORS: Array<{ value: Anchor; label: string }> = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "middle-left", label: "Middle left" },
  { value: "middle-center", label: "Center" },
  { value: "middle-right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
];

export default function WatermarkImageTool() {
  const queue = useFileQueue({ accept: ["jpg", "jpeg", "png", "webp"], multiple: true, maxFiles: 20, maxSizeMb: 30 });
  const { state, start, reset } = useJob();
  const [text, setText] = useState("© Your Name");
  const [anchor, setAnchor] = useState<Anchor>("bottom-right");
  const [sizePct, setSizePct] = useState(4);
  const [opacity, setOpacity] = useState(55);
  const [color, setColor] = useState("#ffffff");

  const ready = queue.files.length >= 1 && text.trim().length > 0;

  async function watermark() {
    const files = queue.files;
    const watermarkText = text.trim();
    await start(async ({ report }) => {
      const results = [];
      for (const [index, file] of files.entries()) {
        report(`Watermarking ${file.name} (${index + 1}/${files.length})…`, (index + 0.5) / files.length);
        const { canvas, ctx, width, height } = await decodeToCanvas(file);
        const fontSize = Math.max(10, (sizePct / 100) * width);
        const padding = fontSize * 0.7;

        ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity / 100;

        const vertical = anchor.startsWith("top") ? "top" : anchor.startsWith("middle") ? "middle" : "bottom";
        const horizontal = anchor.endsWith("left") ? "left" : anchor.endsWith("center") ? "center" : "right";

        let x: number;
        if (horizontal === "left") {
          ctx.textAlign = "left";
          x = padding;
        } else if (horizontal === "center") {
          ctx.textAlign = "center";
          x = width / 2;
        } else {
          ctx.textAlign = "right";
          x = width - padding;
        }

        let y: number;
        if (vertical === "top") {
          ctx.textBaseline = "top";
          y = padding;
        } else if (vertical === "middle") {
          ctx.textBaseline = "middle";
          y = height / 2;
        } else {
          ctx.textBaseline = "bottom";
          y = height - padding;
        }

        ctx.fillText(watermarkText, x, y);
        ctx.globalAlpha = 1;

        const format: ImageFormat = sameFamilyFormat(file.name);
        const blob = await canvasToBlob(canvas, format, 0.92);
        results.push(imageResult(file, blob, format));
      }
      return results;
    }, "Adding watermarks…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "images")}-watermarked`}
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

          {queue.files.length > 0 && (
            <OptionsPanel title="Watermark">
              <Field label="Text" hint="Kept in the original format — PNG transparency survives" className="sm:col-span-2">
                <TextInput
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="© Your Name"
                  aria-label="Watermark text"
                />
              </Field>
              <Field label="Position">
                <Select value={anchor} onChange={(event) => setAnchor(event.target.value as Anchor)} aria-label="Watermark position">
                  {ANCHORS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Text color">
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-11 w-full cursor-pointer border-[3px] border-edge bg-card p-1 shadow-[3px_3px_0_0_var(--color-shadow)]"
                  aria-label="Watermark color"
                />
              </Field>
              <Field label={`Size — ${sizePct}% of image width`}>
                <RangeInput value={sizePct} min={1} max={10} onChange={setSizePct} suffix="%" />
              </Field>
              <Field label={`Opacity — ${opacity}%`}>
                <RangeInput value={opacity} min={10} max={100} onChange={setOpacity} suffix="%" />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">The watermark scales with each image, so batches stay consistent.</p>
            <Button size="lg" disabled={!ready} onClick={watermark}>
              Add Watermark
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
