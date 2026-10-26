"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, RangeInput, SegmentedControl, Select, TextInput } from "@/components/ui/form";
import { baseName, formatBytes, type ResultFile } from "@/lib/utils";
import {
  findQualityForTarget,
  findScaleForTarget,
  parseTargetSize,
} from "@/lib/target-size";
import {
  canvasToBlob,
  decodeToCanvas,
  imageResult,
  sameFamilyFormat,
  type ImageFormat,
} from "./image-core";

type Mode = "balanced" | "target";

const TARGET_PRESETS = [50, 100, 200, 500, 1024] as const; // KB

export default function CompressImageTool() {
  const queue = useFileQueue({ accept: ["jpg", "jpeg", "png", "webp"], multiple: true, maxFiles: 20, maxSizeMb: 30 });
  const { state, start, reset } = useJob();
  const [mode, setMode] = useState<Mode>("balanced");
  const [quality, setQuality] = useState(75);
  const [formatMode, setFormatMode] = useState("smart");
  const [maxEdge, setMaxEdge] = useState("none");
  const [targetInput, setTargetInput] = useState("100");
  const [targetBytes, setTargetBytes] = useState(100 * 1024);
  const [perFileStatus, setPerFileStatus] = useState<string | null>(null);
  const [lastNotes, setLastNotes] = useState<string | null>(null);

  const ready = queue.files.length >= 1;
  const targetInvalid = mode === "target" && parseTargetSize(targetInput) === null;

  function applyPreset(kb: number) {
    setTargetInput(String(kb));
    setTargetBytes(kb * 1024);
  }

  async function compress() {
    const files = queue.files;
    const searching = mode === "target";
    await start(async ({ report }) => {
      const results: ResultFile[] = [];
      const notes: string[] = [];
      for (const [index, file] of files.entries()) {
        report(`Compressing ${file.name} (${index + 1}/${files.length})…`, (index + 0.5) / files.length);
        const format: ImageFormat =
          formatMode === "smart" ? (sameFamilyFormat(file.name) === "png" ? "webp" : "jpg") : (formatMode as ImageFormat);

        if (!searching) {
          const { canvas } = await decodeToCanvas(file, {
            maxLongEdge: maxEdge === "none" ? undefined : Number(maxEdge),
          });
          const blob = await canvasToBlob(canvas, format, quality / 100);
          results.push(imageResult(file, blob, format));
          continue;
        }

        // Target-size mode: binary-search quality, then dimensions if needed.
        const base = await decodeToCanvas(file, {
          maxLongEdge: maxEdge === "none" ? undefined : Number(maxEdge),
        });
        const encodeAt = async (q: number, scale = 1): Promise<number> => {
          let canvas = base.canvas;
          if (scale < 1) {
            const scaled = document.createElement("canvas");
            scaled.width = Math.max(1, Math.round(canvas.width * scale));
            scaled.height = Math.max(1, Math.round(canvas.height * scale));
            scaled.getContext("2d")!.drawImage(canvas, 0, 0, scaled.width, scaled.height);
            canvas = scaled;
          }
          const blob = await canvasToBlob(canvas, format, q / 100);
          return blob.size;
        };

        const scaled = await findScaleForTarget(encodeAt, targetBytes, {
          startScale: 1,
          minScale: 0.15,
          scaleStep: 0.2,
        });

        let canvas = base.canvas;
        let finalScale = 1;
        if (scaled) {
          finalScale = scaled.scale;
          if (finalScale < 1) {
            const reduced = document.createElement("canvas");
            reduced.width = Math.max(1, Math.round(base.canvas.width * finalScale));
            reduced.height = Math.max(1, Math.round(base.canvas.height * finalScale));
            reduced.getContext("2d")!.drawImage(base.canvas, 0, 0, reduced.width, reduced.height);
            canvas = reduced;
          }
        }

        const blob = await canvasToBlob(canvas, format, (scaled?.search.quality ?? 20) / 100);
        results.push(imageResult(file, blob, format));
        const dims = `${canvas.width}×${canvas.height}`;
        const scaledNote = finalScale < 1 ? `, ${Math.round(finalScale * 100)}% size, ${dims}` : "";
        notes.push(
          scaled?.search.hit
            ? `${file.name}: ${formatBytes(file.size)} → ${formatBytes(blob.size)} ✓ (quality ${scaled.search.quality}${scaledNote})`
            : `${file.name}: closest is ${formatBytes(blob.size)} — ${formatBytes(targetBytes)} wasn't reachable (${scaledNote || dims}).`,
        );
        setPerFileStatus(notes[notes.length - 1]);
      }
      setPerFileStatus(null);
      setLastNotes(notes.length > 0 ? notes.join("  ·  ") : null);
      return results;
    }, searching ? "Searching for the best quality…" : "Compressing images…");
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
          note={lastNotes ?? savingsNote(state.results, originalTotal)}
          onReset={() => {
            queue.clear();
            setLastNotes(null);
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <div className="space-y-4">
          <JobProgress state={state} />
          {perFileStatus && (
            <p className="border-[3px] border-edge bg-card p-3 font-body text-lg text-ink-soft shadow-[3px_3px_0_0_var(--color-shadow)]">
              {perFileStatus}
            </p>
          )}
        </div>
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
              <div className="sm:col-span-2">
                <SegmentedControl
                  ariaLabel="Compression mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "balanced", label: "Balanced quality" },
                    { value: "target", label: "Target file size" },
                  ]}
                />
              </div>

              {mode === "balanced" ? (
                <>
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
                </>
              ) : (
                <>
                  <Field label="Target size per image" hint="Each file gets its own quality search" className="sm:col-span-2">
                    <TextInput
                      value={targetInput}
                      onChange={(event) => {
                        setTargetInput(event.target.value);
                        const parsed = parseTargetSize(event.target.value);
                        if (parsed) setTargetBytes(parsed);
                      }}
                      inputMode="decimal"
                      placeholder="e.g. 100kb or 1.5mb"
                      aria-label="Target file size"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    {TARGET_PRESETS.map((kb) => (
                      <button
                        key={kb}
                        type="button"
                        onClick={() => applyPreset(kb)}
                        className={`border-[3px] border-edge px-3 py-1.5 font-display text-[9px] uppercase shadow-[2px_2px_0_0_var(--color-shadow)] transition-colors ${
                          targetBytes === kb * 1024 ? "bg-brand text-on-brand" : "bg-card text-ink-soft"
                        }`}
                      >
                        {kb >= 1024 ? "1 MB" : `${kb} KB`}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-ink-soft sm:col-span-2">
                    Output is JPG (WebP for transparent PNGs). If the target is impossible even at
                    minimum quality, you get the closest possible file — clearly labeled.
                  </p>
                </>
              )}
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {files.length > 0
                ? `${files.length} ${files.length === 1 ? "image" : "images"} · ${formatBytes(originalTotal)} total`
                : "Add images to compress"}
            </p>
            <Button size="lg" disabled={!ready || targetInvalid} onClick={compress}>
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
