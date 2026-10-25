"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
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
  const [renderedCount, setRenderedCount] = useState(0);
  const [current, setCurrent] = useState(1);
  const [zoom, setZoom] = useState("1");
  const [target, setTarget] = useState("organize-pdf");
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const file = queue.files[0];

  const openDocument = useCallback(
    async (source: File, cssWidth: number) => {
      setPhase("opening");
      setError(null);
      setRenderedCount(0);
      try {
        const pdfjs = await loadPdfjs();
        const bytes = new Uint8Array(await source.arrayBuffer());
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        const total = doc.numPages;
        setPageCount(total);
        setPhase("reading");
        const limit = Math.min(total, RENDER_CAP);
        for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
          const canvas = canvasRefs.current[pageNumber - 1];
          if (!canvas) break;
          await paintPage(doc, pageNumber, canvas, cssWidth);
          setRenderedCount(pageNumber);
          if (pageNumber % 4 === 0) setCurrent((c) => Math.max(c, Math.min(pageNumber, limit)));
        }
        await doc.destroy();
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(
          e.name === "PasswordException"
            ? `“${source.name}” is password-protected. Unlock it first, then read it here.`
            : e.message,
        );
        setPhase("error");
      }
    },
    [],
  );

  useEffect(() => {
    if (!file) return;
    const width = window.innerWidth < 640 ? window.innerWidth - 64 : 760 * Number(zoom);
    openDocument(file, Math.max(320, width));
    return () => {
      canvasRefs.current = [];
      setCurrent(1);
    };
    // Re-open when the file or zoom changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, zoom]);

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
    canvasRefs.current = [];
    setPageCount(0);
    setRenderedCount(0);
    setCurrent(1);
    setError(null);
    setPhase("idle");
  }

  return (
    <ToolWidget>
      {phase === "idle" ? (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />
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
            <p className="min-w-0 truncate font-display text-[10px] text-ink uppercase">
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

          {(phase === "opening" || renderedCount < Math.min(pageCount, RENDER_CAP)) && (
            <div className="border-[3px] border-edge bg-card p-3 shadow-[4px_4px_0_0_var(--color-shadow)]">
              <p className="font-display text-[9px] text-ink-soft uppercase">
                {phase === "opening" ? "Opening document…" : `Rendering page ${renderedCount + 1}…`}
              </p>
              <div className="mt-2 h-4 border-[3px] border-edge bg-canvas">
                <div
                  className="pixel-stripes-ok h-full transition-[width]"
                  style={{
                    width: `${Math.max(6, (renderedCount / Math.max(1, Math.min(pageCount, RENDER_CAP))) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div ref={containerRef} className="max-h-[65vh] space-y-4 overflow-y-auto border-[3px] border-edge bg-dither p-3">
            {Array.from({ length: Math.min(pageCount, RENDER_CAP) }, (_, index) => (
              <div key={index} data-page={index + 1} className="relative">
                <canvas
                  ref={(canvas) => {
                    canvasRefs.current[index] = canvas;
                  }}
                  className="block w-full border-[3px] border-edge bg-white shadow-[4px_4px_0_0_var(--color-shadow)]"
                />
                {renderedCount <= index && (
                  <span className="absolute inset-0 flex items-center justify-center border-[3px] border-edge bg-canvas font-display text-[10px] text-ink-soft">
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
            <p className="font-display text-[9px] text-ink uppercase">Continue with…</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_TARGETS.map((id) => (
                <Button key={id} variant="secondary" size="sm" onClick={() => sendTo(id)}>
                  <Send className="size-4" aria-hidden />
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
                <Send className="size-4" aria-hidden />
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
