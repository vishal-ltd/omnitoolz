"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, RangeInput, Select } from "@/components/ui/form";
import { bytesToBlob } from "@/lib/utils";
import { findInkBounds } from "./page-analysis";

interface Shot {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

const PAGE_SIZES: Record<string, { label: string; pt: [number, number] }> = {
  auto: { label: "Fit each shot", pt: [0, 0] },
  a4: { label: "A4 portrait", pt: [595.28, 841.89] },
  letter: { label: "Letter portrait", pt: [612, 792] },
};

export default function CameraScanPdfTool() {
  const { state, start, reset } = useJob();
  const [shots, setShots] = useState<Shot[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [pageSize, setPageSize] = useState("auto");
  const [marginMm, setMarginMm] = useState(0);
  const [autoTrim, setAutoTrim] = useState(true);
  const [enhance, setEnhance] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 2560 }, height: { ideal: 1440 } },
      });
      streamRef.current = stream;
      setCameraOn(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
    } catch {
      setCameraError(
        "Camera access isn't available — allow it in the browser, or use “JPG to PDF” with photos you've already taken.",
      );
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { alpha: false })!;
    // Mirror like a selfie when facing the user; environment cameras draw as-is.
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setShots((current) => [
          ...current,
          { blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height },
        ]);
      },
      "image/jpeg",
      0.92,
    );
  }

  /** Draw a shot with optional document enhance (grayscale + contrast) and
      auto-trim to the content's ink bounds (works best on plain surfaces). */
  async function transformShot(shot: Shot, doTrim: boolean, doEnhance: boolean): Promise<Shot> {
    if (!doTrim && !doEnhance) return shot;
    const bitmap = await createImageBitmap(shot.blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { alpha: false })!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (doEnhance) {
      context.filter = "grayscale(1) contrast(1.35) brightness(1.08)";
    }
    context.drawImage(bitmap, 0, 0);
    context.filter = "none";

    let crop = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    if (doTrim) {
      const bounds = findInkBounds(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
        232,
      );
      if (bounds) {
        const pad = Math.round(Math.min(canvas.width, canvas.height) * 0.015);
        crop = {
          x: Math.max(0, bounds.left - pad),
          y: Math.max(0, bounds.top - pad),
          width: Math.min(canvas.width, bounds.right - bounds.left + pad * 2),
          height: Math.min(canvas.height, bounds.bottom - bounds.top + pad * 2),
        };
      }
    }

    const out = document.createElement("canvas");
    out.width = crop.width;
    out.height = crop.height;
    out.getContext("2d", { alpha: false })!.drawImage(
      canvas,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return shot;
    return { blob, url: shot.url, width: crop.width, height: crop.height };
  }

  function buildPdf(shotsToUse: Shot[], sizeKey: string, margin: number) {
    return start(async ({ report }) => {
      report("Building the PDF…", 0.7);
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      const mm = (value: number) => (value * 72) / 25.4;

      for (const [index, rawShot] of shotsToUse.entries()) {
        report(
          `Processing page ${index + 1} of ${shotsToUse.length}…`,
          (index + 0.5) / shotsToUse.length,
        );
        const shot = await transformShot(rawShot, autoTrim, enhance);
        report(`Embedding page ${index + 1} of ${shotsToUse.length}…`, (index + 1) / shotsToUse.length);
        const jpeg = await doc.embedJpg(await shot.blob.arrayBuffer());
        const fixed = PAGE_SIZES[sizeKey].pt;
        const [pageW, pageH] = fixed[0] > 0 ? fixed : [jpeg.width, jpeg.height];
        const page = doc.addPage([pageW, pageH]);
        const inset = mm(margin);
        const availW = pageW - inset * 2;
        const availH = pageH - inset * 2;
        const scale = Math.min(availW / jpeg.width, availH / jpeg.height);
        const drawW = jpeg.width * scale;
        const drawH = jpeg.height * scale;
        page.drawImage(jpeg, {
          x: (pageW - drawW) / 2,
          y: (pageH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }
      const bytes = await doc.save();
      return [
        {
          name: `camera-scan-${new Date().toISOString().slice(0, 10)}.pdf`,
          blob: bytesToBlob(bytes, "application/pdf"),
        },
      ];
    }, "Building the PDF…");
  }

  function startOver() {
    shots.forEach((shot) => URL.revokeObjectURL(shot.url));
    setShots([]);
    reset();
  }

  return (
    <ToolWidget>
      {state.phase === "done" && state.results.length > 0 ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          note={`${shots.length} page${shots.length === 1 ? "" : "s"} captured on this device.`}
          onReset={startOver}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          {!cameraOn && (
            <div className="space-y-3">
              <Button size="lg" onClick={startCamera}>
                <Camera className="size-4" aria-hidden />
                Open camera
              </Button>
              <p className="text-sm text-ink-soft">
                Frames never leave your device — the PDF is assembled locally from the shots you keep.
              </p>
            </div>
          )}

          {cameraError && (
            <div className="border-[3px] border-warn bg-warn-soft p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
              <p className="font-body text-lg text-ink">{cameraError}</p>
            </div>
          )}

          {cameraOn && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                className="w-full border-[3px] border-edge bg-black shadow-[4px_4px_0_0_var(--color-shadow)]"
                playsInline
                muted
              />
              <div className="flex flex-wrap gap-3">
                <Button onClick={capture}>Capture page</Button>
                <Button variant="secondary" onClick={stopCamera}>
                  Close camera
                </Button>
              </div>
            </div>
          )}

          {shots.length > 0 && (
            <>
              <p className="font-display text-[10px] text-ink uppercase">
                {shots.length} {shots.length === 1 ? "shot" : "shots"} — drag order coming via the file list
              </p>
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {shots.map((shot, index) => (
                  <li key={shot.url} className="relative animate-pixel-in border-[3px] border-edge bg-white shadow-[3px_3px_0_0_var(--color-shadow)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.url} alt={`Shot ${index + 1}`} className="w-full" />
                    <span className="absolute -top-2 -left-2 border-[3px] border-edge bg-brand px-1.5 py-0.5 font-display text-[8px] text-on-brand">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(shot.url);
                        setShots((current) => current.filter((_, i) => i !== index));
                      }}
                      className="absolute -bottom-2 -right-2 border-[3px] border-edge bg-card p-1 text-err shadow-[2px_2px_0_0_var(--color-shadow)]"
                      aria-label={`Delete shot ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>

              {state.phase === "error" && <JobError message={state.error ?? ""} />}

              <Button size="lg" onClick={() => buildPdf(shots, pageSize, marginMm)}>
                Build PDF ({shots.length} {shots.length === 1 ? "page" : "pages"})
              </Button>
            </>
          )}

          {shots.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Checkbox checked={enhance} onChange={setEnhance} label="Document enhance (grayscale + contrast)" />
                <Checkbox checked={autoTrim} onChange={setAutoTrim} label="Auto-trim borders (works on plain surfaces)" />
              </div>
              <Field label="Page size">
                <Select value={pageSize} onChange={(event) => setPageSize(event.target.value)} aria-label="Page size">
                  {Object.entries(PAGE_SIZES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Margin — ${marginMm} mm`}>
                <RangeInput value={marginMm} min={0} max={40} onChange={setMarginMm} suffix="mm" />
              </Field>
            </div>
          )}
        </div>
      )}
    </ToolWidget>
  );
}
