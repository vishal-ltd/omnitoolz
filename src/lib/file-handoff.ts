/**
 * In-memory handoff of a single file from the PDF viewer to another tool.
 * The state lives in this module, so it survives client-side navigation in
 * the App Router (no serialization, no storage). One file, one use.
 */

let pendingFile: File | null = null;

export function setPendingFile(file: File): void {
  pendingFile = file;
}

export function takePendingFile(): File | null {
  const file = pendingFile;
  pendingFile = null;
  return file;
}
