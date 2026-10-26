/**
 * Lazy loader for pdf.js (legacy build — no top-level await, bundler-safe).
 *
 * One module worker + one PDFWorker instance live for the whole page and are
 * passed to every getDocument call — the same architecture as the official
 * pdf.js viewer. Documents can then be destroyed freely: pdf.js only tears
 * down workers it created itself, so the shared instance survives every
 * doc.destroy() and later documents can't wedge on a stale port handshake.
 */
type PdfjsModule = typeof import("pdfjs-dist");
type PdfWorkerInstance = InstanceType<PdfjsModule["PDFWorker"]>;

let sharedWorker: PdfWorkerInstance | null = null;

export async function loadPdfjs(): Promise<PdfjsModule> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!sharedWorker || sharedWorker.destroyed) {
    const port = new Worker("/pdf.worker.min.mjs", { type: "module" });
    // The public types gate `port` to internal use; runtime accepts it.
    sharedWorker = new pdfjs.PDFWorker({ port } as never);
  }
  const worker = sharedWorker;
  // Thin wrapper so existing `pdfjs.getDocument(...)` call sites reuse the
  // shared worker without knowing about it. All call sites pass object params.
  const getDocument = ((src: import("pdfjs-dist/types/src/display/api").DocumentInitParameters) =>
    pdfjs.getDocument({ ...src, worker })) as PdfjsModule["getDocument"];
  return Object.assign(
    {},
    pdfjs as unknown as Record<string, unknown>,
    { getDocument },
  ) as unknown as PdfjsModule;
}

/**
 * Best-effort real font name (e.g. "SourceSansPro-Regular") for a text
 * content item. Fonts resolve into pdf.js's common-object store during
 * render; that API is internal, so every access is guarded and callers get
 * the generic CSS family when it isn't reachable.
 */
export function detectFontLabel(
  page: unknown,
  loadedName: string,
  fallbackFamily?: string,
): string | null {
  try {
    const commonObjs = (
      page as { commonObjs?: { has?: (id: string) => boolean; get?: (id: string) => unknown } }
    ).commonObjs;
    if (commonObjs?.has?.(loadedName)) {
      const font = commonObjs.get!(loadedName) as
        | { name?: unknown; data?: { name?: unknown } }
        | undefined;
      const name = font?.name ?? font?.data?.name;
      if (typeof name === "string" && name.length > 0) {
        // Strip the six-letter subset prefix ("ABCDEF+FontName").
        return name.replace(/^[A-Z]{6}\+/, "");
      }
    }
  } catch {
    // Internal API shape varies across pdf.js builds — fall through.
  }
  return fallbackFamily ?? null;
}
