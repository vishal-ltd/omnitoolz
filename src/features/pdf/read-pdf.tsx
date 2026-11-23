"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { setPendingFile } from "@/lib/file-handoff";
import { getTool, toolRoute } from "@/lib/tools/registry";
import { loadPdfjs } from "./pdfjs";
import { paintPage } from "./pdf-thumbnails";

const RENDER_CAP = 150;

/** Tools the viewer can hand the open file to (single-PDF inputs). */
const HANDOFF_TARGETS = [
  "organize-pdf",
  "split-pdf",
  "delete-pdf-pages",
  "rotate-pdf",
  "extract-pdf-pages",
  "extract-pdf-text",
  "protect-pdf",
  "unlock-pdf",
  "watermark-pdf",
  "header-footer-pdf",
  "add-page-numbers",
  "crop-pdf",
  "flatten-pdf",
  "clean-pdf",
  "pdf-to-jpg",
];

const QUICK_TARGETS = ["organize-pdf", "split-pdf", "protect-pdf", "extract-pdf-text"];

type ViewPhase = "idle" | "opening" | "reading" | "error";

export default function ReadPdfTool() {
  const router = useRouter();
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const [phase, setPhase] = useState<ViewPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [painted, setPainted] = useState<ReadonlySet<number>>(new Set());
  const [current, setCurrent] = useState(1);
  const [zoom, setZoom] = useState("1");
  const [target, setTarget] = useState("organize-pdf");
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadRef = useRef<AbortController | null>(null);
  const paintedRef = useRef<Set<number>>(new Set());
  const cssWidthRef = useRef(760);
  const file = queue.files[0];

  // ── Open the document; one live doc per load, destroyed on supersede ──
  useEffect(() => {
    if (!file) return;
    const controller = new AbortController();
    loadRef.current = controller;
    // Zoom applies on mobile too — the control must never be a no-op.
    const base = window.innerWidth < 640 ? window.innerWidth - 64 : 760;
    cssWidthRef.current = Math.max(320, base * Number(zoom));
    paintedRef.current = new Set();
    setPainted(new Set());
    setCurrent(1);
    setPhase("opening");
    setError(null);
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const bytes = new Uint8Array(await file.arrayBuffer());
        doc = await pdfjs.getDocument({ data: bytes }).promise;
        if (controller.signal.aborted) {
          await doc.destroy();
          return;
        }
        docRef.current = doc;
        setPageCount(doc.numPages);
        setPhase("reading");
      } catch (err) {
        if (controller.signal.aborted) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(
          e.name === "PasswordException"
            ? `“${file.name}” is password-protected. Unlock it first, then read it here.`
            : e.message,
        );
        setPhase("error");
      }
    })();
    return () => {
      controller.abort();
      docRef.current = null;
      // Never wipe canvasRefs here: React owns those refs and the next load
      // may already have attached them.
      if (doc) void doc.destroy().catch(() => {});
    };
  }, [file, zoom]);

  // ── Lazy paint: only near-screen pages hold a bitmap; offscreen ones are
  // released and repainted on return. 150 full-res canvases would be GBs. ──
  useEffect(() => {
    const container = containerRef.current;
    const doc = docRef.current;
    const controller = loadRef.current;
    if (!container || !doc || !controller || phase !== "reading") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageNumber = Number((entry.target as HTMLElement).dataset.page);
          const canvas = canvasRefs.current[pageNumber - 1];
          if (!Number.isFinite(pageNumber) || !canvas) continue;
          if (entry.isIntersecting) {
            if (paintedRef.current.has(pageNumber) || controller.signal.aborted) continue;
            paintedRef.current.add(pageNumber);
            void paintPage(doc, pageNumber, canvas, cssWidthRef.current)
              .then(() => {
                if (controller.signal.aborted) return;
                // Released while the paint was in flight — drop the bitmap.
                if (!paintedRef.current.has(pageNumber)) {
                  canvas.width = 0;
                  canvas.height = 0;
                }
                setPainted(new Set(paintedRef.current));
              })
              .catch(() => {
                paintedRef.current.delete(pageNumber);
              });
          } else if (paintedRef.current.has(pageNumber)) {
            paintedRef.current.delete(pageNumber);
            canvas.width = 0;
            canvas.height = 0;
            setPainted(new Set(paintedRef.current));
          }
        }
      },
      { root: container, rootMargin: "300px 0px" },
    );
    for (const page of container.querySelectorAll("[data-page]")) observer.observe(page);
    return () => observer.disconnect();
  }, [phase, pageCount, file, zoom]);

  // Track which page is on screen.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || phase === "idle" || phase === "error") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNumber = Number((entry.target as HTMLElement).dataset.page);
            if (Number.isFinite(pageNumber)) setCurrent(pageNumber);
          }
        }
      },
      { rootMargin: "-40% 0px -50% 0px" },
    );
    for (const page of container.querySelectorAll("[data-page]")) observer.observe(page);
    return () => observer.disconnect();
  }, [phase, pageCount]);

  function sendTo(toolId: string) {
    if (!file) return;
    setPendingFile(file);
    const tool = getTool(toolId);
    if (tool) router.push(toolRoute(tool));
  }

  function startOver() {
    queue.clear();
    setPageCount(0);
    setPainted(new Set());
    paintedRef.current = new Set();
    setCurrent(1);
    setError(null);
    setPhase("idle");
  }

  const limit = Math.min(pageCount, RENDER_CAP);

  return (
    <ToolWidget>
      {phase === "idle" ? (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} onUndo={queue.undoRemove} undoLabel={queue.lastRemoved} />
          <p className="text-sm text-ink-soft">
            Pages render right here — nothing is uploaded, and the file is one click away from
            every other tool.
          </p>
        </div>
      ) : phase === "error" ? (
        <div className="space-y-4">
          <div className="border-[3px] border-err bg-err-soft p-4 font-body text-lg text-ink shadow-[4px_4px_0_0_var(--color-shadow)]">
            {error}
          </div>
          <Button variant="secondary" onClick={startOver}>
            Open another file
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-[3px] border-edge bg-card p-3 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <p className="min-w-0 truncate font-display text-display-xs text-ink uppercase">
              {file?.name} — page {current} of {pageCount}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={zoom}
                onChange={(event) => setZoom(event.target.value)}
                aria-label="Zoom"
                className="w-auto"
              >
                <option value="0.75">75%</option>
                <option value="1">100%</option>
                <option value="1.5">150%</option>
              </Select>
              <Button variant="secondary" size="sm" onClick={startOver}>
                Close
              </Button>
            </div>
          </div>

          {(phase === "opening" || painted.size < limit) && (
            <div className="border-[3px] border-edge bg-card p-3 shadow-[4px_4px_0_0_var(--color-shadow)]">
              <p className="font-display text-display-xs text-ink-soft uppercase">
                {phase === "opening"
                  ? "Opening document…"
                  : `${painted.size} of ${limit} pages rendered — scroll to load more`}
              </p>
              <div className="mt-2 h-4 border-[3px] border-edge bg-canvas">
                <div
                  className="pixel-stripes-ok h-full transition-[width]"
                  style={{ width: `${Math.max(6, (painted.size / Math.max(1, limit)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div ref={containerRef} className="max-h-[65vh] space-y-4 overflow-y-auto border-[3px] border-edge bg-dither p-3">
            {Array.from({ length: limit }, (_, index) => (
              <div key={index} data-page={index + 1} className="relative">
                <canvas
                  ref={(canvas) => {
                    canvasRefs.current[index] = canvas;
                  }}
                  className="block w-full border-[3px] border-edge bg-white shadow-[4px_4px_0_0_var(--color-shadow)]"
                />
                {!painted.has(index + 1) && (
                  <span className="absolute inset-0 flex items-center justify-center border-[3px] border-edge bg-canvas font-display text-display-xs text-ink-soft">
                    PAGE {index + 1}
                  </span>
                )}
              </div>
            ))}
          </div>

          {pageCount > RENDER_CAP && (
            <p className="text-sm text-warn">
              Showing the first {RENDER_CAP} of {pageCount} pages — use the tools below to work
              with the full document.
            </p>
          )}

          <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <p className="font-display text-display-xs text-ink uppercase">Continue with…</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_TARGETS.map((id) => (
                <Button key={id} variant="secondary" size="sm" onClick={() => sendTo(id)}>
                  <Send className="size-3.5" aria-hidden />
                  {getTool(id)?.name ?? id}
                </Button>
              ))}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <Field label="Any other tool" className="flex-1">
                <Select value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Send file to tool">
                  {HANDOFF_TARGETS.map((id) => (
                    <option key={id} value={id}>
                      {getTool(id)?.name ?? id}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button onClick={() => sendTo(target)}>
                <Send className="size-3.5" aria-hidden />
                Send
              </Button>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              The file carries over — no re-picking needed.
            </p>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}