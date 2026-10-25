"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, RangeInput } from "@/components/ui/form";
import { baseName } from "@/lib/utils";
import { canvasToBlob, decodeToCanvas, imageResult } from "./image-core";

export default function PngToJpgTool() {
  const queue = useFileQueue({ accept: ["png"], multiple: true, maxFiles: 20, maxSizeMb: 30 });
  const { state, start, reset } = useJob();
  const [quality, setQuality] = useState(90);
  const [background, setBackground] = useState("#ffffff");

  const ready = queue.files.length >= 1;

  async function convert() {
    const files = queue.files;
    await start(async ({ report }) => {
      const results = [];
      for (const [index, file] of files.entries()) {
        report(`Converting ${file.name} (${index + 1}/${files.length})…`, (index + 0.5) / files.length);
        const { canvas } = await decodeToCanvas(file, { background });
        const blob = await canvasToBlob(canvas, "jpg", quality / 100);
        results.push(imageResult(file, blob, "jpg"));
      }
      return results;
    }, "Converting to JPG…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "images")}-jpg`}
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
            accept={["png"]}
            multiple
            maxFiles={20}
            maxSizeMb={30}
            existingCount={queue.files.length}
            onFiles={queue.addFiles}
          />
          <FileList files={queue.files} onRemove={queue.removeAt} thumbnails />

          {ready && (
            <OptionsPanel title="JPG settings">
              <Field label={`Quality — ${quality}`}>
                <RangeInput value={quality} min={50} max={100} onChange={setQuality} suffix="%" />
              </Field>
              <Field label="Background color" hint="JPG has no transparency — transparent areas become this color">
                <input
                  type="color"
                  value={background}
                  onChange={(event) => setBackground(event.target.value)}
                  className="h-11 w-full cursor-pointer border-[3px] border-edge bg-card p-1 shadow-[3px_3px_0_0_var(--color-shadow)]"
                  aria-label="Background color for transparency"
                />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Transparent areas are filled with the background color.</p>
            <Button size="lg" disabled={!ready} onClick={convert}>
              Convert to JPG
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
