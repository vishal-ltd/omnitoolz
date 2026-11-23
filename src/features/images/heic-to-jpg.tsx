"use client";

import { useEffect, useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, RangeInput } from "@/components/ui/form";
import { baseName, downloadBlob, type ResultFile } from "@/lib/utils";
import { checkCanvasSize } from "./image-core";

interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(target: { width: number; height: number }, done: (result: unknown) => void): void;
  free(): void;
}

type LibheifModule = {
  HeifDecoder: new () => {
    decode(buffer: ArrayBuffer): HeifImage[];
  };
};

declare global {
  interface Window {
    libheif?: (options?: { locateFile?: (file: string) => string }) => Promise<LibheifModule>;
  }
}

let gluePromise: Promise<LibheifModule> | null = null;

/** Load the self-contained libheif build once (script-tag style, no bundler). */
async function loadLibheif(): Promise<LibheifModule> {
  gluePromise ??= (async () => {
    if (!window.libheif) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/libheif/libheif.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("The HEIC engine couldn't load."));
        document.head.appendChild(script);
      });
    }
    if (!window.libheif) throw new Error("The HEIC engine didn't initialise.");
    return window.libheif();
  })().catch((error: unknown) => {
    // Never cache a failure — the retry button must be able to load again.
    gluePromise = null;
    throw error;
  });
  return gluePromise;
}

async function decodeHeicToBlobs(
  file: File,
  quality: number,
  onImage: (index: number, total: number) => void,
): Promise<ResultFile[]> {
  const libheif = await loadLibheif();
  const buffer = await file.arrayBuffer();
  const decoder = new libheif.HeifDecoder();
  let images: HeifImage[];
  try {
    images = decoder.decode(buffer);
  } catch {
    throw new Error(`“${file.name}” couldn't be decoded as HEIC — it may be corrupt or use an unsupported profile.`);
  }
  if (images.length === 0) throw new Error(`“${file.name}” has no decodable HEIC image inside.`);

  const results: ResultFile[] = [];
  let failedIndex = -1;
  try {
    for (const [index, image] of images.entries()) {
      failedIndex = index;
      try {
        onImage(index, images.length);
        const width = image.get_width();
        const height = image.get_height();
        if (width < 1 || height < 1) throw new Error(`“${file.name}” contains an image with invalid dimensions.`);
        checkCanvasSize(width, height);
        const imageData = new ImageData(width, height);
        await new Promise<void>((resolve, reject) => {
          image.display(imageData, (result) => (result ? resolve() : reject(new Error("HEIC decoding failed — the file may use an unsupported profile."))));
        });
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Your browser blocked canvas rendering — try another browser.");
        ctx.putImageData(imageData, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality / 100));
        if (!blob) throw new Error("Converting to JPG failed.");
        results.push({ name: `${baseName(file.name)}${images.length > 1 ? `-${index + 1}` : ""}.jpg`, blob });
      } finally {
        image.free();
      }
    }
  } catch (error) {
    // Free the WASM memory of images we never reached before rethrowing.
    for (let j = failedIndex + 1; j < images.length; j++) images[j].free();
    throw error;
  }
  return results;
}

export default function HeicToJpgTool() {
  const queue = useFileQueue({ accept: ["heic", "heif"], multiple: true, maxFiles: 10, maxSizeMb: 50 });
  const { state, start, reset, retry } = useJob();
  const [quality, setQuality] = useState(90);
  const [status, setStatus] = useState<string | null>(null);

  async function convert() {
    const sources = queue.files;
    setStatus(null);
    await start(async ({ report }) => {
      const results: ResultFile[] = [];
      for (const [fileIndex, source] of sources.entries()) {
        report(`Decoding “${source.name}”…`, (fileIndex + 0.3) / sources.length);
        const decoded = await decodeHeicToBlobs(source, quality, (index, total) => {
          report(`“${source.name}” — image ${index + 1} of ${total}…`, (fileIndex + 0.5) / sources.length);
        });
        results.push(...decoded);
      }
      return results;
    }, "Loading the HEIC engine…");
  }

  // Preview the first result inline for quick eyeballing.
  useEffect(() => {
    if (state.phase !== "done" || state.results.length === 0) return;
    const url = URL.createObjectURL(state.results[0].blob);
    const img = new Image();
    img.onload = () => {
      setStatus(`${img.naturalWidth} × ${img.naturalHeight} px`);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [state]);

  const single = queue.files.length === 1 && state.results.length === 1;

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <div className="space-y-4">
          <Results
            results={state.results}
            elapsedMs={state.elapsedMs}
            zipBaseName={`${baseName(queue.files[0]?.name ?? "heic")}-jpg`}
            note={status ? `Decoded at ${status} — quality ${quality}.` : undefined}
            onReset={() => {
              queue.clear();
              setStatus(null);
              reset();
            }}
          />
          {!single && state.results.length > 1 && (
            <Button variant="secondary" onClick={() => downloadBlob(state.results[0].blob, state.results[0].name)}>
              Download first as JPG
            </Button>
          )}
        </div>
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["heic", "heif"]} multiple maxFiles={10} maxSizeMb={50} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} onUndo={queue.undoRemove} undoLabel={queue.lastRemoved} />

          {queue.files.length > 0 && (
            <OptionsPanel title="JPG quality">
              <Field label={`Quality — ${quality}`}>
                <RangeInput value={quality} min={50} max={100} onChange={setQuality} suffix="%" />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError error={state.error} detail={state.errorDetail} kind={state.errorKind} onRetry={retry} onDismiss={reset} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              Decoding runs locally via a WebAssembly HEIF engine (loaded once, ≈3 MB). iPhone photos welcome.
            </p>
            <Button size="lg" disabled={queue.files.length === 0} onClick={convert}>
              Convert to JPG
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
