"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Trash2 } from "lucide-react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { suffixedName } from "@/lib/utils";
import { loadPdf, savePdf } from "./pdf-core";
import { renderPageThumbnails, type RenderedPage } from "./pdf-thumbnails";

interface PageState {
  /** Index of the source page this card shows. */
  sourceIndex: number;
  /** Rotation delta applied on top of the original page rotation. */
  delta: number;
}

type Phase = "idle" | "thumbs" | "editing" | "running" | "done";

export default function OrganizePdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state: job, start, reset } = useJob();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pages, setPages] = useState<PageState[]>([]);
  const [thumbs, setThumbs] = useState<Map<number, RenderedPage>>(new Map());
  const [thumbProgress, setThumbProgress] = useState({ done: 0, total: 0 });
  const [thumbError, setThumbError] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  useEffect(() => {
    if (!file) return;
    const controller = new AbortController();
    setPhase("thumbs");
    setPages([]);
    setThumbs(new Map());
    setThumbProgress({ done: 0, total: 0 });

    renderPageThumbnails(file, {
      signal: controller.signal,
      onPage: (rendered) => {
        setThumbs((current) => new Map(current).set(rendered.pageNumber, rendered));
        setPages((current) => [...current, { sourceIndex: rendered.pageNumber - 1, delta: 0 }]);
        setThumbProgress((p) => ({ done: p.done + 1, total: p.total }));
      },
    })
      .then(({ pageCount }) => {
        setThumbProgress({ done: pageCount, total: pageCount });
        setPhase("editing");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const err = error instanceof Error ? error : new Error(String(error));
        setThumbError(
          err.name === "PasswordException"
            ? `“${file.name}” is password-protected. Unlock it first — protected PDFs can't be organized.`
            : err.message,
        );
        setPhase("idle");
      });

    return () => controller.abort();
    // Re-run when a different file is picked.
     
  }, [file]);

  const move = useCallback((from: number, to: number) => {
    setPages((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  // ── Touch drag: long-press a card, then drag across other cards to
  // reorder. Mouse pointers keep the native HTML5 drag path instead.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  function pointerDown(event: React.PointerEvent<HTMLLIElement>, index: number) {
    if (event.pointerType === "mouse") return;
    pressStart.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = window.setTimeout(() => {
      pressStart.current = null;
      didDragRef.current = true;
      setDragIndex(index);
      event.currentTarget.setPointerCapture(event.pointerId);
    }, 160);
  }

  function pointerMove(event: React.PointerEvent<HTMLLIElement>) {
    if (pressTimer.current !== null && pressStart.current) {
      const dx = event.clientX - pressStart.current.x;
      const dy = event.clientY - pressStart.current.y;
      // The finger moved early — it's a scroll, not a drag.
      if (Math.hypot(dx, dy) > 8) {
        window.clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
      return;
    }
    if (dragIndex === null) return;
    event.preventDefault();
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest("li[data-index]");
    const target = hit ? Number((hit as HTMLElement).dataset.index) : NaN;
    if (Number.isFinite(target) && target !== dragIndex) {
      move(dragIndex, target);
      setDragIndex(target);
    }
  }

  function pointerEnd() {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
    if (dragIndex !== null) {
      setDragIndex(null);
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 250);
    }
  }

  /** Ignore the click that follows right after a touch drag. */
  function guarded(action: () => void) {
    return () => {
      if (didDragRef.current) return;
      action();
    };
  }

  function rotate(index: number) {
    setPages((current) =>
      current.map((page, i) => (i === index ? { ...page, delta: (page.delta + 90) % 360 } : page)),
    );
  }

  function remove(index: number) {
    setPages((current) => current.filter((_, i) => i !== index));
  }

  function handleDrop(target: number) {
    if (dragFrom.current === null) return;
    move(dragFrom.current, target);
    dragFrom.current = null;
  }

  async function apply() {
    const source = file!;
    const order = pages;
    await start(async ({ report }) => {
      report("Building the new document…", 0.7);
      const { PDFDocument, degrees } = await import("pdf-lib");
      const original = await loadPdf(source);
      const doc = await PDFDocument.create();
      const copied = await doc.copyPages(
        original,
        order.map((page) => page.sourceIndex),
      );
      copied.forEach((page, index) => {
        page.setRotation(degrees((page.getRotation().angle + order[index].delta) % 360));
        doc.addPage(page);
      });
      return [await savePdf(doc, suffixedName(source.name, "-organized"))];
    }, "Applying changes…");
  }

  function startOver() {
    queue.clear();
    setPages([]);
    setThumbs(new Map());
    setPhase("idle");
    reset();
  }

  const changed = pages.length !== thumbProgress.total || pages.some((page) => page.delta !== 0);

  return (
    <ToolWidget>
      {job.phase === "done" ? (
        <Results
          results={job.results}
          elapsedMs={job.elapsedMs}
          note={`${pages.length} ${pages.length === 1 ? "page" : "pages"} in the new order.`}
          onReset={startOver}
        />
      ) : job.phase === "running" ? (
        <JobProgress state={job} />
      ) : phase === "thumbs" ? (
        <div className="space-y-4">
          <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <p className="font-display text-[10px] text-ink uppercase">Drawing page thumbnails…</p>
            <div className="mt-3 h-5 border-[3px] border-edge bg-canvas">
              <div
                className="pixel-stripes-ok h-full transition-[width]"
                style={{
                  width: thumbProgress.total ? `${(thumbProgress.done / thumbProgress.total) * 100}%` : "8%",
                }}
              />
            </div>
            <p className="mt-2 font-body text-lg text-ink-soft">
              {thumbProgress.done} pages rendered…
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {[...thumbs.values()].map((thumb) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={thumb.pageNumber}
                src={thumb.dataUrl}
                alt=""
                className="animate-pixel-in border-[3px] border-edge bg-white shadow-[3px_3px_0_0_var(--color-shadow)]"
                style={{ aspectRatio: `1 / ${thumb.aspect}` }}
              />
            ))}
          </div>
        </div>
      ) : phase === "editing" && file ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-[10px] text-ink uppercase">
              {pages.length} {pages.length === 1 ? "page" : "pages"} — drag to reorder
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={startOver}>
                Reset
              </Button>
            </div>
          </div>

          {job.phase === "error" && <JobError message={job.error ?? ""} />}

          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {pages.map((page, index) => {
              const thumb = thumbs.get(page.sourceIndex + 1);
              return (
                <li
                  key={page.sourceIndex}
                  data-index={index}
                  draggable
                  onDragStart={() => {
                    dragFrom.current = index;
                  }}
                  onDragOver={(event: DragEvent) => event.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  onPointerDown={(event) => pointerDown(event, index)}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerEnd}
                  onPointerCancel={pointerEnd}
                  className={`group relative animate-pixel-in cursor-grab border-[3px] border-edge bg-white shadow-[3px_3px_0_0_var(--color-shadow)] select-none [-webkit-touch-callout:none] active:cursor-grabbing ${
                    dragIndex === index ? "z-10 border-brand shadow-[0_0_0_3px_var(--color-brand)]" : ""
                  } ${dragIndex !== null ? "pointer-events-auto" : ""}`}
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  aria-label={`Page ${page.sourceIndex + 1}, position ${index + 1}`}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb.dataUrl}
                      alt={`Page ${page.sourceIndex + 1}`}
                      className="w-full"
                      style={{
                        aspectRatio: `1 / ${thumb.aspect}`,
                        transform: `rotate(${page.delta}deg)`,
                      }}
                    />
                  ) : (
                    <div className="aspect-[1/1.414] bg-canvas" />
                  )}
                  <span className="absolute -top-2 -left-2 border-[3px] border-edge bg-brand px-1.5 py-0.5 font-display text-[8px] text-on-brand">
                    {index + 1}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 border-t-[3px] border-edge bg-card/95 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={guarded(() => move(index, index - 1))}
                      disabled={index === 0}
                      className="border-[2px] border-edge bg-canvas p-1 hover:bg-dither disabled:opacity-40"
                      aria-label={`Move page ${page.sourceIndex + 1} earlier`}
                    >
                      <ArrowLeft className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={guarded(() => rotate(index))}
                      className="border-[2px] border-edge bg-canvas p-1 hover:bg-dither"
                      aria-label={`Rotate page ${page.sourceIndex + 1}`}
                    >
                      <RotateCw className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={guarded(() => remove(index))}
                      className="border-[2px] border-edge bg-canvas p-1 text-err hover:bg-dither"
                      aria-label={`Delete page ${page.sourceIndex + 1}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={guarded(() => move(index, index + 1))}
                      disabled={index === pages.length - 1}
                      className="border-[2px] border-edge bg-canvas p-1 hover:bg-dither disabled:opacity-40"
                      aria-label={`Move page ${page.sourceIndex + 1} later`}
                    >
                      <ArrowRight className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {pages.length === 0 ? "Every page is deleted — add one back or reset." : changed ? "Ready to build the new document." : "Reorder, rotate or delete — changes apply on build."}
            </p>
            <Button size="lg" disabled={pages.length === 0} onClick={apply}>
              Apply Changes
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />
          {thumbError && <JobError message={thumbError} />}
          {job.phase === "error" && <JobError message={job.error ?? ""} />}
          <p className="text-sm text-ink-soft">
            Thumbnails are rendered locally — big scans may take a moment.
          </p>
        </div>
      )}
    </ToolWidget>
  );
}
