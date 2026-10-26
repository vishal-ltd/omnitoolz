"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Highlighter, Image as ImageIcon, MousePointer2, PenLine, Trash2, Type, Undo2 } from "lucide-react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Field, RangeInput } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import {
  serializeOverlays,
  simplifyInk,
  type EditOverlay,
  type EditTool,
} from "@/lib/pdf-edit";
import { loadPdfjs } from "./pdfjs";
import { paintPage, renderPageThumbnails } from "./pdf-thumbnails";
import { bakeOverlays } from "./pdf-bake";

const TOOLS: Array<{ id: EditTool | "select"; label: string }> = [
  { id: "select", label: "Select" },
  { id: "text", label: "Text" },
  { id: "ink", label: "Draw" },
  { id: "highlight", label: "Highlight" },
  { id: "whiteout", label: "White-out" },
  { id: "image", label: "Image" },
];

const INK_COLORS = ["#1a1a2e", "#d61a3c", "#0b6e4f", "#1a4a8b"];
const TEXT_COLORS = ["#1a1a2e", "#d61a3c", "#0b6e4f", "#1a4a8b"];

type Phase = "idle" | "loading" | "editing";

export default function EditPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];
  const [phase, setPhase] = useState<Phase>("idle");
  const [pageCount, setPageCount] = useState(0);
  const [current, setCurrent] = useState(0);
  const [overlays, setOverlays] = useState<EditOverlay[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [tool, setTool] = useState<EditTool | "select">("select");
  const [fontSize, setFontSize] = useState(14);
  const [inkWidth, setInkWidth] = useState(2);
  const [inkColor, setInkColor] = useState(INK_COLORS[0]);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [thumbs, setThumbs] = useState<Array<{ pageNumber: number; dataUrl: string }>>([]);
  const [editorError, setEditorError] = useState<string | null>(null);

  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const inkPoints = useRef<Array<{ xPct: number; yPct: number }>>([]);
  const dragStart = useRef<{ xPct: number; yPct: number } | null>(null);
  const moveState = useRef<{ index: number; grabDX: number; grabDY: number; moved: boolean } | null>(null);

  const historyPush = useCallback((snapshot: EditOverlay[]) => {
    setHistory((h) => [...h.slice(-24), serializeOverlays(snapshot)]);
  }, []);

  const commit = useCallback(
    (next: EditOverlay[]) => {
      setOverlays((current) => {
        historyPush(current);
        return next;
      });
    },
    [historyPush],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setOverlays(JSON.parse(last) as EditOverlay[]);
      setSelected(null);
      setEditingIndex(null);
      return h.slice(0, -1);
    });
  }, []);

  // ── Load document + thumbnails ────────────────────────────────────
  useEffect(() => {
    if (!file) {
      setPhase("idle");
      setOverlays([]);
      setHistory([]);
      setThumbs([]);
      setPageCount(0);
      setCurrent(0);
      setSelected(null);
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setOverlays([]);
    setHistory([]);
    setThumbs([]);
    setCurrent(0);
    setSelected(null);
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
        renderPageThumbnails(file, {
          targetWidth: 120,
          onPage: (page) => {
            if (!cancelled) {
              setThumbs((currentThumbs) =>
                [...currentThumbs, page].sort((a, b) => a.pageNumber - b.pageNumber),
              );
            }
          },
        }).catch(() => undefined);
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

  // ── Paint the current page ────────────────────────────────────────
  useEffect(() => {
    if (phase !== "editing" || !file) return;
    let cancelled = false;
    (async () => {
      const doc = pdfDocRef.current;
      const canvas = pageCanvasRef.current;
      if (!doc || !canvas) return;
      const cssWidth = Math.max(420, Math.min(860, (wrapRef.current?.clientWidth ?? 900) - 150));
      await paintPage(doc, current + 1, canvas, cssWidth);
      if (cancelled) return;
      const ink = inkCanvasRef.current;
      if (ink) {
        ink.width = canvas.width;
        ink.height = canvas.height;
      }
      drawInk();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, file]);

  /** Ink overlays paint onto the ink canvas (text/rects/images are DOM). */
  const drawInk = useCallback(() => {
    const canvas = inkCanvasRef.current;
    const pageCanvas = pageCanvasRef.current;
    if (!canvas || !pageCanvas) return;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / 860;
    for (const overlay of overlays) {
      if (overlay.page !== current || overlay.type !== "ink") continue;
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
    }
  }, [overlays, current]);

  useEffect(() => {
    drawInk();
  }, [drawInk]);

  function overlayPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      xPct: ((event.clientX - rect.left) / rect.width) * 100,
      yPct: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  // ── Canvas pointer flow: ink strokes + rect creation ─────────────
  function onCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool === "select" || tool === "text") return; // DOM elements own these
    const point = overlayPoint(event);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // synthetic pointers may reject capture — non-fatal
    }
    if (tool === "ink") {
      drawing.current = true;
      inkPoints.current = [point];
    } else if (tool === "highlight" || tool === "whiteout") {
      drawing.current = true;
      dragStart.current = point;
    }
  }

  function onCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const point = overlayPoint(event);
    if (tool === "ink" && inkPoints.current.length > 0) {
      inkPoints.current.push(point);
      const canvas = inkCanvasRef.current;
      if (!canvas) return;
      drawInk();
      const context = canvas.getContext("2d")!;
      context.strokeStyle = inkColor;
      context.lineWidth = inkWidth * (canvas.width / 860) * 1.4;
      context.lineCap = "round";
      const pts = inkPoints.current;
      context.beginPath();
      context.moveTo((pts[0].xPct / 100) * canvas.width, (pts[0].yPct / 100) * canvas.height);
      for (const p of pts.slice(1)) context.lineTo((p.xPct / 100) * canvas.width, (p.yPct / 100) * canvas.height);
      context.stroke();
    } else if ((tool === "highlight" || tool === "whiteout") && dragStart.current) {
      const canvas = inkCanvasRef.current;
      if (!canvas) return;
      drawInk();
      const context = canvas.getContext("2d")!;
      const start = dragStart.current;
      context.fillStyle = tool === "highlight" ? "rgba(255, 235, 59, 0.45)" : "rgba(255,255,255,0.92)";
      context.fillRect(
        (Math.min(start.xPct, point.xPct) / 100) * canvas.width,
        (Math.min(start.yPct, point.yPct) / 100) * canvas.height,
        (Math.abs(point.xPct - start.xPct) / 100) * canvas.width,
        (Math.abs(point.yPct - start.yPct) / 100) * canvas.height,
      );
    }
  }

  function onCanvasPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
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
      } else {
        drawInk();
      }
    }
  }

  // ── Element interactions (select / move / edit) ───────────────────
  function elementPointerDown(event: ReactPointerEvent<HTMLElement>, index: number) {
    event.stopPropagation();
    setSelected(index);
    const overlay = overlays[index];
    const wrap = wrapRef.current;
    const canvas = pageCanvasRef.current;
    if (!wrap || !canvas || !overlay) return;
    const canvasRect = canvas.getBoundingClientRect();
    const pointerXPct = ((event.clientX - canvasRect.left) / canvasRect.width) * 100;
    const pointerYPct = ((event.clientY - canvasRect.top) / canvasRect.height) * 100;
    moveState.current = {
      index,
      grabDX: pointerXPct - overlay.xPct,
      grabDY: pointerYPct - overlay.yPct,
      moved: false,
    };
    historyPush(overlays);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // synthetic pointers may reject capture — non-fatal
    }
  }

  function elementPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const move = moveState.current;
    if (!move) return;
    const overlay = overlays[move.index];
    if (!overlay || overlay.page !== current) return;
    const canvas = pageCanvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const pointerXPct = ((event.clientX - canvasRect.left) / canvasRect.width) * 100;
    const pointerYPct = ((event.clientY - canvasRect.top) / canvasRect.height) * 100;
    const nx = Math.max(0, Math.min(100, pointerXPct - move.grabDX));
    const ny = Math.max(0, Math.min(100, pointerYPct - move.grabDY));
    if (Math.abs(nx - overlay.xPct) > 0.2 || Math.abs(ny - overlay.yPct) > 0.2) move.moved = true;
    setOverlays((current) =>
      current.map((o, i) => (i === move.index ? { ...o, xPct: nx, yPct: ny } : o)),
    );
  }

  function elementPointerUp() {
    const move = moveState.current;
    if (move && !move.moved) {
      // A click, not a drag — drop the history snapshot pushed on pointerdown.
      setHistory((h) => h.slice(0, -1));
    }
    moveState.current = null;
  }

  function deleteSelected() {
    if (selected === null) return;
    commit(overlays.filter((_, i) => i !== selected));
    setSelected(null);
  }

  // Keyboard: Delete/Backspace removes the selected element
  useEffect(() => {
    if (phase !== "editing") return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      if ((event.key === "Delete" || event.key === "Backspace") && selected !== null) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected, overlays]);

  // ── Text creation + editing ───────────────────────────────────────
  const [editingText, setEditingText] = useState<{
    index: number;
    xPct: number;
    yPct: number;
    widthPct: number;
    text: string;
    fontSizePt: number;
    color: string;
    bold: boolean;
  } | null>(null);

  function newTextAt(xPct: number, yPct: number) {
    historyPush(overlays);
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
    const next = [...overlays, overlay];
    setOverlays(next);
    setSelected(next.length - 1);
    setEditingText({
      index: next.length - 1,
      xPct,
      yPct,
      widthPct: 40,
      text: "",
      fontSizePt: fontSize,
      color: "#1a1a2e",
      bold: false,
    });
  }

  function editTextAt(index: number) {
    const overlay = overlays[index];
    if (overlay?.type !== "text") return;
    setSelected(index);
    setEditingText({
      index,
      xPct: overlay.xPct,
      yPct: overlay.yPct,
      widthPct: overlay.widthPct,
      text: overlay.text,
      fontSizePt: overlay.fontSizePt,
      color: overlay.color,
      bold: overlay.bold ?? false,
    });
  }

  function commitTextEdit(text: string) {
    if (!editingText) return;
    setOverlays((current) =>
      current
        .map((o, i) =>
          i === editingText.index && o.type === "text"
            ? { ...o, text, fontSizePt: editingText.fontSizePt, color: editingText.color, bold: editingText.bold }
            : o,
        )
        .filter((o) => !(o.type === "text" && o.text.trim() === "")),
    );
    setEditingText(null);
  }

  /** Live-update the selected text element's properties. */
  function updateSelectedText(patch: { fontSizePt?: number; color?: string }) {
    if (selected === null) return;
    setOverlays((current) =>
      current.map((o, i) => (i === selected && o.type === "text" ? { ...o, ...patch } : o)),
    );
    if (editingText?.index === selected) {
      setEditingText((current) => (current ? { ...current, ...patch } : current));
    }
  }

  function onWrapperClick(event: React.MouseEvent<HTMLDivElement>) {
    // Click on empty page area with the Text tool → new text box
    if (tool !== "text" || editingText) return;
    const canvas = pageCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    newTextAt(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
  }

  /** Click on an existing text box → re-edit it. */
  function onTextBoxClick(index: number) {
    if (tool === "text" || tool === "select") editTextAt(index);
  }

  function startOver() {
    queue.clear();
    setOverlays([]);
    setHistory([]);
    setPhase("idle");
    setSelected(null);
    setEditingText(null);
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
  const elementsInteractive = tool === "select" || tool === "text";
  const editingIsText = editingIndex !== null && overlays[editingIndex]?.type === "text";
  const selectedIsText = selected !== null && overlays[selected]?.type === "text";
  const activeText =
    editingText && editingIsText
      ? { fontSizePt: editingText.fontSizePt, color: editingText.color }
      : selectedIsText
        ? {
            fontSizePt: (overlays[selected] as Extract<EditOverlay, { type: "text" }>).fontSizePt,
            color: (overlays[selected] as Extract<EditOverlay, { type: "text" }>).color,
          }
        : null;
  const showTextControls = tool === "text" || selectedIsText;

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
      ) : phase === "loading" ? (
        <div className="border-[3px] border-edge bg-card p-4 font-display text-[10px] text-ink uppercase shadow-[4px_4px_0_0_var(--color-shadow)]">
          Opening document…
        </div>
      ) : phase === "editing" && file ? (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-[3px] border-edge bg-card p-2 shadow-[4px_4px_0_0_var(--color-shadow)]">
            {TOOLS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={tool === entry.id}
                onClick={() => {
                  setTool(entry.id);
                  if (entry.id !== "select" && entry.id !== "text") setSelected(null);
                }}
                className={cn(
                  "border-[3px] border-edge px-3 py-1.5 font-display text-[9px] uppercase shadow-[2px_2px_0_0_var(--color-shadow)]",
                  tool === entry.id ? "bg-brand text-on-brand" : "bg-canvas text-ink-soft",
                )}
              >
                {entry.id === "select" && <MousePointer2 className="mr-1 inline size-3.5" aria-hidden />}
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
              <Button variant="secondary" size="sm" onClick={deleteSelected} disabled={selected === null}>
                <Trash2 className="size-4" aria-hidden />
                Delete
              </Button>
            </div>
          </div>

          {/* Tool options */}
          <div className="flex flex-wrap items-end gap-4 border-[3px] border-edge bg-canvas p-3">
            {showTextControls && (
              <>
                <Field label={`Text size — ${activeText?.fontSizePt ?? fontSize} pt`}>
                  <RangeInput
                    value={activeText?.fontSizePt ?? fontSize}
                    min={8}
                    max={36}
                    onChange={(value) => {
                      if (activeText) updateSelectedText({ fontSizePt: value });
                      else setFontSize(value);
                    }}
                    suffix="pt"
                  />
                </Field>
                <div className="flex items-end gap-1.5 pb-1.5">
                  {TEXT_COLORS.map((color) => {
                    const activeColor = activeText?.color ?? "#1a1a2e";
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Text color ${color}`}
                        aria-pressed={activeColor === color}
                        onClick={() => {
                          if (activeText) updateSelectedText({ color });
                        }}
                        className={cn("size-6 border-[3px]", activeColor === color ? "border-ink" : "border-transparent")}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>
              </>
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
                      className={cn("size-6 border-[3px]", inkColor === color ? "border-ink" : "border-transparent")}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </>
            )}
            {tool === "image" && (
              <Field label="Stamp image" hint="PNG with transparency works best" className="flex-1">
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
            )}
            {tool === "select" && (
              <p className="text-sm text-ink-soft">
                Click an element to select — drag to move, double-click text to edit, Delete key removes.
              </p>
            )}
            {tool === "highlight" && <p className="text-sm text-ink-soft">Drag a rectangle over the text to highlight.</p>}
            {tool === "whiteout" && <p className="text-sm text-ink-soft">Drag a rectangle to cover content (white-out).</p>}
          </div>

          {state.phase === "error" && <JobError message={state.error ?? ""} />}
          {editorError && <JobError message={editorError} />}

          {/* Editor: thumbnail rail + page */}
          <div className="flex gap-3">
            {/* Thumbnail rail */}
            <div className="max-h-[560px] w-24 shrink-0 space-y-2 overflow-y-auto border-[3px] border-edge bg-canvas p-2">
              {thumbs.map((thumb) => (
                <button
                  key={thumb.pageNumber}
                  type="button"
                  onClick={() => {
                    setCurrent(thumb.pageNumber - 1);
                    setSelected(null);
                    setEditingText(null);
                  }}
                  className={cn(
                    "block w-full border-[3px] bg-white",
                    current === thumb.pageNumber - 1 ? "border-brand shadow-[2px_2px_0_0_var(--color-brand)]" : "border-edge",
                  )}
                  aria-label={`Go to page ${thumb.pageNumber}`}
                  aria-current={current === thumb.pageNumber - 1}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb.dataUrl} alt={`Page ${thumb.pageNumber}`} className="block w-full" />
                  <span className="block border-t-[3px] border-inherit bg-card py-0.5 text-center font-display text-[8px] text-ink">
                    {thumb.pageNumber}
                  </span>
                </button>
              ))}
            </div>

            {/* Page + overlays */}
            <div ref={wrapRef} className="relative min-w-0 flex-1 select-none" onClick={onWrapperClick}>
              <canvas
                ref={pageCanvasRef}
                className="block w-full border-[3px] border-edge bg-white shadow-[4px_4px_0_0_var(--color-shadow)]"
              />
              <canvas
                ref={inkCanvasRef}
                className={cn(
                  "absolute inset-0 h-full w-full",
                  tool === "ink" || tool === "highlight" || tool === "whiteout" ? "cursor-crosshair" : "pointer-events-none",
                )}
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerCancel={() => {
                  drawing.current = false;
                  dragStart.current = null;
                }}
                aria-label={`Page ${current + 1} ink canvas`}
              />
              {/* DOM overlay elements: text, rects, images */}
              {overlays.map((overlay, index) => {
                if (overlay.page !== current || overlay.type === "ink") return null;
                const isSelected = selected === index;
                const base = cn(
                  "absolute",
                  interactiveFor(tool, overlay) ? (overlay.type === "text" ? "cursor-text" : "cursor-move") : "pointer-events-none",
                  isSelected && "outline outline-[3px] outline-brand",
                );
                if (editingIndex === index && editingText) return null; // textarea replaces it
                if (overlay.type === "text") {
                  return (
                    <div
                      key={index}
                      role="button"
                      tabIndex={0}
                      style={{
                        left: `${overlay.xPct}%`,
                        top: `${overlay.yPct}%`,
                        width: `${overlay.widthPct}%`,
                        fontSize: `${overlay.fontSizePt * 1.33}px`,
                        color: overlay.color,
                        fontWeight: overlay.bold ? 700 : 400,
                      }}
                      className={cn(base, "border border-dashed border-brand/50 bg-white/85 px-1 leading-snug")}
                      onPointerDown={(event) => elementPointerDown(event, index)}
                      onPointerMove={elementPointerMove}
                      onPointerUp={(event) => {
                        elementPointerUp();
                        if (tool === "text" || tool === "select") onTextBoxClick(index);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onTextBoxClick(index);
                      }}
                      title="Click to edit text"
                    >
                      {overlay.text || <span className="text-ink-soft/50">(empty text box)</span>}
                    </div>
                  );
                }
                if (overlay.type === "highlight" || overlay.type === "whiteout") {
                  return (
                    <div
                      key={index}
                      role="button"
                      tabIndex={0}
                      style={{
                        left: `${overlay.xPct}%`,
                        top: `${overlay.yPct}%`,
                        width: `${overlay.widthPct}%`,
                        height: `${overlay.heightPct}%`,
                        backgroundColor: overlay.type === "highlight" ? "rgba(255, 235, 59, 0.45)" : "#ffffff",
                      }}
                      className={base}
                      onPointerDown={(event) => elementPointerDown(event, index)}
                      onPointerMove={elementPointerMove}
                      onPointerUp={elementPointerUp}
                      aria-label={overlay.type === "highlight" ? "Highlight area" : "White-out area"}
                    />
                  );
                }
                if (overlay.type === "image") {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={index}
                      src={overlay.dataUrl}
                      alt="Placed image"
                      style={{
                        left: `${overlay.xPct}%`,
                        top: `${overlay.yPct}%`,
                        width: `${overlay.widthPct}%`,
                        height: `${overlay.heightPct}%`,
                      }}
                      className={base}
                      onPointerDown={(event) => elementPointerDown(event, index)}
                      onPointerMove={elementPointerMove}
                      onPointerUp={elementPointerUp}
                    />
                  );
                }
                return null;
              })}
              {/* Active text editor */}
              {editingText && (
                <textarea
                  autoFocus
                  defaultValue={editingText.text}
                  onBlur={(event) => commitTextEdit(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") commitTextEdit(editingText.text);
                    event.stopPropagation();
                  }}
                  style={{
                    left: `${editingText.xPct}%`,
                    top: `${editingText.yPct}%`,
                    width: `${editingText.widthPct}%`,
                    fontSize: `${editingText.fontSizePt * 1.33}px`,
                    color: editingText.color,
                    fontWeight: editingText.bold ? 700 : 400,
                  }}
                  className="absolute z-10 border-[3px] border-brand bg-white/95 p-1 font-body leading-snug text-ink shadow-[2px_2px_0_0_var(--color-brand)]"
                  rows={2}
                  aria-label="Edit text"
                />
              )}
            </div>
          </div>

          {/* Page nav */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-[10px] text-ink uppercase">
              Page {current + 1} of {pageCount} · {overlays.length} edit{overlays.length === 1 ? "" : "s"}
              {selected !== null ? " · element selected" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={current === 0} onClick={() => { setCurrent((c) => Math.max(0, c - 1)); setSelected(null); }}>
                ← Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={current >= pageCount - 1}
                onClick={() => { setCurrent((c) => Math.min(pageCount - 1, c + 1)); setSelected(null); }}
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

/** Which overlays respond to the pointer for the active tool. */
function interactiveFor(tool: EditTool | "select", overlay: EditOverlay): boolean {
  if (tool === "select") return true;
  if (tool === "text") return overlay.type === "text";
  return false;
}
