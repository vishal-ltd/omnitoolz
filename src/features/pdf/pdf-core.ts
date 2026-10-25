import { baseName, bytesToBlob, type ResultFile } from "@/lib/utils";
import type { PDFDocument } from "pdf-lib";

/** Shared browser-side PDF helpers built on pdf-lib. */

export async function readFileBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Load a PDF with friendly errors for encrypted or damaged files. */
export async function loadPdf(file: File): Promise<PDFDocument> {
  const { PDFDocument } = await import("pdf-lib");
  try {
    return await PDFDocument.load(await readFileBytes(file), {
      ignoreEncryption: false,
      updateMetadata: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt/i.test(message)) {
      throw new Error(
        `“${file.name}” is password-protected. Unlock it first — protected PDFs aren't supported yet.`,
      );
    }
    throw new Error(
      `“${file.name}” couldn't be read as a PDF. The file may be damaged or not a PDF at all.`,
    );
  }
}

export async function savePdf(doc: PDFDocument, name: string): Promise<ResultFile> {
  const bytes = await doc.save({ useObjectStreams: true });
  return { name, blob: bytesToBlob(bytes, "application/pdf") };
}

export function outputBaseName(file: File): string {
  return baseName(file.name) || "document";
}

/** Yield to the browser between heavy steps so the UI stays responsive. */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
