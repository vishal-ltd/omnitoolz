"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { baseName, bytesToBlob, formatBytes, type ResultFile } from "@/lib/utils";

type QpdfFactory = (options?: {
  locateFile?: (file: string) => string;
  noInitialRun?: boolean;
}) => Promise<QpdfInstance>;

interface QpdfInstance {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
  callMain(args: string[]): number;
}

declare global {
  interface Window {
    /** The emscripten MODULARIZE factory from /qpdf/qpdf.js (`var Module`). */
    Module?: QpdfFactory;
  }
}

let gluePromise: Promise<QpdfFactory> | null = null;

/** Load the qpdf CLI build once (script-tag style; wasm fetched alongside). */
async function loadQpdf(): Promise<QpdfFactory> {
  gluePromise ??= (async () => {
    if (!window.Module) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/qpdf/qpdf.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("The compression engine couldn't load."));
        document.head.appendChild(script);
      });
    }
    if (!window.Module) throw new Error("The compression engine didn't initialise.");
    return window.Module;
  })().catch((error: unknown) => {
    // Never cache a rejection: "Try again" must be able to reload the engine.
    gluePromise = null;
    throw error;
  });
  return gluePromise;
}

async function compressBytes(bytes: Uint8Array, linearize: boolean): Promise<Uint8Array> {
  const make = await loadQpdf();
  const qpdf = await make({
    locateFile: (file) => `/qpdf/${file}`,
    noInitialRun: true,
  });
  qpdf.FS.writeFile("/in.pdf", bytes);
  const args = [
    "--compress-streams=y",
    "--object-streams=generate",
    "--recompress-flate=y",
    ...(linearize ? ["--linearize"] : []),
    "/in.pdf",
    "/out.pdf",
  ];
  // With noExitRuntime the glue RETURNS the exit code instead of throwing;
  // a non-zero exit means /out.pdf is absent or truncated — never ship it.
  const code = qpdf.callMain(args);
  if (code !== 0) throw new Error(`The compression engine failed on this file (exit ${code}).`);
  const out = qpdf.FS.readFile("/out.pdf");
  const copy = new Uint8Array(out.length);
  copy.set(out);
  return copy;
}

export default function CompressPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: true, maxFiles: 10, maxSizeMb: 100 });
  const { state, start, reset, retry } = useJob();
  const [linearize, setLinearize] = useState(false);
  const [savingsNote, setSavingsNote] = useState<string | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  async function compress() {
    const sources = queue.files;
    setSavingsNote(null);
    await start(async ({ report }) => {
      report("Loading the compression engine (≈1.3 MB, once)…", 0.05);
      const results: ResultFile[] = [];
      const skipped: string[] = [];
      const failed: string[] = [];
      let saved = 0;
      let compressedCount = 0;

      for (const [index, source] of sources.entries()) {
        report(`Compressing “${source.name}”…`, (index + 0.4) / sources.length);
        const original = new Uint8Array(await source.arrayBuffer());
        let compressed: Uint8Array | null = null;
        try {
          compressed = await compressBytes(original, linearize);
        } catch {
          // Engine failure (odd structure, corrupt input) — keep the original
          // and say so, rather than pretending it was "already optimal".
          failed.push(source.name);
        }
        if (compressed && compressed.length < original.length) {
          saved += original.length - compressed.length;
          compressedCount++;
          results.push({ name: suffixed(source.name), blob: bytesToBlob(compressed, "application/pdf") });
        } else {
          // No savings (or engine failure, already tracked in `failed`).
          if (compressed) skipped.push(source.name);
          results.push({ name: source.name, blob: bytesToBlob(original, "application/pdf") });
        }
      }

      const failureNote =
        failed.length > 0
          ? ` ${failed.length} file(s) the engine couldn't process were returned unchanged.`
          : "";
      if (compressedCount > 0) {
        setSavingsNote(
          `Saved ${formatBytes(saved)} across ${compressedCount} of ${results.length} file(s)` +
            (skipped.length > 0 ? ` — ${skipped.length} already optimal and passed through unchanged.` : ".") +
            failureNote,
        );
      } else if (failed.length === results.length) {
        setSavingsNote(
          "The compression engine couldn't process these files — they were returned unchanged.",
        );
      } else {
        setSavingsNote(
          "These PDFs were already optimally packed — nothing to squeeze, files returned unchanged." + failureNote,
        );
      }
      return results;
    }, "Starting compression…");
  }

  function suffixed(name: string): string {
    const dot = name.lastIndexOf(".");
    return `${dot > 0 ? name.slice(0, dot) : name}-compressed.pdf`;
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "pdfs")}-compressed`}
          note={savingsNote ?? undefined}
          onReset={() => {
            queue.clear();
            setSavingsNote(null);
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple maxFiles={10} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} onUndo={queue.undoRemove} undoLabel={queue.lastRemoved} />

          {queue.files.length > 0 && (
            <OptionsPanel title="Options">
              <div className="sm:col-span-2">
                <Checkbox
                  checked={linearize}
                  onChange={setLinearize}
                  label="Linearize (fast web view — reorganizes for page-by-page loading)"
                />
              </div>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError error={state.error} detail={state.errorDetail} kind={state.errorKind} onRetry={retry} onDismiss={reset} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              Lossless structural compression via a qpdf WebAssembly build — content is never re-encoded or degraded.
            </p>
            <Button size="lg" disabled={queue.files.length === 0} onClick={compress}>
              Compress PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
