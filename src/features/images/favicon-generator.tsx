"use client";

import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { buildIco } from "@/lib/ico";
import { bytesToBlob, type ResultFile } from "@/lib/utils";

const PNG_SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512] as const;
const ICO_SIZES = [16, 32, 48] as const;

async function renderSquare(source: File | Blob, size: number): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  // Center-crop to a square, then scale — favicons must be square.
  const edge = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    (bitmap.width - edge) / 2,
    (bitmap.height - edge) / 2,
    edge,
    edge,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error(`Rendering the ${size}px favicon failed.`);
  return blob;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export default function FaviconGeneratorTool() {
  const queue = useFileQueue({ accept: ["png", "jpg", "jpeg", "webp"], multiple: false, maxFiles: 1, maxSizeMb: 30 });
  const { state, start, reset } = useJob();

  useHandoffFile(queue.addFiles, queue.files.length > 0);
  const file = queue.files[0];

  async function generate() {
    const source = file!;
    await start(async ({ report }) => {
      const results: ResultFile[] = [];
      const icoPngs: Array<{ size: number; png: Uint8Array }> = [];

      for (const [index, size] of PNG_SIZES.entries()) {
        report(`Rendering ${size}×${size}…`, (index + 0.3) / PNG_SIZES.length);
        const blob = await renderSquare(source, size);
        if (!blob) throw new Error(`Rendering ${size}px failed.`);
        if ((ICO_SIZES as readonly number[]).includes(size)) {
          icoPngs.push({ size, png: await blobBytes(blob) });
        }
        results.push({ name: `favicon-${size}x${size}.png`, blob });
      }

      report("Packing favicon.ico…", 0.9);
      const ico = buildIco(icoPngs);
      results.push({ name: "favicon.ico", blob: bytesToBlob(ico, "image/x-icon") });

      // A ready-to-paste HTML snippet helps more than any single file.
      const html = [
        '<link rel="icon" href="/favicon.ico" sizes="any" />',
        ...PNG_SIZES.filter((s) => s !== 48).map((s) => `<link rel="icon" href="/favicon-${s}x${s}.png" sizes="${s}x${s}" type="image/png" />`),
        '<link rel="apple-touch-icon" href="/favicon-180x180.png" />',
      ].join("\n");
      results.push({
        name: "favicon-html.txt",
        blob: bytesToBlob(new TextEncoder().encode(html), "text/plain;charset=utf-8"),
      });

      return results;
    }, "Rendering sizes…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName="favicon-pack"
          note="Square center-cropped — the .ico packs 16/32/48, the HTML snippet wires everything up."
          onReset={() => {
            queue.clear();
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["png", "jpg", "jpeg", "webp"]} multiple={false} maxFiles={1} maxSizeMb={30} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              Nine PNG sizes + a real multi-resolution .ico + copy-paste HTML — all locally.
            </p>
            <Button size="lg" disabled={!file} onClick={generate}>
              Generate Favicon Pack
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
