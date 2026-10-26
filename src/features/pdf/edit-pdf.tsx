"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
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
  editOverlayChanged,
  editTextOverlayFromItem,
  pctToPt,
  serializeOverlays,
  simplifyInk,
  type EditOverlay,
  type EditTextOverlay,
  type EditTool,
  type FontChoice,
} from "@/lib/pdf-edit";
import { hitTestTextItem, mergeLineItems, type PdfTextItem } from "@/lib/pdf-text-items";
import { detectFontLabel, loadPdfjs } from "./pdfjs";
import { paintPage, renderPageThumbnails } from "./pdf-thumbnails";
import { bakeOverlays } from "./pdf-bake";

const TOOLS: Array<{ id: EditTool | "select"; label: string }> = [
  { id: "select", label: "Select" },
  { id: "text", label: "Text" },
  { id: "ink", label: "Draw" },
  { id: "highlight", label: "Highlight" },
  { id: "whiteout", label: "Shape" },
  { id: "image", label: "Image" },
];

const INK_COLORS = ["#1a1a2e", "#d61a3c", "#0b6e4f", "#1a4a8b"];
const TEXT_COLORS = ["#1a1a2e", "#d61a3c", "#0b6e4f", "#1a4a8b"];

type Phase = "idle" | "loading" | "editing";

/** The bottom sheet that edits an existing-text run (or a queued edit). */
interface SheetState {
  /** Fresh target built from the detected run, or the overlay being re-edited. */
  template: EditTextOverlay;
  /** Index into overlays when re-editing; null when creating a new edit. */
  overlayIndex: number | null;
  text: string;
  sizePt: number;
  fontFamily: FontChoice;
  bold: boolean;
  italic: boolean;
  color: string;
}

function clampSizePt(value: number): number {
  return Math.min(96, Math.max(4, Math.round(value * 10) / 10));
}

function clampZoom(value: number): number {
  return Math.min(2.5, Math.max(0.5, Math.round(value * 10) / 10));
}

/** CSS font stack for the live preview of a replacement font choice. */
function previewFontFamily(choice: FontChoice, fontLabel: string | null): string {
  if (choice === "helvetica") return "Helvetica, Arial, sans-serif";
  if (choice === "times") return "'Times New Roman', Times, serif";
  if (choice === "courier") return "'Courier New', monospace";
  const label = (fontLabel ?? "").toLowerCase();
  if (label.includes("times") || label.includes("serif")) return "'Times New Roman', Times, serif";
  if (label.includes("mono") || label.includes("courier")) return "'Courier New', monospace";
  return "Helvetica, Arial, sans-serif";
}

export default function EditPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];
  const [phase, setPhase] = useState<Phase>("idle");
  const [pageCount, setPageCount] = useState(0);
  const [current, setCurrent] = useState(0);
  const [overlays, setOverlays] = useState<EditOverlay[]>([]);
  const [tool, setTool] = useState<EditTool | "select">("select");
  const [fontSize, setFontSize] = useState(14);
  const [inkWidth, setInkWidth] = useState(2);
  const [inkColor, setInkColor] = useState(INK_COLORS[0]);
  const [rectFill, setRectFill] = useState("#ffffff");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [thumbs, setThumbs] = useState<Array<{ pageNumber: number; dataUrl: string }>>([]);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [stackSizes, setStackSizes] = useState({ undo: 0, redo: 0 });
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

  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const inkPoints = useRef<Array<{ xPct: number; yPct: number }>>([]);
  const dragStart = useRef<{ xPct: number; yPct: number } | null>(null);
  const moveState = useRef<{ index: number; grabDX: number; grabDY: number; moved: boolean } | null>(null);
  /** Mirror of overlays for event handlers that need the latest value. */
  const overlaysRef = useRef<EditOverlay[]>([]);
  /** Per-page detected text lines + page sizes, keyed by page index. */
  const textItemsRef = useRef<Record<number, PdfTextItem[]>>({});
  const pageSizesRef = useRef<Record<number, { width: number; height: number }>>({});
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  useEffect(() => {
    overlaysRef.current = overlays;
  }, [overlays]);

  function clearHistory() {
    undoStack.current = [];
    redoStack.current = [];
    setStackSizes({ undo: 0, redo: 0 });
  }

  const historyPush = useCallback((snapshot: EditOverlay[]) => {
    undoStack.current = [...undoStack.current.slice(-24), serializeOverlays(snapshot)];
    redoStack.current = [];
    setStackSizes({ undo: undoStack.current.length, redo: 0 });
  }, []);

  const commit = useCallback(
    (next: EditOverlay[]) => {
      historyPush(overlaysRef.current);
      setOverlays(next);
    },
    [historyPush],
  );

  /** Undo a pointerdown snapshot when the gesture turned out to be a click. */
  const dropLastSnapshot = useCallback(() => {
    undoStack.current = undoStack.current.slice(0, -1);
    setStackSizes((sizes) => ({ ...sizes, undo: undoStack.current.length }));
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoStack.current[undoStack.current.length - 1];
    if (!snapshot) return;
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [...redoStack.current, serializeOverlays(overlaysRef.current)];
    setStackSizes({ undo: undoStack.current.length, redo: redoStack.current.length });
    setOverlays(JSON.parse(snapshot) as EditOverlay[]);
    setSelected(null);
    setEditingText(null);
    setSheet(null);
  }, []);

  const redo = useCallback(() => {
    const snapshot = redoStack.current[redoStack.current.length - 1];
    if (!snapshot) return;
    redoStack.current = redoStack.current.slice(0, -1);
    undoStack.current = [...undoStack.current, serializeOverlays(overlaysRef.current)];
    setStackSizes({ undo: undoStack.current.length, redo: redoStack.current.length });
    setOverlays(JSON.parse(snapshot) as EditOverlay[]);
    setSelected(null);
    setEditingText(null);
    setSheet(null);
  }, []);

  // ── Load document + thumbnails ────────────────────────────────────
  useEffect(() => {
    if (!file) {
      setPhase("idle");
      setOverlays([]);
      setThumbs([]);
      setPageCount(0);
      setCurrent(0);
      setSelected(null);
      setEditingText(null);
      setSheet(null);
      setZoom(1);
      clearHistory();
      textItemsRef.current = {};
      pageSizesRef.current = {};
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setOverlays([]);
    setThumbs([]);
    setCurrent(0);
    setSelected(null);
    setEditingText(null);
    setSheet(null);
    setZoom(1);
    setEditorError(null);
    clearHistory();
    textItemsRef.current = {};
    pageSizesRef.current = {};
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // ── Paint the current page + detect its text targets ─────────────
  useEffect(() => {
    if (phase !== "editing" || !file) return;
    let cancelled = false;
    (async () => {
      const doc = pdfDocRef.current;
      const canvas = pageCanvasRef.current;
      if (!doc || !canvas) return;
      const cssWidth = Math.max(420, Math.min(860, (wrapRef.current?.clientWidth ?? 900) - 150));
      try {
        // Page box in unrotated PDF units, matching the user-space geometry
        // pdf-lib will bake against.
        const page = await doc.getPage(current + 1);
        const view = page.view ?? [0, 0, 595.28, 841.89];
        const pw = view[2] - view[0];
        const ph = view[3] - view[1];
        pageSizesRef.current[current] = {
          width: pw > 0 ? pw : 595.28,
          height: ph > 0 ? ph : 841.89,
        };
        await paintPage(doc, current + 1, canvas, cssWidth);
        if (cancelled) return;
        // Text targets are detected AFTER the render: fonts resolve into
        // pdf.js's common-object store during painting, and the real font
        // name is only reachable once they have.
        try {
          const content = await page.getTextContent();
          const runs: PdfTextItem[] = [];
          for (const raw of content.items) {
            if (!("str" in raw) || !raw.str || !(raw.width > 0)) continue;
            const t = raw.transform;
            const style = content.styles[raw.fontName];
            runs.push({
              str: raw.str,
              x: t[4],
              y: t[5],
              width: raw.width,
              fontSize: Math.hypot(t[2], t[3]) || raw.height || 12,
              ascent: typeof style?.ascent === "number" && style.ascent > 0 ? style.ascent : 0.8,
              descent: typeof style?.descent === "number" && style.descent < 0 ? style.descent : -0.2,
              fontLabel: detectFontLabel(page, raw.fontName, style?.fontFamily),
            });
          }
          textItemsRef.current[current] = mergeLineItems(runs);
        } catch {
          textItemsRef.current[current] = [];
        }
        if (cancelled) return;
        const ink = inkCanvasRef.current;
        if (ink) {
          ink.width = canvas.width;
          ink.height = canvas.height;
        }
        drawInk();
      } catch (err) {
        if (!cancelled) setEditorError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, file]);

  /**
   * Preview layer: queued existing-text edits paint as whiteout + the
   * replacement text; ink strokes paint as segments.
   */
  const drawInk = useCallback(() => {
    const canvas = inkCanvasRef.current;
    const pageCanvas = pageCanvasRef.current;
    if (!canvas || !pageCanvas) return;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const pageSize = pageSizesRef.current[current];
    if (pageSize) {
      const pxPerPt = canvas.height / pageSize.height;
      for (const overlay of overlays) {
        if (overlay.page !== current || overlay.type !== "edit") continue;
        context.fillStyle = "#ffffff";
        context.fillRect(
          (overlay.xPct / 100) * canvas.width,
          (overlay.yPct / 100) * canvas.height,
          (overlay.widthPct / 100) * canvas.width,
          (overlay.heightPct / 100) * canvas.height,
        );
        context.fillStyle = overlay.color;
        context.textBaseline = "alphabetic";
        context.font = `${overlay.italic ? "italic " : ""}${overlay.bold ? "700 " : ""}${
          overlay.sizePt * pxPerPt
        }px ${previewFontFamily(overlay.fontFamily, overlay.fontLabel)}`;
        context.fillText(
          overlay.text,
          (overlay.xPct / 100) * canvas.width,
          (overlay.baselinePct / 100) * canvas.height,
        );
      }
    }
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
      context.fillStyle = tool === "highlight" ? "rgba(255, 235, 59, 0.45)" : rectFill;
      context.globalAlpha = tool === "highlight" ? 1 : 0.95;
      context.fillRect(
        (Math.min(start.xPct, point.xPct) / 100) * canvas.width,
        (Math.min(start.yPct, point.yPct) / 100) * canvas.height,
        (Math.abs(point.xPct - start.xPct) / 100) * canvas.width,
        (Math.abs(point.yPct - start.yPct) / 100) * canvas.height,
      );
      context.globalAlpha = 1;
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
            ...(tool === "whiteout" ? { fill: rectFill } : {}),
          },
        ]);
      } else {
        drawInk();
      }
    }
  }

  // ── Element interactions (select / move / re-edit) ────────────────
  function elementPointerDown(event: ReactPointerEvent<HTMLElement>, index: number) {
    event.stopPropagation();
    setSelected(index);
    const overlay = overlays[index];
    const canvas = pageCanvasRef.current;
    if (!canvas || !overlay) return;
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
    setOverlays((currentOverlays) =>
      currentOverlays.map((o, i) => {
        if (i !== move.index) return o;
        if (o.type !== "edit") return { ...o, xPct: nx, yPct: ny };
        // User-space geometry must follow the % drag so baking lands
        // exactly where the preview shows it.
        const pageSize = pageSizesRef.current[o.page] ?? { width: 595.28, height: 841.89 };
        const dx = nx - o.xPct;
        const dy = ny - o.yPct;
        return {
          ...o,
          xPct: nx,
          yPct: ny,
          baselinePct: o.baselinePct + dy,
          userX: o.userX + (dx / 100) * pageSize.width,
          userY: o.userY - (dy / 100) * pageSize.height,
        };
      }),
    );
  }

  function elementPointerUp() {
    const move = moveState.current;
    if (move && !move.moved) {
      // A click, not a drag — drop the history snapshot pushed on pointerdown.
      dropLastSnapshot();
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

  // ── New text boxes ────────────────────────────────────────────────
  function newTextAt(xPct: number, yPct: number) {
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
    commit(next);
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

  // ── Existing-text editing (the sheet) ─────────────────────────────
  function findTextTargetAt(xPct: number, yPct: number, pageIndex: number): PdfTextItem | null {
    const items = textItemsRef.current[pageIndex];
    const size = pageSizesRef.current[pageIndex];
    if (!items || items.length === 0 || !size) return null;
    const { x, y } = pctToPt(xPct, yPct, size);
    return hitTestTextItem(items, x, y, 3);
  }

  function openSheetFromItem(item: PdfTextItem, pageIndex: number) {
    const size = pageSizesRef.current[pageIndex];
    if (!size) return;
    setSelected(null);
    setEditingText(null);
    setSheet({
      template: editTextOverlayFromItem(item, pageIndex, size),
      overlayIndex: null,
      text: item.str,
      sizePt: item.fontSize,
      fontFamily: "original",
      bold: false,
      italic: false,
      color: "#000000",
    });
  }

  function onEditOverlayClick(index: number) {
    if (tool !== "select" && tool !== "text") return;
    const overlay = overlays[index];
    if (overlay?.type !== "edit") return;
    setSelected(index);
    setEditingText(null);
    setSheet({
      template: overlay,
      overlayIndex: index,
      text: overlay.text,
      sizePt: overlay.sizePt,
      fontFamily: overlay.fontFamily,
      bold: overlay.bold,
      italic: overlay.italic,
      color: overlay.color,
    });
  }

  function commitSheet() {
    if (!sheet) return;
    const fields = {
      text: sheet.text,
      sizePt: sheet.sizePt,
      fontFamily: sheet.fontFamily,
      bold: sheet.bold,
      italic: sheet.italic,
      color: sheet.color,
    };
    if (!editOverlayChanged({ ...sheet.template, ...fields })) {
      // "No changes yet." — leave the document untouched.
      setSheet(null);
      return;
    }
    if (sheet.overlayIndex === null) {
      const next = [...overlays, { ...sheet.template, ...fields }];
      commit(next);
      setSelected(next.length - 1);
    } else {
      // Merge onto the live overlay so drags made while the sheet was
      // open survive the commit.
      const live = overlays[sheet.overlayIndex];
      const base = live?.type === "edit" ? live : sheet.template;
      commit(overlays.map((o, i) => (i === sheet.overlayIndex ? { ...base, ...fields } : o)));
      setSelected(sheet.overlayIndex);
    }
    setSheet(null);
  }

  function onWrapperClick(event: React.MouseEvent<HTMLDivElement>) {
    if (tool !== "text" && tool !== "select") return;
    if (sheet || editingText) return;
    const canvas = pageCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    const xPct = ((event.clientX - rect.left) / rect.width) * 100;
    const yPct = ((event.clientY - rect.top) / rect.height) * 100;
    const hit = findTextTargetAt(xPct, yPct, current);
    if (hit) {
      openSheetFromItem(hit, current);
      return;
    }
    if (tool === "text") newTextAt(xPct, yPct);
  }

  /** Click on an existing text box → re-edit it. */
  function onTextBoxClick(index: number) {
    if (tool === "text" || tool === "select") editTextAt(index);
  }

  function startOver() {
    queue.clear();
    setOverlays([]);
    setEditingText(null);
    setSheet(null);
    setPhase("idle");
    setSelected(null);
    clearHistory();
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
  const selectedIsText = selected !== null && overlays[selected]?.type === "text";
  const activeText = selectedIsText
    ? {
        fontSizePt: (overlays[selected] as Extract<EditOverlay, { type: "text" }>).fontSizePt,
        color: (overlays[selected] as Extract<EditOverlay, { type: "text" }>).color,
      }
    : null;
  const showTextControls = !sheet && (tool === "text" || selectedIsText);
  const sheetChanged = sheet
    ? editOverlayChanged({
        text: sheet.text,
        originalText: sheet.template.originalText,
        sizePt: sheet.sizePt,
        originalSizePt: sheet.template.originalSizePt,
        fontFamily: sheet.fontFamily,
        bold: sheet.bold,
        italic: sheet.italic,
        color: sheet.color,
      })
    : false;

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
          {/* Header: close · title · undo/redo/delete · save */}
          <div className="flex flex-wrap items-center gap-2 border-[3px] border-edge bg-card p-2 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <Button variant="ghost" size="sm" onClick={startOver} aria-label="Start over">
              <X className="size-4" aria-hidden />
            </Button>
            <span className="font-display text-[10px] tracking-wide text-ink uppercase">Edit PDF</span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={undo} disabled={stackSizes.undo === 0} aria-label="Undo">
                <Undo2 className="size-4" aria-hidden />
              </Button>
              <Button variant="secondary" size="sm" onClick={redo} disabled={stackSizes.redo === 0} aria-label="Redo">
                <Redo2 className="size-4" aria-hidden />
              </Button>
              <Button variant="secondary" size="sm" onClick={deleteSelected} disabled={selected === null}>
                <Trash2 className="size-4" aria-hidden />
                Delete
              </Button>
              <Button size="sm" onClick={apply} disabled={!hasEdits}>
                <Save className="size-4" aria-hidden />
                Save
              </Button>
            </div>
          </div>

          {/* Tool selector */}
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
                {entry.id === "whiteout" && <Square className="mr-1 inline size-3.5" aria-hidden />}
                {entry.id === "image" && <ImageIcon className="mr-1 inline size-3.5" aria-hidden />}
                {entry.label}
              </button>
            ))}
          </div>

          {/* Tool options, or the existing-text edit sheet */}
          {sheet ? (
            <div className="space-y-3 border-[3px] border-edge bg-card p-3 shadow-[4px_4px_0_0_var(--color-shadow)]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-[10px] tracking-wide text-ink uppercase">
                  Edit existing text
                </p>
                <Button variant="ghost" size="sm" onClick={() => setSheet(null)} aria-label="Close text editor">
                  <X className="size-4" aria-hidden />
                  Close
                </Button>
              </div>
              <textarea
                autoFocus
                value={sheet.text}
                onChange={(event) => setSheet({ ...sheet, text: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setSheet(null);
                  }
                  event.stopPropagation();
                }}
                rows={2}
                aria-label="Replacement text"
                className="w-full border-[3px] border-edge bg-card p-2 font-body text-lg leading-snug text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none focus:shadow-[3px_3px_0_0_var(--color-brand)]"
              />
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Font" className="w-56">
                  <Select
                    value={sheet.fontFamily}
                    onChange={(event) => setSheet({ ...sheet, fontFamily: event.target.value as FontChoice })}
                  >
                    <option value="original">
                      Original{sheet.template.fontLabel ? ` — ${sheet.template.fontLabel}` : ""}
                    </option>
                    <option value="helvetica">Helvetica</option>
                    <option value="times">Times</option>
                    <option value="courier">Courier</option>
                  </Select>
                </Field>
                <div className="flex items-end gap-1.5">
                  <button
                    type="button"
                    aria-label="Bold"
                    aria-pressed={sheet.bold}
                    onClick={() => setSheet({ ...sheet, bold: !sheet.bold })}
                    className={cn(
                      "h-11 w-11 border-[3px] border-edge font-body text-xl",
                      sheet.bold ? "bg-brand text-on-brand" : "bg-card text-ink",
                    )}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    aria-label="Italic"
                    aria-pressed={sheet.italic}
                    onClick={() => setSheet({ ...sheet, italic: !sheet.italic })}
                    className={cn(
                      "h-11 w-11 border-[3px] border-edge font-body text-xl italic",
                      sheet.italic ? "bg-brand text-on-brand" : "bg-card text-ink",
                    )}
                  >
                    I
                  </button>
                </div>
                <Field label="Color">
                  <input
                    type="color"
                    value={sheet.color}
                    onChange={(event) => setSheet({ ...sheet, color: event.target.value })}
                    aria-label="Text color"
                    className="h-11 w-14 cursor-pointer border-[3px] border-edge bg-card p-1"
                  />
                </Field>
                <Field label="Size">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSheet({ ...sheet, sizePt: clampSizePt(sheet.sizePt - 0.5) })}
                      aria-label="Smaller font"
                    >
                      −
                    </Button>
                    <input
                      type="number"
                      step={0.5}
                      min={4}
                      max={96}
                      value={sheet.sizePt}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (!Number.isNaN(value)) setSheet({ ...sheet, sizePt: clampSizePt(value) });
                      }}
                      aria-label="Font size in points"
                      className="h-9 w-20 border-[3px] border-edge bg-canvas text-center font-body text-lg text-ink focus:border-brand focus:outline-none"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSheet({ ...sheet, sizePt: clampSizePt(sheet.sizePt + 0.5) })}
                      aria-label="Larger font"
                    >
                      +
                    </Button>
                    <span className="font-display text-[9px] tracking-wide text-ink-soft uppercase">pt</span>
                  </div>
                </Field>
                <Button onClick={commitSheet} className="ml-auto">
                  <Check className="size-4" aria-hidden />
                  Done
                </Button>
              </div>
              <p className="text-sm text-ink-soft">
                Drawn with {sheet.template.fontLabel ?? "an unidentified font"} —{" "}
                {sheetChanged ? "your replacement draws over the original." : "no changes yet."}
              </p>
            </div>
          ) : (
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
              {tool === "whiteout" && (
                <Field label="Shape fill">
                  <Select
                    value={rectFill}
                    onChange={(event) => setRectFill(event.target.value)}
                    className="w-44"
                  >
                    <option value="#ffffff">White (white-out)</option>
                    <option value="#111111">Black box</option>
                    <option value="#d61a3c">Red box</option>
                  </Select>
                </Field>
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
                  Tap existing text to rewrite it. Click your own elements to select — drag to move,
                  double-click text to edit, Delete key removes.
                </p>
              )}
              {tool === "highlight" && <p className="text-sm text-ink-soft">Drag a rectangle over the text to highlight.</p>}
              {tool === "whiteout" && <p className="text-sm text-ink-soft">Drag a rectangle to cover content.</p>}
            </div>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}
          {editorError && <JobError message={editorError} />}

          {/* Page + zoom navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 border-[3px] border-edge bg-card p-1 shadow-[3px_3px_0_0_var(--color-shadow)]">
              <Button
                variant="ghost"
                size="sm"
                disabled={current === 0}
                onClick={() => {
                  setCurrent((c) => Math.max(0, c - 1));
                  setSelected(null);
                  setEditingText(null);
                }}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <span className="px-1 font-display text-[10px] tracking-wide text-ink">
                Page {current + 1} of {pageCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={current >= pageCount - 1}
                onClick={() => {
                  setCurrent((c) => Math.min(pageCount - 1, c + 1));
                  setSelected(null);
                  setEditingText(null);
                }}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
            <div className="flex items-center gap-1 border-[3px] border-edge bg-card p-1 shadow-[3px_3px_0_0_var(--color-shadow)]">
              <Button variant="ghost" size="sm" onClick={() => setZoom((z) => clampZoom(z - 0.1))} aria-label="Zoom out">
                <Minus className="size-4" aria-hidden />
              </Button>
              <span className="w-12 text-center font-display text-[10px] tracking-wide text-ink">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="ghost" size="sm" onClick={() => setZoom((z) => clampZoom(z + 0.1))} aria-label="Zoom in">
                <Plus className="size-4" aria-hidden />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setZoom(1)} aria-label="Reset zoom">
                <RotateCcw className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          {/* Editor: thumbnail rail + page */}
          <div className="flex gap-3">
            {/* Thumbnail rail (hidden on phones — page pill navigates) */}
            <div className="hidden max-h-[560px] w-24 shrink-0 space-y-2 overflow-y-auto border-[3px] border-edge bg-canvas p-2 sm:block">
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

            {/* Page + overlays (scrollable when zoomed) */}
            <div ref={wrapRef} className="min-w-0 flex-1">
              <div className="max-h-[70vh] overflow-auto">
                <div
                  className="relative select-none"
                  style={{ width: `${zoom * 100}%` }}
                  onClick={onWrapperClick}
                >
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
                  {/* DOM overlay elements: text, edits, rects, images */}
                  {overlays.map((overlay, index) => {
                    if (overlay.page !== current || overlay.type === "ink") return null;
                    const isSelected = selected === index;
                    const base = cn(
                      "absolute",
                      interactiveFor(tool, overlay) ? (overlay.type === "text" ? "cursor-text" : "cursor-move") : "pointer-events-none",
                      isSelected && "outline outline-[3px] outline-brand",
                    );
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
                          onPointerUp={() => {
                            const moved = moveState.current?.moved ?? false;
                            elementPointerUp();
                            if (!moved) onTextBoxClick(index);
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
                    if (overlay.type === "edit") {
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
                          }}
                          className={cn(base, "border-2 border-dashed border-red-600 bg-red-500/5")}
                          onPointerDown={(event) => elementPointerDown(event, index)}
                          onPointerMove={elementPointerMove}
                          onPointerUp={() => {
                            const moved = moveState.current?.moved ?? false;
                            elementPointerUp();
                            if (!moved) onEditOverlayClick(index);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") onEditOverlayClick(index);
                          }}
                          aria-label={`Text edit: ${overlay.originalText}`}
                          title="Click to re-edit this text"
                        />
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
                            backgroundColor:
                              overlay.type === "highlight" ? "rgba(255, 235, 59, 0.45)" : overlay.fill ?? "#ffffff",
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
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              {hasEdits
                ? `${overlays.length} edit${overlays.length === 1 ? "" : "s"} queued — Save bakes them in permanently.`
                : "Tap existing text to rewrite it, or pick a tool and click the page."}
            </p>
            <p className="font-display text-[10px] text-ink uppercase">
              {selected !== null ? "Element selected" : `${Math.round(zoom * 100)}% zoom`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />
          <p className="text-sm text-ink-soft">
            Rewrite existing text, add new text, draw, highlight, white-out and stamp images directly
            on the page — everything happens locally and bakes in permanently.
          </p>
        </div>
      )}
    </ToolWidget>
  );
}

/** Which overlays respond to the pointer for the active tool. */
function interactiveFor(tool: EditTool | "select", overlay: EditOverlay): boolean {
  if (tool === "select") return true;
  if (tool === "text") return overlay.type === "text" || overlay.type === "edit";
  return false;
}
