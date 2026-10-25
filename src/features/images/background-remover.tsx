"use client";

import { useState } from "react";
import { Brush } from "lucide-react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { baseName, type ResultFile } from "@/lib/utils";
import { BgTouchUp } from "./bg-touchup";

export default function BackgroundRemoverTool() {
  const queue = useFileQueue({ accept: ["png", "jpg", "jpeg", "webp"], multiple: true, maxFiles: 5, maxSizeMb: 20 });
  const { state, start, reset } = useJob();
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  async function remove() {
    const sources = queue.files;
    setProgressLabel(null);
    await start(async ({ report }) => {
      report("Loading the AI model (first run downloads it once)…", 0.05);
      const { removeBackground } = await import("@imgly/background-removal");
      const results: ResultFile[] = [];
      for (const [index, source] of sources.entries()) {
        const blob = await removeBackground(source, {
          progress: (key, current, total) => {
            const label = key.split("/").pop() ?? key;
            setProgressLabel(`${label} ${Math.round((current / total) * 100)}%`);
          },
          output: { format: "image/png" },
        });
        results.push({ name: `${baseName(source.name)}-cutout.png`, blob });
        report(`Isolated “${source.name}”…`, (index + 1) / sources.length);
      }
      return results;
    }, "Starting the model…");
  }

  function applyEdit(blob: Blob) {
    if (editingIndex === null) return;
    setResultsBlob(editingIndex, blob);
    setEditingIndex(null);
  }

  function setResultsBlob(index: number, blob: Blob) {
    // Results state lives in useJob; patch it via reset-with-values is not
    // exposed, so keep a local overlay that Results accepts through state.
    setOverlay((current) => ({ ...current, [index]: blob }));
  }

  const [overlay, setOverlay] = useState<Record<number, Blob>>({});

  const displayedResults: ResultFile[] =
    state.phase === "done"
      ? state.results.map((result, index) =>
          overlay[index] ? { ...result, blob: overlay[index] } : result,
        )
      : state.results;

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <div className="space-y-4">
          {editingIndex !== null && queue.files[editingIndex] && displayedResults[editingIndex] && (
            <BgTouchUp
              originalFile={queue.files[editingIndex]}
              cutoutBlob={displayedResults[editingIndex].blob}
              fileName={displayedResults[editingIndex].name}
              onDone={applyEdit}
              onCancel={() => setEditingIndex(null)}
            />
          )}
          <Results
            results={displayedResults}
            elapsedMs={state.elapsedMs}
            zipBaseName={`${baseName(queue.files[0]?.name ?? "cutouts")}-cutouts`}
            note={
              editingIndex === null
                ? "Backgrounds removed — transparent PNGs, subject intact. Need fixes? Touch up below."
                : undefined
            }
            onReset={() => {
              queue.clear();
              setProgressLabel(null);
              setOverlay({});
              reset();
            }}
          />
          {editingIndex === null && displayedResults.length > 0 && queue.files.length === displayedResults.length && (
            <div className="flex flex-wrap gap-2">
              {displayedResults.map((_, index) => (
                <Button key={index} variant="secondary" size="sm" onClick={() => setEditingIndex(index)}>
                  <Brush className="size-4" aria-hidden />
                  Touch up #{index + 1}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["png", "jpg", "jpeg", "webp"]} multiple maxFiles={5} maxSizeMb={20} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {progressLabel
                ? `Model: ${progressLabel}`
                : "An AI segmentation model (≈40 MB) downloads once from a CDN, then everything runs on your device."}
            </p>
            <Button size="lg" disabled={queue.files.length === 0} onClick={remove}>
              Remove Background
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
