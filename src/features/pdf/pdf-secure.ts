import type { PDFDocument } from "@cantoo/pdf-lib";
import { readFileBytes } from "./pdf-core";
import { loadPdfjs } from "./pdfjs";

/**
 * Password support via @cantoo/pdf-lib (a drop-in pdf-lib fork that adds
 * AES-256 encryption) plus pdf.js for reliable password verification.
 * Dynamically imported so only these two tools pay for the extra engine.
 */

export async function loadPdfForEncryption(file: File): Promise<PDFDocument> {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  try {
    return await PDFDocument.load(await readFileBytes(file), {
      ignoreEncryption: false,
      updateMetadata: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt/i.test(message)) {
      throw new Error(
        `“${file.name}” already has a password. Unlock it first, then protect it again.`,
      );
    }
    throw new Error(
      `“${file.name}” couldn't be read as a PDF. The file may be damaged or not a PDF at all.`,
    );
  }
}

export interface ProtectOptions {
  userPassword: string;
  ownerPassword: string;
  allowPrinting: boolean;
  allowCopying: boolean;
  allowModifying: boolean;
}

export async function encryptAndSave(
  doc: PDFDocument,
  options: ProtectOptions,
): Promise<Uint8Array> {
  doc.encrypt({
    userPassword: options.userPassword,
    ownerPassword: options.ownerPassword || options.userPassword,
    permissions: {
      printing: options.allowPrinting ? "highResolution" : undefined,
      copying: options.allowCopying || undefined,
      modifying: options.allowModifying || undefined,
      annotating: options.allowModifying || undefined,
      fillingForms: true,
    },
  });
  return doc.save({ useObjectStreams: true });
}

export interface UnlockOutcome {
  bytes: Uint8Array;
  /** True when the file had no password and was simply re-saved cleanly. */
  wasUnprotected: boolean;
}

export async function decryptAndSave(file: File, password: string): Promise<UnlockOutcome> {
  const bytes = await readFileBytes(file);

  // Verify with pdf.js first — it implements the standard security handler
  // strictly and rejects wrong passwords where the pdf-lib fork would
  // happily parse garbage.
  const pdfjs = await loadPdfjs();

  // Does the file even need a password?
  let wasUnprotected = false;
  try {
    const bare = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    await bare.destroy();
    wasUnprotected = true;
  } catch (error) {
    if (!(error instanceof Error && error.name === "PasswordException")) throw error;
  }

  let reportedPages: number;
  try {
    const probe = await pdfjs
      .getDocument({ data: bytes.slice(), password: password || undefined })
      .promise;
    reportedPages = probe.numPages;
    await probe.destroy();
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException") {
      throw new Error(
        "That password didn't work. Check for typos — capitalization matters.",
      );
    }
    throw error;
  }

  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const doc = await PDFDocument.load(bytes, {
    password: password || undefined,
    updateMetadata: false,
  });
  if (doc.getPageCount() !== reportedPages) {
    throw new Error(
      "The password didn't decrypt this document cleanly. Double-check it and try again.",
    );
  }
  const saved = await doc.save({ useObjectStreams: true });
  return { bytes: saved, wasUnprotected };
}

