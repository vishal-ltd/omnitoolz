"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { baseName, bytesToBlob, type ResultFile } from "@/lib/utils";
import { sanitize } from "./convert-core";

/** Landscape 16:9 slide pages (10in × 5.625in). */
const SLIDE_PAGE = { width: 720, height: 405, margin: 40 };

interface SlideText {
  title: string;
  paragraphs: string[];
}

/** Minimal OOXML slide parser: title placeholder + body paragraphs. */
function parseSlideXml(xml: string): SlideText {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const title: string[] = [];
  const paragraphs: string[] = [];

  const shapes = doc.getElementsByTagName("p:sp");
  for (const shape of Array.from(shapes)) {
    const isTitle = [...shape.getElementsByTagName("p:ph")].some((ph) => {
      const type = ph.getAttribute("type");
      return type === "title" || type === "ctrTitle";
    });
    const shapeParas: string[] = [];
    for (const para of Array.from(shape.getElementsByTagName("a:p"))) {
      const runs = [...para.getElementsByTagName("a:t")].map((t) => t.textContent ?? "").join("");
      const clean = sanitize(runs).trim();
      if (clean) shapeParas.push(clean);
    }
    if (shapeParas.length === 0) continue;
    if (isTitle && title.length === 0) title.push(...shapeParas);
    else paragraphs.push(...shapeParas);
  }

  // No title placeholder — promote the first paragraph if it looks short.
  let slideTitle = title.join(" — ");
  if (!slideTitle && paragraphs.length > 0 && paragraphs[0].length <= 80) {
    slideTitle = paragraphs.shift() ?? "";
  }
  return { title: slideTitle, paragraphs };
}

export default function PptxToPdfTool() {
  const queue = useFileQueue({ accept: ["pptx"], multiple: true, maxFiles: 5, maxSizeMb: 50 });
  const { state, start, reset } = useJob();
  const [slideSummary, setSlideSummary] = useState<string | null>(null);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  async function convert() {
    const sources = queue.files;
    setSlideSummary(null);
    await start(async ({ report }) => {
      const { unzipSync } = await import("fflate");
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const results: ResultFile[] = [];

      for (const [fileIndex, source] of sources.entries()) {
        report(`Unpacking “${source.name}”…`, (fileIndex + 0.1) / sources.length);
        const zip = unzipSync(new Uint8Array(await source.arrayBuffer()));

        // Slides in numeric order
        const slideEntries = Object.keys(zip)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .sort((a, b) => {
            const na = Number(/slide(\d+)\.xml/.exec(a)?.[1] ?? 0);
            const nb = Number(/slide(\d+)\.xml/.exec(b)?.[1] ?? 0);
            return na - nb;
          });
        if (slideEntries.length === 0) {
          throw new Error(`“${source.name}” contains no slides — is it a valid .pptx deck?`);
        }

        const doc = await PDFDocument.create();
        const bold = await doc.embedFont(StandardFonts.HelveticaBold);
        const regular = await doc.embedFont(StandardFonts.Helvetica);
        const contentWidth = SLIDE_PAGE.width - SLIDE_PAGE.margin * 2;

        for (const [slideIndex, entry] of slideEntries.entries()) {
          report(`Laying out slide ${slideIndex + 1} of ${slideEntries.length}…`, (fileIndex + (slideIndex + 1) / slideEntries.length * 0.85) / sources.length);
          const xml = new TextDecoder().decode(zip[entry]);
          const slide = parseSlideXml(xml);

          const page = doc.addPage([SLIDE_PAGE.width, SLIDE_PAGE.height]);
          page.drawRectangle({
            x: 0, y: 0, width: SLIDE_PAGE.width, height: SLIDE_PAGE.height,
            color: rgb(1, 1, 1),
          });
          // Thin accent bar on the left, like a slide motif
          page.drawRectangle({ x: 0, y: 0, width: 8, height: SLIDE_PAGE.height, color: rgb(0.36, 0.33, 0.91) });

          let y = SLIDE_PAGE.height - SLIDE_PAGE.margin;
          const title = sanitize(slide.title).trim() || `Slide ${slideIndex + 1}`;
          // Title: wrap + clamp to two lines
          const titleSize = 22;
          const titleLines: string[] = [];
          let titleLine = "";
          for (const word of title.split(/\s+/)) {
            const candidate = titleLine ? `${titleLine} ${word}` : word;
            if (bold.widthOfTextAtSize(candidate, titleSize) <= contentWidth) titleLine = candidate;
            else { if (titleLine) titleLines.push(titleLine); titleLine = word; }
          }
          if (titleLine) titleLines.push(titleLine);
          for (const line of titleLines.slice(0, 2)) {
            page.drawText(line, { x: SLIDE_PAGE.margin, y: y - titleSize, size: titleSize, font: bold, color: rgb(0.12, 0.13, 0.18) });
            y -= titleSize * 1.35;
          }
          y -= 14;

          const bodySize = 13;
          for (const para of slide.paragraphs) {
            if (y < SLIDE_PAGE.margin + bodySize * 2) break; // page overflow — honest clip
            let line = "";
            const lines: string[] = [];
            for (const word of sanitize(para).split(/\s+/)) {
              const candidate = line ? `${line} ${word}` : word;
              if (regular.widthOfTextAtSize(candidate, bodySize) <= contentWidth) line = candidate;
              else { if (line) lines.push(line); line = word; }
            }
            if (line) lines.push(line);
            for (const l of lines) {
              if (y < SLIDE_PAGE.margin + bodySize) break;
              page.drawText(l, { x: SLIDE_PAGE.margin + 6, y: y - bodySize, size: bodySize, font: regular, color: rgb(0.25, 0.26, 0.32) });
              y -= bodySize * 1.4;
            }
            y -= 8;
          }
        }

        const bytes = await doc.save();
        results.push({ name: `${baseName(source.name)}.pdf`, blob: bytesToBlob(bytes, "application/pdf") });
        setSlideSummary(`${slideEntries.length} slide(s) per deck`);
      }
      return results;
    }, "Unpacking the deck…");
  }

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={`${baseName(queue.files[0]?.name ?? "decks")}-pdf`}
          note={slideSummary ? `${slideSummary} — landscape text layout.` : undefined}
          onReset={() => {
            queue.clear();
            setSlideSummary(null);
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pptx"]} multiple maxFiles={5} maxSizeMb={50} onFiles={queue.addFiles} existingCount={queue.files.length} hint=".pptx (PowerPoint 2007+)" />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="border-[3px] border-warn bg-warn-soft p-3">
            <p className="text-sm text-ink">
              Honest limits: slide <strong>text</strong> re-lays out onto landscape pages — images,
              animations and design themes don&apos;t carry over. Everything runs locally.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Converted entirely on this device.</p>
            <Button size="lg" disabled={queue.files.length === 0} onClick={convert}>
              Convert to PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
