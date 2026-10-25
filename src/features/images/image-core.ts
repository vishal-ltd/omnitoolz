import type { ResultFile } from "@/lib/utils";

/** Shared browser-canvas image helpers (plan §9: Canvas APIs for local work). */

export const MIME = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type ImageFormat = "jpg" | "png" | "webp";

export function mimeFor(format: ImageFormat): string {
  return MIME[format];
}

/** Map a source extension to an output format that preserves its qualities. */
export function sameFamilyFormat(fileName: string): ImageFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return "jpg";
}

export interface PreparedCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/**
 * Decode a file into a canvas, optionally capping the long edge (downscale).
 * Throws a friendly error for files the browser can't decode.
 */
export async function decodeToCanvas(
  file: File,
  options: { maxLongEdge?: number; background?: string } = {},
): Promise<PreparedCanvas> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`“${file.name}” couldn't be decoded as an image in this browser.`);
  }
  const { width: sw, height: sh } = bitmap;
  let dw = sw;
  let dh = sh;
  if (options.maxLongEdge && Math.max(sw, sh) > options.maxLongEdge) {
    const scale = options.maxLongEdge / Math.max(sw, sh);
    dw = Math.max(1, Math.round(sw * scale));
    dh = Math.max(1, Math.round(sh * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Your browser blocked canvas rendering — try another browser.");
  }
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, dw, dh);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, dw, dh);
  bitmap.close();
  return { canvas, ctx, width: dw, height: dh };
}

/** Encode a canvas to a Blob; quality applies to JPG/WebP only. */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality = 0.9,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeFor(format), quality),
  );
  if (!blob) throw new Error("The browser failed to encode the image. Try a different output format.");
  return blob;
}

export function imageResult(file: File, blob: Blob, format: ImageFormat): ResultFile {
  const dot = file.name.lastIndexOf(".");
  const base = (dot > 0 ? file.name.slice(0, dot) : file.name) || "image";
  return { name: `${base}.${format === "jpg" ? "jpg" : format}`, blob };
}
