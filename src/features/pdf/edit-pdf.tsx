"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Highlighter, Image as ImageIcon, PenLine, Type, Undo2 } from "lucide-react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, RangeInput, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import {
  pctToPt,
  serializeOverlays,
  simplifyInk,
  type EditOverlay,
  type EditTool,
} from "@/lib/pdf-edit";
import { loadPdfjs } from "./pdfjs";
import { paintPage } from "./pdf-thumbnails";
import { bakeOverlays } from "./pdf-bake";

const TOOLS: Array<{ id: EditTool; label: string }> = [
  { id: "text", label: "Text" },
  { id: "ink", label: "Draw" },
  { id: "highlight", label: "Highlight" },
  { id: "whiteout", label: "White-out" },
  { id: "image", label: "Image" },
];

const INK_COLORS = ["#1a1a2e", "#d61a3c", "#0b6e4f", "#1a4a8b"];

type Phase = "idle" | "loading" | "editing";

export default function EditPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];
  const [phase, setPhase] = useState<Phase>("idle");
  const [pageCount, setPageCount] = useState(0);
  const [current, setCurrent] = useState(0); // zero-based
  const [overlays, setOverlays] = useState<EditOverlay[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [tool, setTool] = useState<EditTool>("text");
  const [fontSize, setFontSize] = useState(14);
  const [inkWidth, setInkWidth] = useState(2);
  const [inkColor, setInkColor] = useState(INK_COLORS[0]);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<{ overlay: Extract<EditOverlay, { type: "text" }>; index: number } | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const inkPoints = useRef<Array<{ xPct: number; yPct: number }>>([]);
  const dragStart = useRef<{ xPct: number; yPct: number } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const historyPush = useCallback((snapshot: EditOverlay[]) => {
    setHistory((h) => [...h.slice(-24), serializeOverlays(snapshot)]);
  }, []);

  const commit = useCallback((next: EditOverlay[]) => {
    setOverlays((current) => {
      historyPush(current);
      return next;
    });
  }, [historyPush]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setOverlays(JSON.parse(last) as EditOverlay[]);
      return h.slice(0, -1);
    });
  }, []);

  // ── Load the document and paint the current page ─────────────────
  useEffect(() => {
    if (!file) {
      setPhase("idle");
      setOverlays([]);
      setHistory([]);
      setPageCount(0);
      setCurrent(0);
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setOverlays([]);
    setHistory([]);
    setCurrent(0);
    setEditorError(null);
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setPageCount(doc.numPages);
        setPhase("editing");
      } catch (err) {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setEditorError(
          e.name === "PasswordException"
            ? "This PDF is password-protected — unlock it first, then edit."
            : e.message,
        );
        setPhase("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Paint the current page whenever it changes
  useEffect(() => {
    if (phase !== "editing" || !file) return;
    let cancelled = false;
    (async () => {
      const doc = pdfDocRef.current;
      const canvas = pageCanvasRef.current;
      if (!doc || !canvas) return;
      const cssWidth = Math.min(860, wrapRef.current?.clientWidth ?? 860);
      await paintPage(doc, current + 1, canvas, cssWidth);
      if (cancelled) return;
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        overlay.width = canvas.width;
        overlay.height = canvas.height;
      }
      drawCommitted();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, file]);

  /** Repaint committed overlays onto the overlay canvas (screen space). */
  const drawCommitted = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const pageCanvas = pageCanvasRef.current;
    if (!canvas || !pageCanvas) return;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const cssWidth = parseFloat(pageCanvas.style.width) || pageCanvas.width;
    const scale = canvas.width / cssWidth;
    for (const overlay of overlays) {
      if (overlay.page !== current) continue;
      if (overlay.type === "highlight" || overlay.type === "whiteout") {
        context.fillStyle = overlay.type === "highlight" ? "rgba(255, 235, 59, 0.45)" : "#ffffff";
        context.fillRect(
          (overlay.xPct / 100) * canvas.width,
          (overlay.yPct / 100) * canvas.height,
          (overlay.widthPct / 100) * canvas.width,
          (overlay.heightPct / 100) * canvas.height,
        );
      } else if (overlay.type === "ink") {
        context.strokeStyle = overlay.color;
        context.lineWidth = overlay.widthPt * scale * 1.4;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        overlay.points.forEach((point, i) => {
          const x = (point.xPct / 100) * canvas.width;
          const y = (point.yPct / 100) * canvas.height;
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();
      } else if (overlay.type === "text") {
        context.fillStyle = overlay.color;
        context.font = `${overlay.bold ? "bold " : ""}${overlay.fontSizePt * scale * 1.33}px sans-serif`;
        context.textBaseline = "top";
        const maxWidth = (overlay.widthPct / 100) * canvas.width;
        const x = (overlay.xPct / 100) * canvas.width;
        const y = (overlay.yPct / 100) * canvas.height;
        for (const [i, line] of overlay.text.split("\n").entries()) {
          // Approximate the wrap the bake will apply.
          wrapLineOnCanvas(context, line, maxWidth).forEach((chunk, j) => {
            context.fillText(chunk, x, y + i * overlay.fontSizePt * scale * 2 + j * overlay.fontSizePt * scale * 1.6);
          });
        }
      } else if (overlay.type === "image") {
        const img = imageElements.current.get(overlay.dataUrl);
        if (img) {
          context.drawImage(
            img,
            (overlay.xPct / 100) * canvas.width,
            (overlay.yPct / 100) * canvas.height,
            (overlay.widthPct / 100) * canvas.width,
            (overlay.heightPct / 100) * canvas.height,
          );
        }
      }
    }
  }, [overlays, current]);

  useEffect(() => {
    drawCommitted();
  }, [drawCommitted]);

  const imageElements = useRef(new Map<string, HTMLImageElement>());
  function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
    const cached = imageElements.current.get(dataUrl);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageElements.current.set(dataUrl, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function overlayPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      xPct: ((event.clientX - rect.left) / rect.width) * 100,
      yPct: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool === "text") return; // click handler places text
    const point = overlayPoint(event);
    drawing.current = true;
    if (tool === "ink") {
      inkPoints.current = [point];
    } else if (tool === "highlight" || tool === "whiteout") {
      dragStart.current = point;
    } else if (tool === "image" && imageDataUrl) {
      loadImageElement(imageDataUrl).then((img) => {
        const widthPct = 25;
        const pageCanvas = pageCanvasRef.current;
        const pageAspect = pageCanvas ? pageCanvas.height / pageCanvas.width : 1.414;
        const heightPct = widthPct * (img.height / img.width) / pageAspect;
        commit([
          ...overlays.filter((o) => o.page !== current),
          ...overlays.filter((o) => o.page === current),
          {
            type: "image",
            page: current,
            xPct: point.xPct,
            yPct: point.yPct,
            widthPct,
            heightPct,
            dataUrl: imageDataUrl,
          },
        ]);
      });
    }
    // Pointer capture keeps drags alive outside the canvas; synthetic
    // pointers (tests, some browsers) may reject it — non-fatal.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const point = overlayPoint(event);
    if (tool === "ink" && inkPoints.current.length > 0) {
      inkPoints.current.push(point);
      // Live preview: redraw committed + current stroke
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      drawCommitted();
      const context = canvas.getContext("2d")!;
      context.strokeStyle = inkColor;
      context.lineWidth = inkWidth * 1.4;
      context.lineCap = "round";
      const pts = inkPoints.current;
      context.beginPath();
      context.moveTo((pts[0].xPct / 100) * canvas.width, (pts[0].yPct / 100) * canvas.height);
      for (const p of pts.slice(1)) context.lineTo((p.xPct / 100) * canvas.width, (p.yPct / 100) * canvas.height);
      context.stroke();
    } else if ((tool === "highlight" || tool === "whiteout") && dragStart.current) {
      // Live preview of the dragging rectangle
      drawCommitted();
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d")!;
      const start = dragStart.current;
      context.fillStyle = tool === "highlight" ? "rgba(255, 235, 59, 0.45)" : "rgba(255,255,255,0.9)";
      context.fillRect(
        (Math.min(start.xPct, point.xPct) / 100) * canvas.width,
        (Math.min(start.yPct, point.yPct) / 100) * canvas.height,
        (Math.abs(point.xPct - start.xPct) / 100) * canvas.width,
        (Math.abs(point.yPct - start.yPct) / 100) * canvas.height,
      );
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    const point = overlayPoint(event);
    if (tool === "ink" && inkPoints.current.length > 1) {
      const simplified = simplifyInk(inkPoints.current, 0.2);
      commit([
        ...overlays,
        {
          type: "ink",
          page: current,
          xPct: simplified[0].xPct,
          yPct: simplified[0].yPct,
          points: simplified,
          widthPt: inkWidth,
          color: inkColor,
        },
      ]);
      inkPoints.current = [];
    } else if ((tool === "highlight" || tool === "whiteout") && dragStart.current) {
      const start = dragStart.current;
      dragStart.current = null;
      const widthPct = Math.abs(point.xPct - start.xPct);
      const heightPct = Math.abs(point.yPct - start.yPct);
      if (widthPct > 0.3 && heightPct > 0.2) {
        commit([
          ...overlays,
          {
            type: tool,
            page: current,
            xPct: Math.min(start.xPct, point.xPct),
            yPct: Math.min(start.yPct, point.yPct),
            widthPct,
            heightPct,
          },
        ]);
      }
      drawCommitted();
    }
  }

  function placeText(event: React.MouseEvent<HTMLCanvasElement>) {
    if (tool !== "text") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPct = ((event.clientX - rect.left) / rect.width) * 100;
    const yPct = ((event.clientY - rect.top) / rect.height) * 100;
    const overlay: Extract<EditOverlay, { type: "text" }> = {
      type: "text",
      page: current,
      xPct,
      yPct,
      widthPct: 40,
      text: "",
      fontSizePt: fontSize,
      color: "#1a1a2e",
    };
    setEditingText({ overlay, index: overlays.length });
    commit([...overlays, overlay]);
  }

  function commitTextEdit(text: string) {
    if (!editingText) return;
    const index = editingText.index;
    setOverlays((current) => {
      const next = [...current];
      const target = next[index];
      if (target?.type === "text") next[index] = { ...target, text };
      return next.filter((o) => !(o.type === "text" && o.text.trim() === ""));
    });
    setEditingText(null);
  }

  function startOver() {
    queue.clear();
    setOverlays([]);
    setHistory([]);
    setPhase("idle");
    reset();
  }

  async function apply() {
    const source = file!;
    await start(async ({ report }) => {
      report("Baking your edits into the PDF…", 0.7);
      return [await bakeOverlays(source, overlays)];
    }, "Applying edits…");
  }

  const hasEdits = overlays.length > 0;

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          note={`${overlays.length} edit${overlays.length === 1 ? "" : "s"} baked in — they're permanent page content now.`}
          onReset={startOver}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : phase === "editing" && file ? (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-[3px] border-edge bg-card p-2 shadow-[4px_4px_0_0_var(--color-shadow)]">
            {TOOLS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={tool === entry.id}
                onClick={() => setTool(entry.id)}
                className={cn(
                  "border-[3px] border-edge px-3 py-1.5 font-display text-[9px] uppercase shadow-[2px_2px_0_0_var(--color-shadow)]",
                  tool === entry.id ? "bg-brand text-on-brand" : "bg-canvas text-ink-soft",
                )}
              >
                {entry.id === "text" && <Type className="mr-1 inline size-3.5" aria-hidden />}
                {entry.id === "ink" && <PenLine className="mr-1 inline size-3.5" aria-hidden />}
                {entry.id === "highlight" && <Highlighter className="mr-1 inline size-3.5" aria-hidden />}
                {entry.id === "image" && <ImageIcon className="mr-1 inline size-3.5" aria-hidden />}
                {entry.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={undo} disabled={history.length === 0}>
                <Undo2 className="size-4" aria-hidden />
                Undo
              </Button>
            </div>
          </div>

          {/* Tool options */}
          <div className="flex flex-wrap items-end gap-4 border-[3px] border-edge bg-canvas p-3">
            {tool === "text" && (
              <Field label={`Text size — ${fontSize} pt`}>
                <RangeInput value={fontSize} min={8} max={36} onChange={setFontSize} suffix="pt" />
              </Field>
            )}
            {tool === "ink" && (
              <>
                <Field label={`Pen width — ${inkWidth} pt`}>
                  <RangeInput value={inkWidth} min={1} max={8} onChange={setInkWidth} suffix="pt" />
                </Field>
                <div className="flex items-end gap-1.5 pb-1.5">
                  {INK_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Pen color ${color}`}
                      aria-pressed={inkColor === color}
                      onClick={() => setInkColor(color)}
                      className={cn(
                        "size-6 border-[3px]",
                        inkColor === color ? "border-ink" : "border-transparent",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </>
            )}
            {tool === "image" && (
              <>
                <Field label="Stamp image" hint="PNG with transparency works best">
                  <input
                    type="file"
                    accept="image/png"
                    aria-label="Stamp image file"
                    className="font-body text-lg text-ink"
                    onChange={(event) => {
                      const imageFile = event.target.files?.[0];
                      if (!imageFile) return;
                      const reader = new FileReader();
                      reader.onload = () => setImageDataUrl(String(reader.result));
                      reader.readAsDataURL(imageFile);
                    }}
                  />
                </Field>
                <p className="text-sm text-ink-soft">
                  {imageDataUrl ? "Image ready — click the page to place it." : "Choose an image, then click the page."}
                </p>
              </>
            )}
            {tool === "highlight" && (
              <p className="text-sm text-ink-soft">Drag a rectangle over the text to highlight.</p>
            )}
            {tool === "whiteout" && (
              <p className="text-sm text-ink-soft">Drag a rectangle to cover content (white-out).</p>
            )}
          </div>

          {state.phase === "error" && <JobError message={state.error ?? ""} />}
          {editorError && <JobError message={editorError} />}

          {/* Page canvas */}
          <div ref={wrapRef} className="relative select-none">
            <canvas
              ref={pageCanvasRef}
              className={cn(
                "block w-full border-[3px] border-edge bg-white shadow-[4px_4px_0_0_var(--color-shadow)]",
                tool !== "text" && "touch-none",
              )}
            />
            <canvas
              ref={overlayCanvasRef}
              className={cn(
                "absolute inset-0 h-full w-full",
                tool !== "text" ? "cursor-crosshair" : "cursor-text",
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                drawing.current = false;
                dragStart.current = null;
              }}
              onClick={placeText}
              aria-label={`Page ${current + 1} editing canvas`}
            />
            {editingText && editingText.overlay.type === "text" && (
              <textarea
                ref={textAreaRef}
                autoFocus
                defaultValue={editingText.overlay.text}
                onBlur={(event) => commitTextEdit(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") commitTextEdit(editingText.overlay.text);
                }}
                className="absolute border-[3px] border-brand bg-white/95 p-1 font-body leading-snug text-ink shadow-[2px_2px_0_0_var(--color-shadow)]"
                style={{
                  left: `${editingText.overlay.xPct}%`,
                  top: `${editingText.overlay.yPct}%`,
                  width: `${editingText.overlay.widthPct}%`,
                  fontSize: `${editingText.overlay.fontSizePt * 1.33}px`,
                }}
                rows={2}
                aria-label="Edit text"
              />
            )}
          </div>

          {/* Page nav */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-[10px] text-ink uppercase">
              Page {current + 1} of {pageCount} · {overlays.length} edit{overlays.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))}>
                ← Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={current >= pageCount - 1}
                onClick={() => setCurrent((c) => Math.min(pageCount - 1, c + 1))}
              >
                Next →
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {hasEdits ? "Edits bake permanently when you apply." : "Pick a tool and click the page to start."}
            </p>
            <Button size="lg" disabled={!hasEdits} onClick={apply}>
              Apply Edits &amp; Download
            </Button>
          </div>
        </div>
      ) : phase === "loading" ? (
        <div className="border-[3px] border-edge bg-card p-4 font-display text-[10px] text-ink uppercase shadow-[4px_4px_0_0_var(--color-shadow)]">
          Opening document…
        </div>
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />
          <p className="text-sm text-ink-soft">
            Add text, draw, highlight, white-out and stamp images directly on the page — everything
            happens locally and bakes in permanently.
          </p>
        </div>
      )}
    </ToolWidget>
  );
}

/** Canvas-side approximation of the bake's word wrap. */
function wrapLineOnCanvas(
  context: CanvasRenderingContext2D,
  line: string,
  maxWidth: number,
): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      if (current) out.push(current);
      current = word;
    }
  }
  if (current) out.push(current);
  return out;
}
