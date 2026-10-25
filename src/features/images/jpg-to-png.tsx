"use client";

import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { baseName } from "@/lib/utils";
import { canvasToBlob, decodeToCanvas, imageResult } from "./image-core";

export default function JpgToPngTool() {
  const queue = useFileQueue({ accept: ["jpg", "jpeg"], multiple: true, maxFiles: 20, maxSizeMb: 30 });
  const { state, start, reset } = useJob();

  const ready = queue.files.length >= 1;

  async function convert() {
    const files = queue.files;
    await start(async ({ report }) => {
      const results = [];
      for (const [index, file] of files.entries()) {
        report(`Converting ${file.name} (${index + 1}/${files.length})…`, (index + 0.5) / files.length);
        const { canvas } = await decodeToCanvas(file);
        const blob = await canvasToBlob(canvas, "png");
        results.push(imageResult(file, blob, "png"));
      }
      return results;
    }, "Converting to PNG…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "images")}-png`}
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
            accept={["jpg", "jpeg"]}
            multiple
            maxFiles={20}
            maxSizeMb={30}
            existingCount={queue.files.length}
            onFiles={queue.addFiles}
          />
          <FileList files={queue.files} onRemove={queue.removeAt} thumbnails />

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              PNG conversion is lossless from here on — but JPEG artifacts in the
              source stay visible.
            </p>
            <Button size="lg" disabled={!ready} onClick={convert}>
              Convert to PNG
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
