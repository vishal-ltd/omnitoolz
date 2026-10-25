import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfjs } from "./pdfjs";

/** Page preview rendering shared by the organizer grid and the viewer. */

export interface RenderedPage {
  pageNumber: number;
  dataUrl: string;
  /** Aspect ratio (height / width) of the rendered page. */
  aspect: number;
}

interface ThumbnailOptions {
  targetWidth?: number;
  maxPages?: number;
  onPage: (page: RenderedPage) => void;
  signal?: AbortSignal;
}

/**
 * Render pages to JPEG data URLs at a small target width. Pages are emitted
 * one by one so callers can show a filling grid instead of a frozen bar.
 */
export async function renderPageThumbnails(
  file: File,
  options: ThumbnailOptions,
): Promise<{ pageCount: number; rendered: number }> {
  const { targetWidth = 170, maxPages = Infinity, onPage, signal } = options;
  const pdfjs = await loadPdfjs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const pageCount = doc.numPages;
  const limit = Math.min(pageCount, maxPages);

  for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
    if (signal?.aborted) break;
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = targetWidth / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser blocked canvas rendering — try another browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    page.cleanup();
    onPage({
      pageNumber,
      dataUrl: canvas.toDataURL("image/jpeg", 0.72),
      aspect: viewport.height / viewport.width,
    });
  }
  await doc.destroy();
  return { pageCount, rendered: limit };
}

/** Render one page of an open document into `canvas` at the given CSS width. */
export async function paintPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = (cssWidth * (window.devicePixelRatio || 1)) / base.width;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.aspectRatio = `${base.width} / ${base.height}`;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Your browser blocked canvas rendering — try another browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
}

