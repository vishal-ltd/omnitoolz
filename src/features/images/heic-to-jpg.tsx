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

type LibheifModule = {
  HeifDecoder: new () => {
    decode(buffer: ArrayBuffer): Array<{
      get_width(): number;
      get_height(): number;
      display(target: { width: number; height: number }, done: (result: unknown) => void): void;
      free(): void;
    }>;
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
  })();
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
  const images = decoder.decode(buffer);
  if (images.length === 0) throw new Error(`“${file.name}” has no decodable HEIC image inside.`);

  const results: ResultFile[] = [];
  for (const [index, image] of images.entries()) {
    onImage(index, images.length);
    const width = image.get_width();
    const height = image.get_height();
    const imageData = new ImageData(width, height);
    await new Promise<void>((resolve, reject) => {
      image.display(imageData, (result) => (result ? resolve() : reject(new Error("HEIC decoding failed — the file may use an unsupported profile."))));
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.putImageData(imageData, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality / 100));
    if (!blob) throw new Error("Converting to JPG failed.");
    results.push({ name: `${baseName(file.name)}${images.length > 1 ? `-${index + 1}` : ""}.jpg`, blob });
    image.free();
  }
  return results;
}

export default function HeicToJpgTool() {
  const queue = useFileQueue({ accept: ["heic", "heif"], multiple: true, maxFiles: 10, maxSizeMb: 50 });
  const { state, start, reset } = useJob();
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
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {queue.files.length > 0 && (
            <OptionsPanel title="JPG quality">
              <Field label={`Quality — ${quality}`}>
                <RangeInput value={quality} min={50} max={100} onChange={setQuality} suffix="%" />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

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
