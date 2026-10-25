/** Small shared helpers used across tools and UI. */

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Strip the extension from a file name ("report.pdf" → "report"). */
export function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Replace the extension of a file name. */
export function withExtension(name: string, ext: string): string {
  return `${baseName(name)}.${ext.replace(/^\./, "")}`;
}

/** Append a suffix before the extension ("a.pdf", "-merged") → "a-merged.pdf". */
export function suffixedName(name: string, suffix: string): string {
  return `${baseName(name)}${suffix}.${extensionOf(name) || "bin"}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Copy engine bytes into a standalone ArrayBuffer-backed Blob. Some libraries
 * return Uint8Array views whose buffer may be larger than the data; copying
 * guarantees a valid, exactly-sized BlobPart.
 */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

/** A single processed output produced by a tool run. */
export interface ResultFile {
  name: string;
  blob: Blob;
  /** Image results get a lightweight preview in the result list. */
  previewUrl?: string;
}

export function isImageBlob(blob: Blob): boolean {
  return blob.type.startsWith("image/");
}
