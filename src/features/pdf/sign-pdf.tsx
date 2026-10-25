"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PenLine, Type } from "lucide-react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, RangeInput, TextInput } from "@/components/ui/form";
import { suffixedName } from "@/lib/utils";
import { loadPdf, savePdf } from "./pdf-core";
import { renderPageThumbnails, type RenderedPage } from "./pdf-thumbnails";

type SigMode = "draw" | "type";
interface Placement {
  pageIndex: number;
  xPct: number;
  yPct: number;
}

const CANVAS_W = 600;
const CANVAS_H = 200;

export default function SignPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [sigMode, setSigMode] = useState<SigMode>("draw");
  const [typedName, setTypedName] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [sizePct, setSizePct] = useState(30);
  const [everyPage, setEveryPage] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [sigPreview, setSigPreview] = useState<string | null>(null);

  // Keep a lightweight preview of the pad for placement markers.
  const [inkVersion, setInkVersion] = useState(0);
  useEffect(() => {
    if (!hasInk) {
      setSigPreview(null);
      return;
    }
    const timer = window.setTimeout(() => {
      const canvas = sigCanvasRef.current;
      if (canvas) setSigPreview(canvas.toDataURL("image/png"));
    }, 150);
    return () => window.clearTimeout(timer);
  }, [hasInk, typedName, sigMode, inkVersion]);

  useHandoffFile(queue.addFiles, queue.files.length > 0);
  const file = queue.files[0];

  // ── Load page previews ───────────────────────────────────────────
  useEffect(() => {
    if (!file) {
      setPages([]);
      setPlacement(null);
      return;
    }
    const controller = new AbortController();
    setLoadingPages(true);
    setPages([]);
    setPlacement(null);
    renderPageThumbnails(file, {
      signal: controller.signal,
      targetWidth: 420,
      onPage: (page) => setPages((current) => [...current, page]),
    })
      .catch(() => controller.signal.aborted || void 0)
      .finally(() => setLoadingPages(false));
    return () => controller.abort();
  }, [file]);

  // ── Signature canvas ─────────────────────────────────────────────
  const resetCanvas = useCallback(() => {
    const canvas = sigCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }, []);

  useEffect(() => {
    resetCanvas();
  }, [resetCanvas]);

  // Re-render typed signature into the canvas when the name changes.
  useEffect(() => {
    if (sigMode !== "type") return;
    const canvas = sigCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const text = typedName.trim();
    setHasInk(text.length > 0);
    if (!text) return;
    context.fillStyle = "#1a1a2e";
    let size = 110;
    do {
      context.font = `italic ${size}px Georgia, "Times New Roman", serif`;
      size -= 6;
    } while (context.measureText(text).width > CANVAS_W - 60 && size > 30);
    context.textBaseline = "middle";
    context.fillText(text, 30, CANVAS_H / 2 + 6);
  }, [typedName, sigMode]);

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (sigMode !== "draw") return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d")!;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_H;
    context.beginPath();
    context.moveTo(x, y);
    setHasInk(true);
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || sigMode !== "draw") return;
    const context = event.currentTarget.getContext("2d")!;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_H;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#1a1a2e";
    context.lineTo(x, y);
    context.stroke();
  }

  function pointerUp() {
    if (drawing.current) setInkVersion((version) => version + 1);
    drawing.current = false;
  }

  // ── Placement ────────────────────────────────────────────────────
  function placeOnPage(event: ReactPointerEvent<HTMLImageElement>, pageIndex: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPlacement({
      pageIndex,
      xPct: (event.clientX - rect.left) / rect.width,
      yPct: (event.clientY - rect.top) / rect.height,
    });
  }

  // ── Build the signed PDF ─────────────────────────────────────────
  async function sign() {
    const source = file!;
    const target = placement ?? { pageIndex: 0, xPct: 0.5, yPct: 0.75 };
    await start(async ({ report }) => {
      report("Embedding your signature…", 0.6);
      const canvas = sigCanvasRef.current!;
      const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!pngBlob) throw new Error("The signature canvas couldn't be exported — draw again.");

      const { PDFDocument } = await import("pdf-lib");
      const doc = await loadPdf(source);
      const png = await doc.embedPng(await pngBlob.arrayBuffer());

      const targets = everyPage ? doc.getPageIndices() : [target.pageIndex];
      for (const index of targets) {
        const page = doc.getPage(index);
        const { width, height } = page.getSize();
        const sigWidth = (sizePct / 100) * width;
        const sigHeight = sigWidth * (CANVAS_H / CANVAS_W);
        const x = target.xPct * width - sigWidth / 2;
        const y = height - target.yPct * height - sigHeight / 2;
        page.drawImage(png, {
          x: Math.max(4, Math.min(x, width - sigWidth - 4)),
          y: Math.max(4, Math.min(y, height - sigHeight - 4)),
          width: sigWidth,
          height: sigHeight,
        });
      }
      return [await savePdf(doc, suffixedName(source.name, "-signed"))];
    }, "Signing the document…");
  }

  const readyToSign = Boolean(file && hasInk && placement) || Boolean(file && hasInk && everyPage);

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          note="Signature baked into the page — it's ordinary page content now."
          onReset={() => {
            queue.clear();
            setPages([]);
            setPlacement(null);
            reset();
            resetCanvas();
            setTypedName("");
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {file && (
            <>
              <OptionsPanel title="Your signature">
                <div className="flex gap-2 sm:col-span-2">
                  {(["draw", "type"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={sigMode === mode}
                      onClick={() => setSigMode(mode)}
                      className={`flex items-center gap-2 border-[3px] border-edge px-4 py-2 font-display text-[9px] uppercase shadow-[3px_3px_0_0_var(--color-shadow)] ${
                        sigMode === mode ? "bg-brand text-on-brand" : "bg-card text-ink-soft"
                      }`}
                    >
                      {mode === "draw" ? <PenLine className="size-3.5" aria-hidden /> : <Type className="size-3.5" aria-hidden />}
                      {mode === "draw" ? "Draw it" : "Type it"}
                    </button>
                  ))}
                </div>
                {sigMode === "type" && (
                  <Field label="Name as it should appear" className="sm:col-span-2">
                    <TextInput
                      value={typedName}
                      onChange={(event) => setTypedName(event.target.value)}
                      placeholder="A. Developer"
                      aria-label="Typed signature name"
                    />
                  </Field>
                )}
                <div className="sm:col-span-2">
                  <canvas
                    ref={sigCanvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    onPointerDown={pointerDown}
                    onPointerMove={pointerMove}
                    onPointerUp={pointerUp}
                    onPointerCancel={pointerUp}
                    className="w-full touch-none border-[3px] border-edge bg-white shadow-[4px_4px_0_0_var(--color-shadow)]"
                    aria-label="Signature canvas"
                  />
                  {sigMode === "draw" && (
                    <Button variant="secondary" size="sm" onClick={resetCanvas} className="mt-2">
                      Clear pad
                    </Button>
                  )}
                </div>
                <Field label={`Signature width — ${sizePct}% of the page`}>
                  <RangeInput value={sizePct} min={10} max={70} onChange={setSizePct} suffix="%" />
                </Field>
                <div className="flex items-end">
                  <Checkbox checked={everyPage} onChange={setEveryPage} label="Stamp every page" />
                </div>
              </OptionsPanel>

              <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
                <p className="font-display text-[9px] text-ink uppercase">
                  Tap where the signature should go
                  {placement && !everyPage && ` — page ${placement.pageIndex + 1}`}
                </p>
                {loadingPages && (
                  <p className="mt-2 font-body text-lg text-ink-soft">Drawing page previews…</p>
                )}
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {pages.map((page) => (
                    <div key={page.pageNumber} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={page.dataUrl}
                        alt={`Page ${page.pageNumber}`}
                        className={`block w-full cursor-crosshair border-[3px] border-edge bg-white shadow-[3px_3px_0_0_var(--color-shadow)] ${
                          placement?.pageIndex === page.pageNumber - 1 && !everyPage ? "outline outline-[3px] outline-brand" : ""
                        }`}
                        onPointerDown={(event) => placeOnPage(event, page.pageNumber - 1)}
                      />
                      {placement && (placement.pageIndex === page.pageNumber - 1 || everyPage) && sigPreview && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={sigPreview}
                          alt=""
                          className="pointer-events-none absolute border-2 border-dashed border-brand/70"
                          style={{
                            left: `calc(${placement.xPct * 100}% - ${sizePct / 2}%)`,
                            top: `calc(${placement.yPct * 100}% - ${sizePct / 3 / 2}%)`,
                            width: `${sizePct}%`,
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {state.phase === "error" && <JobError message={state.error ?? ""} />}

              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-ink-soft">
                  {hasInk
                    ? placement || everyPage
                      ? "Looks ready — apply and download."
                      : "Now tap the page where it goes."
                    : sigMode === "draw"
                      ? "Sign inside the white pad above."
                      : "Type your name above."}
                </p>
                <Button size="lg" disabled={!readyToSign} onClick={sign}>
                  Sign PDF
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </ToolWidget>
  );
}
