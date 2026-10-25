"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brush, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, RangeInput } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/**
 * Touch-up editor for background-removal results: erase (paint transparency)
 * or restore (bring back pixels from the original image), with a size slider.
 * All painting happens on a full-resolution offscreen canvas; the visible
 * canvas is a scaled view.
 */
export function BgTouchUp({
  originalFile,
  cutoutBlob,
  fileName,
  onDone,
  onCancel,
}: {
  originalFile: File;
  cutoutBlob: Blob;
  fileName: string;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"erase" | "restore">("erase");
  const [brush, setBrush] = useState(30);
  const [showOriginal, setShowOriginal] = useState(false);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const cutoutRef = useRef<HTMLCanvasElement | null>(null);
  const originalRef = useRef<HTMLCanvasElement | null>(null);
  const painting = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const repaint = useCallback(() => {
    const view = viewRef.current;
    const cutout = cutoutRef.current;
    if (!view || !cutout) return;
    view.width = cutout.width;
    view.height = cutout.height;
    const context = view.getContext("2d")!;
    context.clearRect(0, 0, view.width, view.height);
    if (showOriginal && originalRef.current) {
      context.drawImage(originalRef.current, 0, 0);
    }
    context.drawImage(cutout, 0, 0);
  }, [showOriginal]);

  // Load the original + cutout images once; repaint as the peek toggle changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [originalBitmap, cutoutBitmap] = await Promise.all([
        createImageBitmap(originalFile),
        createImageBitmap(cutoutBlob),
      ]);
      if (cancelled) return;
      const originalCanvas = document.createElement("canvas");
      originalCanvas.width = originalBitmap.width;
      originalCanvas.height = originalBitmap.height;
      originalCanvas.getContext("2d")!.drawImage(originalBitmap, 0, 0);
      originalRef.current = originalCanvas;

      const cutoutCanvas = document.createElement("canvas");
      cutoutCanvas.width = cutoutBitmap.width;
      cutoutCanvas.height = cutoutBitmap.height;
      cutoutCanvas.getContext("2d")!.drawImage(cutoutBitmap, 0, 0);
      cutoutRef.current = cutoutCanvas;
      repaint();
    })();
    return () => {
      cancelled = true;
    };
  }, [originalFile, cutoutBlob]);

  // Re-composite when the peek-original toggle changes.
  useEffect(() => {
    repaint();
  }, [repaint]);




  // Re-composite when the "peek original" toggle changes.
  useEffect(() => {
    repaint();
  }, [repaint]);

  function paintAt(clientX: number, clientY: number) {
    const view = viewRef.current;
    const cutout = cutoutRef.current;
    const original = originalRef.current;
    if (!view || !cutout || !original) return;
    const rect = view.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * cutout.width;
    const y = ((clientY - rect.top) / rect.height) * cutout.height;
    const radius = (brush / 100) * Math.max(cutout.width, cutout.height) * 0.12;
    const context = cutout.getContext("2d")!;

    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.clip();
    if (mode === "erase") {
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "#000";
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    } else {
      context.drawImage(original, 0, 0);
    }
    context.restore();

    // Draw the same stamp into the visible canvas (same coordinates).
    const viewContext = view.getContext("2d")!;
    viewContext.save();
    viewContext.beginPath();
    viewContext.arc(x, y, radius, 0, Math.PI * 2);
    viewContext.clip();
    if (mode === "erase") {
      viewContext.globalCompositeOperation = "destination-out";
      viewContext.fillStyle = "#000";
      viewContext.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    } else {
      viewContext.drawImage(original, 0, 0);
    }
    viewContext.restore();
  }

  function pointerMove(clientX: number, clientY: number) {
    if (!painting.current) return;
    // Interpolate between the last point for smooth strokes.
    const last = lastPoint.current;
    if (last) {
      const dx = clientX - last.x;
      const dy = clientY - last.y;
      const distance = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.floor(distance / 8));
      for (let i = 1; i <= steps; i++) {
        paintAt(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
      }
    } else {
      paintAt(clientX, clientY);
    }
    lastPoint.current = { x: clientX, y: clientY };
  }

  async function apply() {
    const cutout = cutoutRef.current;
    if (!cutout) return;
    const blob = await new Promise<Blob | null>((resolve) => cutout.toBlob(resolve, "image/png"));
    if (blob) onDone(blob);
  }

  return (
    <div className="space-y-3 border-[3px] border-brand bg-brand-soft/40 p-3">
      <p className="font-display text-[10px] text-ink uppercase">Touch up</p>
      <canvas
        ref={viewRef}
        className="w-full touch-none border-[3px] border-edge bg-dither"
        onPointerDown={(event) => {
          painting.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          paintAt(event.clientX, event.clientY);
          lastPoint.current = null;
        }}
        onPointerMove={(event) => pointerMove(event.clientX, event.clientY)}
        onPointerUp={() => {
          painting.current = false;
          lastPoint.current = null;
        }}
        onPointerCancel={() => {
          painting.current = false;
        }}
        aria-label="Touch-up canvas"
      />
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={mode === "erase"}
            onClick={() => setMode("erase")}
            className={cn(
              "flex items-center gap-2 border-[3px] border-edge px-3 py-2 font-display text-[9px] uppercase shadow-[3px_3px_0_0_var(--color-shadow)]",
              mode === "erase" ? "bg-brand text-on-brand" : "bg-card text-ink-soft",
            )}
          >
            <Eraser className="size-3.5" aria-hidden />
            Erase
          </button>
          <button
            type="button"
            aria-pressed={mode === "restore"}
            onClick={() => setMode("restore")}
            className={cn(
              "flex items-center gap-2 border-[3px] border-edge px-3 py-2 font-display text-[9px] uppercase shadow-[3px_3px_0_0_var(--color-shadow)]",
              mode === "restore" ? "bg-brand text-on-brand" : "bg-card text-ink-soft",
            )}
          >
            <Brush className="size-3.5" aria-hidden />
            Restore
          </button>
        </div>
        <Field label={`Brush — ${brush}`}>
          <RangeInput value={brush} min={5} max={100} onChange={setBrush} suffix="px" />
        </Field>
        <div className="flex items-end pb-1">
          <Checkbox checked={showOriginal} onChange={setShowOriginal} label="Peek original" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={apply}>
          Apply & download
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
